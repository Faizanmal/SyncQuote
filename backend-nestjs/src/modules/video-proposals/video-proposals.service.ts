import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoomService } from './providers/loom.service';
import { VidyardService } from './providers/vidyard.service';
import { VideoAnalyticsService } from './video-analytics.service';
import {
  CreateVideoDto,
  UpdateVideoDto,
  VideoProvider,
  VideoStatus,
  PersonalizedVideoDto,
  VideoAnalyticsDto,
} from './dto/video.dto';

@Injectable()
export class VideoProposalsService {
  private readonly logger = new Logger(VideoProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private loom: LoomService,
    private vidyard: VidyardService,
    private analytics: VideoAnalyticsService,
  ) { }

  // Create video record
  async createVideo(userId: string, dto: CreateVideoDto) {
    // Validate provider-specific requirements
    if (dto.provider === VideoProvider.LOOM && !dto.externalId) {
      throw new BadRequestException('Loom video ID is required');
    }

    // Get embed URL and thumbnail from provider if not provided
    let embedUrl = dto.embedUrl;
    let thumbnailUrl = dto.thumbnailUrl;
    let duration = dto.duration;

    if (dto.externalId) {
      switch (dto.provider) {
        case VideoProvider.LOOM:
          const loomData = await this.loom.getVideoInfo(userId, dto.externalId);
          embedUrl = embedUrl || loomData.embedUrl;
          thumbnailUrl = thumbnailUrl || loomData.thumbnailUrl;
          duration = duration || loomData.duration;
          break;
        case VideoProvider.VIDYARD:
          const vidyardData = await this.vidyard.getVideoInfo(userId, dto.externalId);
          embedUrl = embedUrl || vidyardData.embedUrl;
          thumbnailUrl = thumbnailUrl || vidyardData.thumbnailUrl;
          duration = duration || vidyardData.duration;
          break;
      }
    }

    if (!embedUrl) {
      throw new BadRequestException('Embed URL is required');
    }

    return this.prisma.proposalVideo.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        provider: dto.provider,
        externalId: dto.externalId || '',
        embedUrl,
        thumbnailUrl,
        duration,
        proposalId: dto.proposalId ?? undefined,
        annotations: (dto.annotations || []) as any,
        ctaOverlays: (dto.ctaOverlays || []) as any,
      },
    });
  }

  // Get user's videos
  async getUserVideos(userId: string, proposalId?: string) {
    return this.prisma.proposalVideo.findMany({
      where: {
        userId,
        ...(proposalId && { proposalId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get video by ID
  async getVideo(userId: string, videoId: string) {
    const video = await this.prisma.proposalVideo.findFirst({
      where: { id: videoId, userId },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  // Get video for public viewing (no auth required)
  async getPublicVideo(videoId: string) {
    const video = await this.prisma.proposalVideo.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        title: true,
        description: true,
        provider: true,
        embedUrl: true,
        thumbnailUrl: true,
        duration: true,
        annotations: true,
        ctaOverlays: true,
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  // Update video
  async updateVideo(userId: string, videoId: string, dto: UpdateVideoDto) {
    const video = await this.getVideo(userId, videoId);

    return this.prisma.proposalVideo.update({
      where: { id: videoId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.annotations && { annotations: dto.annotations as any }),
        ...(dto.ctaOverlays && { ctaOverlays: dto.ctaOverlays as any }),
      },
    });
  }

  // Delete video
  async deleteVideo(userId: string, videoId: string) {
    await this.getVideo(userId, videoId);
    await this.prisma.proposalVideo.delete({ where: { id: videoId } });
    return { success: true };
  }

  // Attach video to proposal
  async attachToProposal(userId: string, videoId: string, proposalId: string) {
    // Verify ownership
    await this.getVideo(userId, videoId);

    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return this.prisma.proposalVideo.update({
      where: { id: videoId },
      data: { proposalId },
    });
  }

  // Get videos for a proposal
  async getProposalVideos(proposalId: string) {
    return this.prisma.proposalVideo.findMany({
      where: { proposalId },
      select: {
        id: true,
        title: true,
        description: true,
        provider: true,
        embedUrl: true,
        thumbnailUrl: true,
        duration: true,
        annotations: true,
        ctaOverlays: true,
      },
    });
  }

  // Import video from Loom
  async importFromLoom(userId: string, loomVideoId: string, proposalId?: string) {
    const videoInfo = await this.loom.getVideoInfo(userId, loomVideoId);

    return this.createVideo(userId, {
      title: videoInfo.title,
      description: videoInfo.description,
      provider: VideoProvider.LOOM,
      externalId: loomVideoId,
      embedUrl: videoInfo.embedUrl,
      thumbnailUrl: videoInfo.thumbnailUrl,
      duration: videoInfo.duration,
      proposalId,
    });
  }

  // Import video from Vidyard
  async importFromVidyard(userId: string, vidyardVideoId: string, proposalId?: string) {
    const videoInfo = await this.vidyard.getVideoInfo(userId, vidyardVideoId);

    return this.createVideo(userId, {
      title: videoInfo.title,
      description: videoInfo.description,
      provider: VideoProvider.VIDYARD,
      externalId: vidyardVideoId,
      embedUrl: videoInfo.embedUrl,
      thumbnailUrl: videoInfo.thumbnailUrl,
      duration: videoInfo.duration,
      proposalId,
    });
  }

  // Get list of videos from connected providers
  async getProviderVideos(userId: string, provider: VideoProvider) {
    switch (provider) {
      case VideoProvider.LOOM:
        return this.loom.listVideos(userId);
      case VideoProvider.VIDYARD:
        return this.vidyard.listVideos(userId);
      default:
        throw new BadRequestException(`Provider ${provider} doesn't support video listing`);
    }
  }

  // Create personalized video
  async createPersonalizedVideo(userId: string, dto: PersonalizedVideoDto) {
    const templateVideo = await this.getVideo(userId, dto.templateVideoId);

    // Create personalized version record
    const personalizedVideo = await this.prisma.personalizedVideo.create({
      data: {
        userId,
        proposalId: dto.proposalId || '',
        url: `${this.config.get('FRONTEND_URL')}/p/video/${Date.now()}`,
        slug: `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        duration: 0,
        recipientName: dto.recipientName,
        recipientCompany: dto.recipientCompany,
        customVariables: (dto.customVariables || {}) as any,
        templateVideo: { templateVideoId: dto.templateVideoId } as any,
      },
    });

    return {
      ...personalizedVideo,
      viewUrl: `${this.config.get('FRONTEND_URL')}/video/${personalizedVideo.slug}`,
    };
  }

  // Get personalized video by slug
  async getPersonalizedVideoBySlug(slug: string) {
    const pVideo = await this.prisma.personalizedVideo.findUnique({
      where: { slug },
    });

    if (!pVideo) {
      throw new NotFoundException('Video not found');
    }

    return pVideo;
  }

  // Get video analytics
  async getVideoAnalytics(userId: string, videoId: string): Promise<VideoAnalyticsDto> {
    await this.getVideo(userId, videoId);
    return this.analytics.getVideoAnalytics(videoId);
  }

  // Get aggregated video analytics for user
  async getUserVideoAnalytics(userId: string) {
    const videos = await this.prisma.proposalVideo.findMany({
      where: { userId },
      select: { id: true },
    });

    const videoIds = videos.map((v) => v.id);
    return this.analytics.getAggregatedAnalytics(videoIds);
  }

  // Provider connection management
  async connectLoom(userId: string, authorizationCode: string) {
    const tokens = await this.loom.handleOAuthCallback(authorizationCode, userId);

    await this.prisma.videoIntegration.upsert({
      where: { userId_provider: { userId, provider: 'loom' } },
      create: {
        userId,
        provider: 'loom',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
      },
    });

    return { success: true, provider: 'loom' };
  }

  async connectVidyard(userId: string, apiKey: string) {
    // Validate API key by making a test request
    await this.vidyard.validateApiKey(apiKey);

    await this.prisma.videoIntegration.upsert({
      where: { userId_provider: { userId, provider: 'vidyard' } },
      create: {
        userId,
        provider: 'vidyard',
        accessToken: apiKey, // Use apiKey as accessToken
        apiKey,
        isActive: true,
      },
      update: {
        accessToken: apiKey,
        apiKey,
        isActive: true,
      },
    });

    return { success: true, provider: 'vidyard' };
  }

  async disconnectProvider(userId: string, provider: string) {
    await this.prisma.videoIntegration.update({
      where: { userId_provider: { userId, provider } },
      data: { isActive: false },
    });

    return { success: true };
  }

  async getConnectedProviders(userId: string) {
    return this.prisma.videoIntegration.findMany({
      where: { userId, isActive: true },
      select: { provider: true, createdAt: true },
    });
  }

  // Get Loom OAuth URL
  getLoomAuthUrl(userId: string): string {
    return this.loom.getAuthorizationUrl(userId);
  }
}
