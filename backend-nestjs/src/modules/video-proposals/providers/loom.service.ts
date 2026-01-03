import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LoomService {
  private readonly logger = new Logger(LoomService.name);
  private readonly authUrl = 'https://www.loom.com/oauth/authorize';
  private readonly tokenUrl = 'https://www.loom.com/oauth/token';
  private readonly apiUrl = 'https://www.loom.com/v1';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.config.get('LOOM_CLIENT_ID');
    const redirectUri = this.config.get('LOOM_REDIRECT_URI');
    const scope = 'content:read';

    return `${this.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${userId}`;
  }

  async handleOAuthCallback(code: string, userId: string): Promise<any> {
    const clientId = this.config.get('LOOM_CLIENT_ID');
    const clientSecret = this.config.get('LOOM_CLIENT_SECRET');
    const redirectUri = this.config.get('LOOM_REDIRECT_URI');

    const response = await firstValueFrom(
      this.http.post(this.tokenUrl, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
    };
  }

  async refreshToken(userId: string): Promise<any> {
    const integration = await this.prisma.videoIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'loom' } },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const clientId = this.config.get('LOOM_CLIENT_ID');
    const clientSecret = this.config.get('LOOM_CLIENT_SECRET');

    const response = await firstValueFrom(
      this.http.post(this.tokenUrl, {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refreshToken,
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;

    await this.prisma.videoIntegration.update({
      where: { userId_provider: { userId, provider: 'loom' } },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || integration.refreshToken,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });

    return { accessToken: access_token };
  }

  private async getAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.videoIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'loom' } },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('Loom not connected');
    }

    // Check if token is expired
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      const refreshed = await this.refreshToken(userId);
      return refreshed.accessToken;
    }

    return integration.accessToken;
  }

  async listVideos(userId: string, limit = 50): Promise<any[]> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/videos`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit },
      }),
    );

    return response.data.videos.map((video: any) => ({
      id: video.id,
      title: video.name,
      description: video.description,
      embedUrl: video.embed_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration,
      createdAt: video.created_at,
    }));
  }

  async getVideoInfo(userId: string, videoId: string): Promise<any> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/videos/${videoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const video = response.data;
    return {
      id: video.id,
      title: video.name,
      description: video.description,
      embedUrl: video.embed_url,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration,
      createdAt: video.created_at,
    };
  }
}
