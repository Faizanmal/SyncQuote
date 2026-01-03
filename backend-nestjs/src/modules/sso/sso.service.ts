import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSsoConfigDto, UpdateSsoConfigDto, SsoProvider } from './dto';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

@Injectable()
export class SsoService {
  private readonly encryptionKey: Buffer;

  constructor(private prisma: PrismaService) {
    // In production, use a secure key from environment
    this.encryptionKey = Buffer.from(
      process.env.SSO_ENCRYPTION_KEY || randomBytes(32).toString('hex'),
      'hex',
    );
  }

  /**
   * Create SSO configuration
   */
  async createSsoConfig(userId: string, teamId: string, dto: CreateSsoConfigDto) {
    // Encrypt sensitive data
    const encryptedConfig = this.encryptSensitiveData({
      certificate: dto.certificate,
      privateKey: dto.privateKey,
      clientSecret: dto.clientSecret,
    });

    const config = await this.prisma.ssoConfiguration.create({
      data: {
        userId,
        teamId,
        provider: dto.provider,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        enforceForDomain: dto.enforceForDomain ?? false,
        allowedDomains: dto.allowedDomains || [],
        entryPoint: dto.entryPoint,
        issuer: dto.issuer,
        certificate: encryptedConfig.certificate,
        privateKey: encryptedConfig.privateKey,
        clientId: dto.clientId,
        clientSecret: encryptedConfig.clientSecret,
        authorizationUrl: dto.authorizationUrl,
        tokenUrl: dto.tokenUrl,
        userInfoUrl: dto.userInfoUrl,
        config: dto.metadata || {},
        metadata: dto.metadata || {},
      },
    });

    return this.sanitizeConfig(config);
  }

  /**
   * List SSO configurations for team
   */
  async listSsoConfigs(teamId: string) {
    const configs = await this.prisma.ssoConfiguration.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((config) => this.sanitizeConfig(config));
  }

  /**
   * Get SSO configuration
   */
  async getSsoConfig(teamId: string, configId: string) {
    const config = await this.prisma.ssoConfiguration.findFirst({
      where: { id: configId, teamId },
    });

    if (!config) {
      throw new NotFoundException('SSO configuration not found');
    }

    return this.sanitizeConfig(config);
  }

  /**
   * Get SSO configuration with decrypted secrets (internal use)
   */
  async getSsoConfigWithSecrets(configId: string) {
    const config = await this.prisma.ssoConfiguration.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new NotFoundException('SSO configuration not found');
    }

    // Decrypt sensitive data
    const decrypted = this.decryptSensitiveData({
      certificate: config.certificate,
      privateKey: config.privateKey,
      clientSecret: config.clientSecret,
    });

    return {
      ...config,
      certificate: decrypted.certificate,
      privateKey: decrypted.privateKey,
      clientSecret: decrypted.clientSecret,
    };
  }

  /**
   * Update SSO configuration
   */
  async updateSsoConfig(teamId: string, configId: string, dto: UpdateSsoConfigDto) {
    const config = await this.prisma.ssoConfiguration.findFirst({
      where: { id: configId, teamId },
    });

    if (!config) {
      throw new NotFoundException('SSO configuration not found');
    }

    const updated = await this.prisma.ssoConfiguration.update({
      where: { id: configId },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
        enforceForDomain: dto.enforceForDomain,
        allowedDomains: dto.allowedDomains,
        metadata: dto.metadata,
      },
    });

    return this.sanitizeConfig(updated);
  }

  /**
   * Delete SSO configuration
   */
  async deleteSsoConfig(teamId: string, configId: string) {
    const config = await this.prisma.ssoConfiguration.findFirst({
      where: { id: configId, teamId },
    });

    if (!config) {
      throw new NotFoundException('SSO configuration not found');
    }

    await this.prisma.ssoConfiguration.delete({
      where: { id: configId },
    });

    return { success: true };
  }

  /**
   * Find SSO config by domain
   */
  async findSsoConfigByDomain(email: string): Promise<any | null> {
    const domain = email.split('@')[1];

    const config = await this.prisma.ssoConfiguration.findFirst({
      where: {
        enabled: true,
        allowedDomains: { has: domain },
      },
    });

    return config;
  }

  /**
   * Check if SSO is enforced for domain
   */
  async isSsoEnforced(email: string): Promise<boolean> {
    const domain = email.split('@')[1];

    const config = await this.prisma.ssoConfiguration.findFirst({
      where: {
        enabled: true,
        enforceForDomain: true,
        allowedDomains: { has: domain },
      },
    });

    return !!config;
  }

  /**
   * Log SSO authentication attempt
   */
  async logSsoAttempt(
    configId: string,
    userId: string | null,
    success: boolean,
    errorMessage?: string,
    metadata?: any,
  ) {
    await this.prisma.ssoAttempt.create({
      data: {
        ssoConfigurationId: configId,
        userId,
        provider: 'sso',
        success,
        errorMessage,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    // Update config stats
    await this.prisma.ssoConfiguration.update({
      where: { id: configId },
      data: {
        lastUsedAt: new Date(),
        ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
      },
    });
  }

  /**
   * Get SSO usage statistics
   */
  async getSsoStats(teamId: string, configId: string, days: number = 30) {
    const config = await this.prisma.ssoConfiguration.findFirst({
      where: { id: configId, teamId },
    });

    if (!config) {
      throw new NotFoundException('SSO configuration not found');
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalAttempts, successfulAttempts, failedAttempts, uniqueUsers] = await Promise.all([
      this.prisma.ssoAttempt.count({
        where: { ssoConfigurationId: configId, createdAt: { gte: startDate } },
      }),
      this.prisma.ssoAttempt.count({
        where: { ssoConfigurationId: configId, success: true, createdAt: { gte: startDate } },
      }),
      this.prisma.ssoAttempt.count({
        where: { ssoConfigurationId: configId, success: false, createdAt: { gte: startDate } },
      }),
      this.prisma.ssoAttempt.findMany({
        where: { ssoConfigurationId: configId, createdAt: { gte: startDate } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const dailyAttempts = await this.prisma.$queryRaw`
      SELECT DATE("createdAt") as date, 
             COUNT(*) as total,
             SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
      FROM "SsoAttempt"
      WHERE "ssoConfigurationId" = ${configId}
      AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `;

    return {
      period: { days, startDate, endDate: new Date() },
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      uniqueUsers: uniqueUsers.length,
      successRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
      dailyAttempts,
    };
  }

  /**
   * Test SSO configuration
   */
  async testSsoConfig(teamId: string, configId: string) {
    const config = await this.getSsoConfigWithSecrets(configId);

    if (config.teamId !== teamId) {
      throw new NotFoundException('SSO configuration not found');
    }

    // Perform validation based on provider
    const validations: any = {
      configured: !!config.enabled,
      validDomains: config.allowedDomains.length > 0,
    };

    if (config.provider === SsoProvider.SAML) {
      validations.hasEntryPoint = !!config.entryPoint;
      validations.hasCertificate = !!config.certificate;
      validations.hasIssuer = !!config.issuer;
    } else {
      validations.hasClientId = !!config.clientId;
      validations.hasClientSecret = !!config.clientSecret;
      validations.hasAuthUrl = !!config.authorizationUrl;
      validations.hasTokenUrl = !!config.tokenUrl;
    }

    const allValid = Object.values(validations).every((v) => v === true);

    return {
      valid: allValid,
      validations,
      provider: config.provider,
    };
  }

  /**
   * Encrypt sensitive data
   */
  private encryptSensitiveData(
    data: Record<string, string | undefined>,
  ): Record<string, string | null> {
    const result: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!value) {
        result[key] = null;
        continue;
      }

      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      result[key] = `${iv.toString('hex')}:${encrypted}`;
    }

    return result;
  }

  /**
   * Decrypt sensitive data
   */
  private decryptSensitiveData(data: Record<string, string | null>): Record<string, string | null> {
    const result: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!value) {
        result[key] = null;
        continue;
      }

      const [ivHex, encrypted] = value.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      result[key] = decrypted;
    }

    return result;
  }

  /**
   * Remove sensitive data from config
   */
  private sanitizeConfig(config: any) {
    const { certificate, privateKey, clientSecret, ...rest } = config;
    return {
      ...rest,
      hasCertificate: !!certificate,
      hasPrivateKey: !!privateKey,
      hasClientSecret: !!clientSecret,
    };
  }
}
