import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideoViewEventDto, VideoAnalyticsDto } from './dto/video.dto';

@Injectable()
export class VideoAnalyticsService {
  private readonly logger = new Logger(VideoAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  // Track video view event
  async trackEvent(dto: VideoViewEventDto, viewerInfo?: { ip?: string; userAgent?: string }) {
    // Get or create session by videoId and sessionId combination
    let session = await this.prisma.videoViewSession.findFirst({
      where: {
        videoId: dto.videoId,
        sessionId: dto.sessionId,
      },
    });

    if (!session) {
      session = await this.prisma.videoViewSession.create({
        data: {
          sessionId: dto.sessionId,
          videoId: dto.videoId,
          ipAddress: viewerInfo?.ip,
          startedAt: new Date(),
        },
      });
    }

    // Create event record
    await this.prisma.videoViewEvent.create({
      data: {
        sessionId: session.id,
        videoId: dto.videoId,
        userAgent: viewerInfo?.userAgent,
        duration: dto.currentTime || 0,
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    // Update session stats
    if (dto.event === 'play' || dto.event === 'progress') {
      await this.prisma.videoViewSession.update({
        where: { id: session.id },
        data: {
          watchDuration: dto.currentTime || 0,
          lastWatchedAt: new Date(),
        },
      });
    }

    // Track completion
    if (dto.event === 'complete') {
      await this.prisma.videoViewSession.update({
        where: { id: session.id },
        data: {
          completed: true,
        },
      });
    }

    // Track CTA clicks
    if (dto.event === 'cta_click' && dto.ctaId) {
      await this.prisma.videoCtaClick.create({
        data: {
          sessionId: session.id,
          videoId: dto.videoId,
          ctaText: dto.ctaId,
          timestamp: Math.floor((dto.currentTime || 0) * 1000),
        },
      });
    }

    return { success: true };
  }

  // Get analytics for a single video
  async getVideoAnalytics(videoId: string): Promise<VideoAnalyticsDto> {
    const sessions = await this.prisma.videoViewSession.findMany({
      where: { videoId },
    });

    const video = await this.prisma.proposalVideo.findUnique({
      where: { id: videoId },
    });

    const totalViews = sessions.length;
    const uniqueViewers = new Set(sessions.map((s) => s.ipAddress || s.sessionId)).size;
    const totalWatchTime = sessions.reduce((sum, s) => sum + (s.maxWatchTime || 0), 0);
    const completedSessions = sessions.filter((s) => s.completed);
    const ctaClicksArray = sessions
      .map((s) => (Array.isArray(s.ctaClicks) ? s.ctaClicks.length : 0))
      .reduce((sum, count) => sum + count, 0);

    // Calculate drop-off points (every 10%)
    const dropOffPoints = this.calculateDropOffPoints(sessions);

    // Get views by day (last 30 days)
    const viewsByDay = await this.getViewsByDay(videoId, 30);

    return {
      videoId,
      totalViews,
      uniqueViewers,
      totalWatchTime,
      averageWatchTime: totalViews > 0 ? totalWatchTime / totalViews : 0,
      completionRate: totalViews > 0 ? (completedSessions.length / totalViews) * 100 : 0,
      engagementScore: this.calculateEngagementScore(sessions, video?.duration || 0),
      ctaClicks: ctaClicksArray,
      ctaClickRate: totalViews > 0 ? (ctaClicksArray / totalViews) * 100 : 0,
      dropOffPoints,
      viewsByDay,
    };
  }

  // Get aggregated analytics for multiple videos
  async getAggregatedAnalytics(videoIds: string[]) {
    if (videoIds.length === 0) {
      return {
        totalViews: 0,
        totalWatchTime: 0,
        averageCompletionRate: 0,
        totalCtaClicks: 0,
        topVideos: [],
      };
    }

    const sessions = await this.prisma.videoViewSession.groupBy({
      by: ['videoId'],
      where: { videoId: { in: videoIds } },
      _count: { id: true },
      _avg: { watchPercentage: true },
      _sum: { maxWatchTime: true },
    });

    const ctaClicks = await this.prisma.videoCtaClick.groupBy({
      by: ['videoId'],
      where: { videoId: { in: videoIds } },
      _count: { id: true },
    });

    const videos = await this.prisma.proposalVideo.findMany({
      where: { id: { in: videoIds } },
      select: { id: true, title: true },
    });

    const videoMap = new Map(videos.map((v) => [v.id, v.title]));
    const ctaMap = new Map(ctaClicks.map((c) => [c.videoId, c._count.id]));

    const topVideos = sessions
      .map((s: any) => ({
        videoId: s.videoId,
        title: videoMap.get(s.videoId) || 'Unknown',
        views: s._count.id,
        avgCompletion: s._avg.watchPercentage || 0,
        watchTime: s._sum.maxWatchTime || 0,
        ctaClicks: ctaMap.get(s.videoId) || 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return {
      totalViews: sessions.reduce((sum, s) => sum + s._count.id, 0),
      totalWatchTime: sessions.reduce((sum, s) => sum + (s._sum.maxWatchTime || 0), 0),
      averageCompletionRate:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s._avg.watchPercentage || 0), 0) / sessions.length
          : 0,
      totalCtaClicks: ctaClicks.reduce((sum, c) => sum + c._count.id, 0),
      topVideos,
    };
  }

  // Private helper methods
  private calculateDropOffPoints(
    sessions: any[],
  ): Array<{ timestamp: number; dropOffRate: number }> {
    const points: Array<{ timestamp: number; dropOffRate: number }> = [];

    for (let percent = 10; percent <= 100; percent += 10) {
      const sessionsReaching = sessions.filter((s) => (s.watchPercentage || 0) >= percent);
      const dropOffRate =
        sessions.length > 0
          ? ((sessions.length - sessionsReaching.length) / sessions.length) * 100
          : 0;

      points.push({ timestamp: percent, dropOffRate });
    }

    return points;
  }

  private async getViewsByDay(
    videoId: string,
    days: number,
  ): Promise<Array<{ date: string; views: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const views = await this.prisma.videoViewSession.groupBy({
      by: ['startedAt'],
      where: {
        videoId,
        startedAt: { gte: startDate },
      },
      _count: { id: true },
    });

    // Group by date
    const viewsByDate = new Map<string, number>();
    views.forEach((v) => {
      const date = v.startedAt.toISOString().split('T')[0];
      viewsByDate.set(date, (viewsByDate.get(date) || 0) + v._count.id);
    });

    // Fill in missing dates
    const result: Array<{ date: string; views: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        views: viewsByDate.get(dateStr) || 0,
      });
    }

    return result;
  }

  private calculateEngagementScore(sessions: any[], videoDuration: number): number {
    if (sessions.length === 0 || videoDuration === 0) return 0;

    let score = 0;

    // Average completion contributes 40%
    const avgCompletion =
      sessions.reduce((sum, s) => sum + (s.watchPercentage || 0), 0) / sessions.length;
    score += (avgCompletion / 100) * 40;

    // Completion rate contributes 30%
    const completionRate = sessions.filter((s) => s.completed).length / sessions.length;
    score += completionRate * 30;

    // CTA engagement contributes 30%
    const sessionsWithCtaClicks = sessions.filter((s) => s.ctaClicks?.length > 0).length;
    const ctaEngagement = sessionsWithCtaClicks / sessions.length;
    score += ctaEngagement * 30;

    return Math.round(score);
  }
}
