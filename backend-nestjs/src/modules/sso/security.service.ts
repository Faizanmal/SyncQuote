import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSecurityPolicyDto, SessionSecurityLevel } from './dto';
import { Request } from 'express';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get security policy for team
   */
  async getSecurityPolicy(teamId: string) {
    let policy = await this.prisma.securityPolicy.findFirst({
      where: { teamId: teamId },
    });

    if (!policy) {
      // Create default policy for the first user in this context
      policy = await this.prisma.securityPolicy.create({
        data: {
          userId: teamId,
          teamId: teamId,
          sessionSecurityLevel: SessionSecurityLevel.STANDARD,
          requireMfa: false,
          sessionTimeout: 3600,
          maxConcurrentSessions: 3,
          enforceIpWhitelist: false,
          allowedIpRanges: [],
          logAllAccess: true,
          preventAccountSharing: false,
          passwordMinLength: 8,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecialChars: false,
          passwordExpiryDays: 0, // 0 = never expires
        },
      });
    }

    return policy;
  }

  /**
   * Update security policy
   */
  async updateSecurityPolicy(teamId: string, dto: UpdateSecurityPolicyDto) {
    const policy = await this.getSecurityPolicy(teamId);

    const updated = await this.prisma.securityPolicy.update({
      where: { id: policy.id },
      data: {
        sessionSecurityLevel: dto.sessionSecurityLevel,
        requireMfa: dto.requireMfa,
        sessionTimeout: dto.sessionTimeoutMinutes ? dto.sessionTimeoutMinutes * 60 : undefined,
        maxConcurrentSessions: dto.maxConcurrentSessions,
        enforceIpWhitelist: dto.enforceIpWhitelist,
        allowedIpRanges: dto.allowedIpRanges,
        logAllAccess: dto.logAllAccess,
        preventAccountSharing: dto.preventAccountSharing,
        passwordMinLength: dto.passwordMinLength,
        passwordRequireUppercase: dto.passwordRequireUppercase,
        passwordRequireLowercase: dto.passwordRequireLowercase,
        passwordRequireNumbers: dto.passwordRequireNumbers,
        passwordRequireSpecialChars: dto.passwordRequireSpecialChars,
        passwordExpiryDays: dto.passwordExpiryDays,
      },
    });

    return updated;
  }

  /**
   * Create or update user session
   */
  async createSession(userId: string, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teamMemberships: { include: { team: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Get team security policy
    const teamId = user.teamMemberships[0]?.teamId;
    const policy = teamId ? await this.getSecurityPolicy(teamId) : null;

    // Check IP whitelist
    if (policy?.enforceIpWhitelist) {
      const clientIp = this.getClientIp(req);
      if (!this.isIpAllowed(clientIp, policy.allowedIpRanges)) {
        await this.logSecurityEvent(userId, 'ip_blocked', { ip: clientIp });
        throw new UnauthorizedException('IP address not allowed');
      }
    }

    // Check max concurrent sessions
    if (policy?.maxConcurrentSessions) {
      const activeSessions = await this.prisma.userSession.count({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeSessions >= policy.maxConcurrentSessions) {
        // Remove oldest session
        const oldestSession = await this.prisma.userSession.findFirst({
          where: { userId, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'asc' },
        });

        if (oldestSession) {
          await this.prisma.userSession.delete({
            where: { id: oldestSession.id },
          });
        }
      }
    }

    // Create new session
    const timeoutMinutes = policy?.sessionTimeout || 60;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    const token = this.generateToken();

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        token,
        ipAddress: this.getClientIp(req),
        userAgent: req.headers['user-agent'] || '',
        expiresAt,
      },
    });

    // Log access if required
    if (policy?.logAllAccess) {
      await this.logSecurityEvent(userId, 'session_created', {
        sessionId: session.id,
        ip: session.ipAddress,
        userAgent: session.userAgent,
      });
    }

    return session;
  }

  /**
   * Validate and refresh session
   */
  async validateSession(sessionId: string, req: Request) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: { teamMemberships: { include: { team: true } } },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { teamMemberships: { include: { team: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const teamId = user.teamMemberships[0]?.teamId;
    const policy = teamId ? await this.getSecurityPolicy(teamId) : null;

    // Check if account sharing detection is enabled
    if (policy?.preventAccountSharing) {
      const currentIp = this.getClientIp(req);
      const currentUserAgent = req.headers['user-agent'] || '';

      if (session.ipAddress !== currentIp || session.userAgent !== currentUserAgent) {
        await this.logSecurityEvent(session.userId, 'suspicious_session', {
          sessionId: session.id,
          originalIp: session.ipAddress,
          currentIp,
        });
        throw new UnauthorizedException('Session validation failed');
      }
    }

    // Extend session
    const timeoutMinutes = policy?.sessionTimeout || 60;
    const newExpiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        expiresAt: newExpiresAt,
        lastActivityAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Terminate session
   */
  async terminateSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (session) {
      await this.prisma.userSession.delete({
        where: { id: sessionId },
      });

      await this.logSecurityEvent(userId, 'session_terminated', {
        sessionId,
      });
    }

    return { success: true };
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
      },
    });

    return sessions;
  }

  /**
   * Terminate all sessions for user
   */
  async terminateAllSessions(userId: string, exceptSessionId?: string) {
    const where: any = { userId, expiresAt: { gt: new Date() } };
    if (exceptSessionId) {
      where.id = { not: exceptSessionId };
    }

    await this.prisma.userSession.deleteMany({ where });

    await this.logSecurityEvent(userId, 'all_sessions_terminated', {
      exceptSessionId,
    });

    return { success: true };
  }

  /**
   * Get security audit log
   */
  async getAuditLog(teamId: string, limit: number = 100, filters?: any) {
    const where: any = { teamId };

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate) where.createdAt = { gte: new Date(filters.startDate) };

    const logs = await this.prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return logs;
  }

  /**
   * Log security event
   */
  async logSecurityEvent(userId: string, eventType: string, metadata?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teamMemberships: true },
    });

    if (!user) return;

    const teamId = user.teamMemberships[0]?.teamId;
    if (!teamId) return;

    await this.prisma.securityAuditLog.create({
      data: {
        teamId,
        userId,
        action: eventType,
        ipAddress: metadata?.ip,
      },
    });
  }

  /**
   * Validate password against policy
   */
  async validatePassword(
    teamId: string,
    password: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const policy = await this.getSecurityPolicy(teamId);
    const errors: string[] = [];

    if (password.length < policy.passwordMinLength) {
      errors.push(`Password must be at least ${policy.passwordMinLength} characters`);
    }

    if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.passwordRequireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      policy.passwordRequireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if password has expired
   */
  async isPasswordExpired(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { teamMemberships: { include: { team: true } } },
    });

    if (!user || !user.passwordChangedAt) return false;

    const teamId = user.teamMemberships[0]?.teamId;
    if (!teamId) return false;

    const policy = await this.getSecurityPolicy(teamId);
    if (!policy.passwordExpiryDays || policy.passwordExpiryDays === 0) {
      return false;
    }

    const expiryDate = new Date(user.passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + policy.passwordExpiryDays);

    return new Date() > expiryDate;
  }

  /**
   * Get client IP from request
   */
  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      ''
    );
  }

  /**
   * Check if IP is in allowed ranges
   */
  private isIpAllowed(ip: string, allowedRanges: string[]): boolean {
    if (allowedRanges.length === 0) return true;

    // Simple check - in production, use proper CIDR matching library
    return allowedRanges.some((range) => {
      if (range.includes('/')) {
        // CIDR notation - simplified check
        const [network] = range.split('/');
        return ip.startsWith(network.split('.').slice(0, 3).join('.'));
      }
      return ip === range;
    });
  }

  /**
   * Generate a secure token
   */
  private generateToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}
