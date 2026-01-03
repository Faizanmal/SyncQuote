import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOAuthAppDto, OAuthAuthorizeDto, OAuthTokenDto, ApiKeyPermission } from './dto';
import { randomBytes, createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class OAuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new OAuth application
   */
  async createOAuthApp(userId: string, dto: CreateOAuthAppDto) {
    const clientId = `sq_${randomBytes(16).toString('hex')}`;
    const clientSecret = `sqs_${randomBytes(32).toString('hex')}`;

    const app = await this.prisma.oAuthApp.create({
      data: {
        userId,
        provider: dto.name,
        clientId,
        clientSecret,
        redirectUri: dto.redirectUri,
      },
    });

    // Return client secret only once
    return {
      id: app.id,
      clientId: app.clientId,
      clientSecret: clientSecret,
      redirectUri: app.redirectUri,
      createdAt: app.createdAt,
    };
  }

  /**
   * List OAuth apps for user
   */
  async listOAuthApps(userId: string) {
    const apps = await this.prisma.oAuthApp.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        clientId: true,
        redirectUri: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apps;
  }

  /**
   * Get OAuth app details
   */
  async getOAuthApp(userId: string, appId: string) {
    const app = await this.prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
      select: {
        id: true,
        provider: true,
        clientId: true,
        redirectUri: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!app) {
      throw new NotFoundException('OAuth app not found');
    }

    return app;
  }

  /**
   * Delete OAuth app
   */
  async deleteOAuthApp(userId: string, appId: string) {
    const app = await this.prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new NotFoundException('OAuth app not found');
    }

    // Revoke all tokens
    await this.prisma.oAuthToken.deleteMany({
      where: { oAuthAppId: appId },
    });

    // Delete authorization codes
    await this.prisma.oAuthCode.deleteMany({
      where: { oAuthAppId: appId },
    });

    await this.prisma.oAuthApp.delete({
      where: { id: appId },
    });

    return { success: true };
  }

  /**
   * Regenerate client secret
   */
  async regenerateClientSecret(userId: string, appId: string) {
    const app = await this.prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new NotFoundException('OAuth app not found');
    }

    const clientSecret = `sqs_${randomBytes(32).toString('hex')}`;
    const clientSecretHash = this.hashSecret(clientSecret);

    await this.prisma.oAuthApp.update({
      where: { id: appId },
      data: { clientSecretHash },
    });

    return { clientSecret };
  }

  /**
   * Initiate OAuth authorization
   */
  async authorize(dto: OAuthAuthorizeDto, userId: string) {
    // Find the OAuth app
    const app = await this.prisma.oAuthApp.findFirst({
      where: { clientId: dto.clientId, isActive: true },
    });

    if (!app) {
      throw new BadRequestException('Invalid client_id');
    }

    // Validate redirect URI
    if (app.redirectUri !== dto.redirectUri) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    if (dto.responseType !== 'code') {
      throw new BadRequestException('Only authorization_code flow is supported');
    }

    // Parse scopes (OAuthApp doesn't store scopes, so just use requested)
    const requestedScopes = dto.scope?.split(' ') || [];

    // Generate authorization code
    const code = randomBytes(32).toString('hex');
    const codeHash = this.hashSecret(code);

    await this.prisma.oAuthCode.create({
      data: {
        oAuthAppId: app.id,
        userId,
        codeHash,
        redirectUri: dto.redirectUri,
        scopes: requestedScopes,
        codeChallenge: dto.codeChallenge,
        codeChallengeMethod: dto.codeChallengeMethod,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      } as any,
    });

    // Build redirect URL
    const redirectUrl = new URL(dto.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (dto.state) {
      redirectUrl.searchParams.set('state', dto.state);
    }

    return { redirectUrl: redirectUrl.toString() };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeToken(dto: OAuthTokenDto) {
    const app = await this.prisma.oAuthApp.findFirst({
      where: { clientId: dto.clientId, isActive: true },
    });

    if (!app) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // Verify client secret
    const secretHash = this.hashSecret(dto.clientSecret);
    if (secretHash !== app.clientSecretHash) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    if (dto.grantType === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(app, dto);
    } else if (dto.grantType === 'refresh_token') {
      return this.handleRefreshTokenGrant(app, dto);
    } else {
      throw new BadRequestException('Unsupported grant_type');
    }
  }

  /**
   * Handle authorization code grant
   */
  private async handleAuthorizationCodeGrant(app: any, dto: OAuthTokenDto) {
    if (!dto.code) {
      throw new BadRequestException('Missing authorization code');
    }

    const codeHash = this.hashSecret(dto.code);
    const authCode = await this.prisma.oAuthCode.findFirst({
      where: {
        oAuthAppId: app.id,
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authCode) {
      throw new BadRequestException('Invalid or expired authorization code');
    }

    // Verify redirect URI matches
    if (dto.redirectUri && dto.redirectUri !== authCode.redirectUri) {
      throw new BadRequestException('redirect_uri mismatch');
    }

    // Verify PKCE if used
    if (authCode.codeChallenge) {
      if (!dto.codeVerifier) {
        throw new BadRequestException('code_verifier required');
      }

      const challenge =
        authCode.codeChallengeMethod === 'S256'
          ? createHash('sha256').update(dto.codeVerifier).digest('base64url')
          : dto.codeVerifier;

      if (challenge !== authCode.codeChallenge) {
        throw new BadRequestException('Invalid code_verifier');
      }
    }

    // Mark code as used
    await this.prisma.oAuthCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    // Generate tokens
    return this.generateTokens(app, authCode.userId, authCode.scopes as string[]);
  }

  /**
   * Handle refresh token grant
   */
  private async handleRefreshTokenGrant(app: any, dto: OAuthTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('Missing refresh_token');
    }

    const tokenHash = this.hashSecret(dto.refreshToken);
    const token = await this.prisma.oAuthToken.findFirst({
      where: {
        oAuthAppId: app.id,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        refreshExpiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.oAuthToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    return this.generateTokens(app, token.userId, token.scopes as string[]);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(app: any, userId: string, scopes: string[]) {
    const accessToken = jwt.sign(
      {
        sub: userId,
        client_id: app.clientId,
        scopes,
        type: 'oauth_access',
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' },
    );

    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashSecret(refreshToken);

    await this.prisma.oAuthToken.create({
      data: {
        oAuthAppId: app.id,
        userId,
        scopes,
        accessTokenHash: this.hashSecret(accessToken),
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      } as any,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token') {
    const tokenHash = this.hashSecret(token);

    if (tokenTypeHint === 'refresh_token') {
      await this.prisma.oAuthToken.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.oAuthToken.updateMany({
        where: { accessTokenHash: tokenHash },
        data: { revokedAt: new Date() },
      });
    }

    return { success: true };
  }

  /**
   * Validate access token
   */
  async validateAccessToken(accessToken: string) {
    try {
      const decoded = jwt.verify(accessToken, process.env.JWT_SECRET || 'secret') as any;

      if (decoded.type !== 'oauth_access') {
        throw new UnauthorizedException('Invalid token type');
      }

      const tokenHash = this.hashSecret(accessToken);
      const token = await this.prisma.oAuthToken.findFirst({
        where: {
          accessTokenHash: tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!token) {
        throw new UnauthorizedException('Token has been revoked');
      }

      return {
        userId: decoded.sub,
        clientId: decoded.client_id,
        scopes: decoded.scopes as ApiKeyPermission[],
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  /**
   * Get authorized apps for user (apps they've authorized)
   */
  async getAuthorizedApps(userId: string) {
    const tokens = await this.prisma.oAuthToken.findMany({
      where: {
        userId,
        revokedAt: null,
        refreshExpiresAt: { gt: new Date() },
      },
      include: {
        oAuthApp: {
          select: {
            id: true,
            provider: true,
            description: true,
            // logoUrl: true,
            // websiteUrl: true,
          },
        } as any,
      },
      distinct: ['oAuthAppId'],
    });

    return tokens.map((t) => ({
      app: (t as any).oAuthApp,
      scopes: t.scopes,
      authorizedAt: t.createdAt,
    }));
  }

  /**
   * Revoke authorization for an app
   */
  async revokeAppAuthorization(userId: string, appId: string) {
    await this.prisma.oAuthToken.updateMany({
      where: { userId, oAuthAppId: appId },
      data: { revokedAt: new Date() },
    });

    await this.prisma.oAuthCode.deleteMany({
      where: { userId, oAuthAppId: appId },
    });

    return { success: true };
  }

  /**
   * Hash secret for storage
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
