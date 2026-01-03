import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyPermission } from './dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new API key
   */
  async createApiKey(userId: string, dto: CreateApiKeyDto): Promise<{ apiKey: string; data: any }> {
    // Generate a secure API key
    const keyBytes = randomBytes(32);
    const apiKey = `sq_live_${keyBytes.toString('hex')}`;

    const data = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        key: apiKey,
      },
    });

    // Return the full key only once - user must save it
    return {
      apiKey,
      data: {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
      },
    };
  }

  /**
   * List all API keys for a user
   */
  async listApiKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        key: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys;
  }

  /**
   * Get API key details
   */
  async getApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    return {
      id: key.id,
      name: key.name,
      key: key.key,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }

  /**
   * Update API key
   */
  async updateApiKey(userId: string, keyId: string, dto: UpdateApiKeyDto) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        name: dto.name,
      },
    });

    return updated;
  }

  /**
   * Revoke (delete) API key
   */
  async revokeApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id: keyId },
    });

    return { success: true };
  }

  /**
   * Validate API key and return user/permissions
   */
  async validateApiKey(apiKey: string, requiredPermission?: ApiKeyPermission) {
    const key = await this.prisma.apiKey.findFirst({
      where: { key: apiKey },
      include: { user: true },
    } as any);

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Update usage stats
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: {
        lastUsed: new Date(),
      },
    });

    return {
      userId: key.userId,
      user: (key as any).user,
    };
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(
    keyId: string,
  ): Promise<{ allowed: boolean; remaining: number; reset: Date }> {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      return { allowed: false, remaining: 0, reset: new Date() };
    }

    // Get usage in current window (1 hour)
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);

    const usage = await this.prisma.apiKeyUsage.count({
      where: {
        apiKeyId: keyId,
        createdAt: { gte: windowStart },
      },
    });

    const remaining = Math.max(0, (key.rateLimit || 1000) - usage);
    const reset = new Date(windowStart.getTime() + 60 * 60 * 1000);

    if (usage >= (key.rateLimit || 1000)) {
      return { allowed: false, remaining: 0, reset };
    }

    // Log usage
    await this.prisma.apiKeyUsage.create({
      data: {
        apiKeyId: keyId,
        endpoint: '', // Will be set by the calling code
        method: 'GET',
        statusCode: 200,
        responseTime: 0,
      },
    });

    return { allowed: true, remaining: remaining - 1, reset };
  }

  /**
   * Get API key usage analytics
   */
  async getUsageAnalytics(userId: string, keyId: string, days: number = 30) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usage = await this.prisma.apiKeyUsage.groupBy({
      by: ['endpoint'],
      where: {
        apiKeyId: keyId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const dailyUsage = await this.prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "ApiKeyUsage"
      WHERE "apiKeyId" = ${keyId}
      AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `;

    return {
      totalRequests: usage.length,
      endpointUsage: usage,
      dailyUsage,
    };
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
