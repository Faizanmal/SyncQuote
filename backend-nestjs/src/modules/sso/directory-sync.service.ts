import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDirectorySyncDto, UpdateDirectorySyncDto, DirectorySyncProvider } from './dto';
import { randomBytes } from 'crypto';

interface ScimUser {
  id: string;
  userName: string;
  name?: { givenName?: string; familyName?: string };
  emails?: Array<{ value: string; primary?: boolean }>;
  active: boolean;
}

@Injectable()
export class DirectorySyncService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create directory sync configuration
   */
  async createDirectorySync(teamId: string, dto: CreateDirectorySyncDto) {
    // Generate SCIM bearer token
    const bearerToken = dto.bearerToken || `scim_${randomBytes(32).toString('hex')}`;

    const config = await this.prisma.directorySync.create({
      data: {
        userId: teamId,
        provider: dto.provider,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        autoProvisionUsers: dto.autoProvisionUsers ?? true,
        autoDeprovisionUsers: dto.autoDeprovisionUsers ?? false,
        syncGroups: dto.syncGroups ?? true,
        allowedDomains: dto.allowedDomains || [],
        scimEndpoint: dto.scimEndpoint,
        bearerToken,
        metadata: dto.metadata || {},
      },
    });

    return {
      ...config,
      scimEndpoint: `${process.env.APP_URL}/api/scim/v2`,
      bearerToken, // Only returned on creation
    };
  }

  /**
   * List directory sync configs
   */
  async listDirectorySyncs(teamId: string) {
    const configs = await this.prisma.directorySync.findMany({
      where: { teamId },
      select: {
        id: true,
        provider: true,
        name: true,
        description: true,
        enabled: true,
        autoProvisionUsers: true,
        autoDeprovisionUsers: true,
        syncGroups: true,
        allowedDomains: true,
        lastSyncAt: true,
        syncedUsersCount: true,
        syncedGroupsCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs;
  }

  /**
   * Get directory sync config
   */
  async getDirectorySync(teamId: string, syncId: string) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, teamId },
      select: {
        id: true,
        provider: true,
        name: true,
        description: true,
        enabled: true,
        autoProvisionUsers: true,
        autoDeprovisionUsers: true,
        syncGroups: true,
        allowedDomains: true,
        scimEndpoint: true,
        lastSyncAt: true,
        syncedUsersCount: true,
        syncedGroupsCount: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Directory sync configuration not found');
    }

    return {
      ...config,
      scimEndpoint: `${process.env.APP_URL}/api/scim/v2`,
    };
  }

  /**
   * Update directory sync config
   */
  async updateDirectorySync(teamId: string, syncId: string, dto: UpdateDirectorySyncDto) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, userId: teamId },
    });

    if (!config) {
      throw new NotFoundException('Directory sync configuration not found');
    }

    const updated = await this.prisma.directorySync.update({
      where: { id: syncId },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        autoProvisionUsers: dto.autoProvisionUsers,
        autoDeprovisionUsers: dto.autoDeprovisionUsers,
        syncGroups: dto.syncGroups,
      },
    });

    return updated;
  }

  /**
   * Delete directory sync config
   */
  async deleteDirectorySync(teamId: string, syncId: string) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, userId: teamId },
    });

    if (!config) {
      throw new NotFoundException('Directory sync configuration not found');
    }

    await this.prisma.directorySync.delete({
      where: { id: syncId },
    });

    return { success: true };
  }

  /**
   * Regenerate SCIM bearer token
   */
  async regenerateBearerToken(teamId: string, syncId: string) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, userId: teamId },
    });

    if (!config) {
      throw new NotFoundException('Directory sync configuration not found');
    }

    const newToken = `scim_${randomBytes(32).toString('hex')}`;

    await this.prisma.directorySync.update({
      where: { id: syncId },
      data: { bearerToken: newToken },
    });

    return { bearerToken: newToken };
  }

  /**
   * Process SCIM user provisioning
   */
  async provisionUser(syncId: string, scimUser: ScimUser) {
    const config = await this.prisma.directorySync.findUnique({
      where: { id: syncId },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Directory sync not configured for provisioning');
    }

    const email = scimUser.emails?.[0]?.value || scimUser.userName;
    const domain = email.split('@')[1];

    // Check if domain is allowed
    if (config.allowedDomains.length > 0 && !config.allowedDomains.includes(domain)) {
      throw new Error('Domain not allowed');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user && scimUser.active) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          firstName: scimUser.name?.givenName || '',
          lastName: scimUser.name?.familyName || '',
          externalId: scimUser.id,
          emailVerified: true, // Auto-verify for directory sync
        },
      });

      // Add to team
      await this.prisma.teamMember.create({
        data: {
          teamId: config.teamId!,
          userId: user.id,
          role: 'MEMBER',
        },
      });

      // Update sync stats
      await this.prisma.directorySync.update({
        where: { id: syncId },
        data: {
          syncedUsersCount: { increment: 1 },
          lastSyncAt: new Date(),
        },
      });
    } else if (user && !scimUser.active && config.autoDeprovisionUsers) {
      // Deactivate user
      await this.prisma.teamMember.deleteMany({
        where: { teamId: config.teamId!, userId: user.id },
      });
    } else if (user) {
      // Update existing user
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: scimUser.name?.givenName,
          lastName: scimUser.name?.familyName,
        },
      });
    }

    return user;
  }

  /**
   * Get directory sync logs
   */
  async getSyncLogs(teamId: string, syncId: string, limit: number = 50) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, userId: teamId },
    });

    if (!config) {
      throw new NotFoundException('Directory sync configuration not found');
    }

    const logs = await this.prisma.directorySyncLog.findMany({
      where: { syncId: syncId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs;
  }

  /**
   * Trigger manual sync
   */
  async triggerManualSync(teamId: string, syncId: string) {
    const config = await this.prisma.directorySync.findFirst({
      where: { id: syncId, userId: teamId },
    });

    if (!config || !config.enabled) {
      throw new NotFoundException('Directory sync not enabled');
    }

    // Log sync start
    await this.prisma.directorySyncLog.create({
      data: {
        syncId: syncId,
        status: 'started',
        message: 'Manual sync triggered',
      },
    });

    await this.prisma.directorySync.update({
      where: { id: syncId },
      data: { lastSyncAt: new Date() },
    });

    return { success: true, message: 'Manual sync triggered' };
  }
}
