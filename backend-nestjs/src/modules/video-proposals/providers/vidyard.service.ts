import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VidyardService {
  private readonly logger = new Logger(VidyardService.name);
  private readonly apiUrl = 'https://api.vidyard.com/dashboard/v1';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.get(`${this.apiUrl}/users/me`, {
          headers: { Authorization: `Token ${apiKey}` },
        }),
      );
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid Vidyard API key');
    }
  }

  private async getApiKey(userId: string): Promise<string> {
    const integration = await this.prisma.videoIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'vidyard' } },
    });

    if (!integration?.apiKey) {
      throw new UnauthorizedException('Vidyard not connected');
    }

    return integration.apiKey;
  }

  async listVideos(userId: string, limit = 50): Promise<any[]> {
    const apiKey = await this.getApiKey(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/videos`, {
        headers: { Authorization: `Token ${apiKey}` },
        params: { per_page: limit },
      }),
    );

    return response.data.videos.map((video: any) => ({
      id: video.id.toString(),
      title: video.name,
      description: video.description,
      embedUrl: `https://share.vidyard.com/watch/${video.uuid}`,
      thumbnailUrl: video.thumbnail_urls?.default || video.thumbnail_url,
      duration: video.duration,
      createdAt: video.created_at,
    }));
  }

  async getVideoInfo(userId: string, videoId: string): Promise<any> {
    const apiKey = await this.getApiKey(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/videos/${videoId}`, {
        headers: { Authorization: `Token ${apiKey}` },
      }),
    );

    const video = response.data.video;
    return {
      id: video.id.toString(),
      title: video.name,
      description: video.description,
      embedUrl: `https://share.vidyard.com/watch/${video.uuid}`,
      thumbnailUrl: video.thumbnail_urls?.default || video.thumbnail_url,
      duration: video.duration,
      createdAt: video.created_at,
    };
  }

  async getVideoAnalytics(userId: string, videoId: string): Promise<any> {
    const apiKey = await this.getApiKey(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/videos/${videoId}/summary_analytics`, {
        headers: { Authorization: `Token ${apiKey}` },
      }),
    );

    return response.data;
  }
}
