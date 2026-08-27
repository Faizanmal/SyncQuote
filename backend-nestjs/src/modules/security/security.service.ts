import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.util';

@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    const [user, policy] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.securityPolicy.findUnique({ where: { userId } }),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const meta = (user.metadata || {}) as Record<string, any>;
    return {
      twoFactorEnabled: user.twoFactorEnabled,
      sessionTimeout: this.normalizeTimeout(policy?.sessionTimeout),
      ipWhitelisting: policy?.enforceIpWhitelist || false,
      auditLogging: policy?.logAllAccess ?? true,
      passwordPolicy: {
        minLength: policy?.passwordMinLength || 8,
        requireUppercase: policy?.passwordRequireUppercase || false,
        requireNumbers: policy?.passwordRequireNumbers || false,
        requireSymbols: policy?.passwordRequireSpecialChars || false,
      },
      loginNotifications: meta.loginNotifications ?? true,
      suspiciousActivityAlerts: meta.suspiciousActivityAlerts ?? true,
    };
  }

  async updateSettings(userId: string, dto: any) {
    const timeout =
      dto.sessionTimeout !== undefined ? this.normalizeTimeout(dto.sessionTimeout) : undefined;
    await this.prisma.securityPolicy.upsert({
      where: { userId },
      create: {
        userId,
        sessionTimeout: timeout ?? 60,
        enforceIpWhitelist: !!dto.ipWhitelisting,
        logAllAccess: dto.auditLogging !== false,
        passwordMinLength: dto.passwordPolicy?.minLength || 8,
        passwordRequireUppercase: !!dto.passwordPolicy?.requireUppercase,
        passwordRequireNumbers: !!dto.passwordPolicy?.requireNumbers,
        passwordRequireSpecialChars: !!dto.passwordPolicy?.requireSymbols,
      },
      update: {
        ...(timeout !== undefined ? { sessionTimeout: timeout } : {}),
        ...(dto.ipWhitelisting !== undefined ? { enforceIpWhitelist: !!dto.ipWhitelisting } : {}),
        ...(dto.auditLogging !== undefined ? { logAllAccess: !!dto.auditLogging } : {}),
        ...(dto.passwordPolicy?.minLength !== undefined
          ? { passwordMinLength: dto.passwordPolicy.minLength }
          : {}),
        ...(dto.passwordPolicy?.requireUppercase !== undefined
          ? { passwordRequireUppercase: !!dto.passwordPolicy.requireUppercase }
          : {}),
        ...(dto.passwordPolicy?.requireNumbers !== undefined
          ? { passwordRequireNumbers: !!dto.passwordPolicy.requireNumbers }
          : {}),
        ...(dto.passwordPolicy?.requireSymbols !== undefined
          ? { passwordRequireSpecialChars: !!dto.passwordPolicy.requireSymbols }
          : {}),
      },
    });

    if (dto.loginNotifications !== undefined || dto.suspiciousActivityAlerts !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });
      const metadata = { ...((user?.metadata || {}) as Record<string, any>) };
      if (dto.loginNotifications !== undefined) {
        metadata.loginNotifications = !!dto.loginNotifications;
      }
      if (dto.suspiciousActivityAlerts !== undefined) {
        metadata.suspiciousActivityAlerts = !!dto.suspiciousActivityAlerts;
      }
      await this.prisma.user.update({ where: { id: userId }, data: { metadata } });
    }

    return this.getSettings(userId);
  }

  async getAuditLogs(userId: string) {
    const logs = await this.prisma.securityAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resourceId || 'account',
      userId: log.userId,
      userName: log.user?.name || log.user?.email || 'You',
      ip: log.ipAddress || '',
      userAgent: log.userAgent || '',
      location: '',
      timestamp: log.createdAt.toISOString(),
      riskLevel: 'low',
      details: log.changes || {},
    }));
  }

  async getSessions(userId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: 'desc' },
    });
    return sessions.map((session, index) => {
      const parsed = this.parseUserAgent(session.userAgent);
      return {
        id: session.id,
        device: parsed.device,
        browser: parsed.browser,
        os: parsed.os,
        ip: session.ipAddress || '',
        location: '',
        current: index === 0,
        lastActive: (session.lastActivityAt || session.createdAt).toISOString(),
        createdAt: session.createdAt.toISOString(),
      };
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  async getThreats(userId: string) {
    const failed = await this.prisma.securityAuditLog.findMany({
      where: { userId, action: { contains: 'failed' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return failed.map((log) => ({
      id: log.id,
      type: log.action,
      severity: 'medium',
      description: log.action,
      timestamp: log.createdAt.toISOString(),
      status: 'investigating',
      affectedUsers: 1,
    }));
  }

  async listApiKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((key) => ({
      id: key.id,
      name: key.name,
      key: key.keyPrefix ? `${key.keyPrefix}••••` : '••••',
      permissions: Array.isArray(key.permissions) ? key.permissions : [],
      lastUsed: key.lastUsedAt?.toISOString() || key.lastUsed?.toISOString() || null,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      status: key.isActive ? 'active' : 'revoked',
    }));
  }

  async createApiKey(userId: string, dto: any) {
    const raw = `sk_live_${randomBytes(24).toString('hex')}`;
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        key: raw,
        keyPrefix: raw.slice(0, 10),
        permissions: Array.isArray(dto.permissions)
          ? dto.permissions
          : dto.permissions
            ? [dto.permissions]
            : [],
        isActive: true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...created, key: raw };
  }

  async deleteApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, userId } });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    await this.prisma.apiKey.delete({ where: { id: keyId } });
    return { success: true };
  }

  async getQr(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const secret = user.totpSecret || generateTotpSecret();
    if (!user.totpSecret) {
      await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    }
    const otpauth = otpauthUrl(user.email, secret);
    return {
      secret,
      otpauth,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`,
    };
  }

  async enable2fa(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password) {
      throw new BadRequestException('Password login is required to enable 2FA');
    }
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new UnauthorizedException('Invalid password');
    }
    if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    await this.prisma.securityAuditLog.create({
      data: { userId, action: '2fa_enabled' },
    });
    return { success: true, twoFactorEnabled: true };
  }

  async disable2fa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, totpSecret: null },
    });
    await this.prisma.securityAuditLog.create({
      data: { userId, action: '2fa_disabled' },
    });
    return { success: true, twoFactorEnabled: false };
  }

  private normalizeTimeout(value?: number | null) {
    if (!value || value <= 0) {
      return 60;
    }
    if (value === 3600) {
      return 60;
    }
    return value;
  }

  private parseUserAgent(userAgent?: string | null) {
    const ua = userAgent || '';
    const browser = /Edg\//.test(ua)
      ? 'Edge'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ua.slice(0, 40) || 'Unknown';
    const os = /Windows/.test(ua)
      ? 'Windows'
      : /Mac OS/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : /iPhone|iPad/.test(ua)
              ? 'iOS'
              : '';
    const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'Mobile' : 'Desktop';
    return { browser, os, device };
  }
}
