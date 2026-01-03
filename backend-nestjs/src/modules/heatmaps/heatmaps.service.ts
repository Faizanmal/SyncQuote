import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClickTrackingService } from './click-tracking.service';
import { ScrollTrackingService } from './scroll-tracking.service';
import { PredictiveScoringService } from './predictive-scoring.service';
import {
  GetHeatmapDto,
  HeatmapResponseDto,
  HeatmapType,
  EngagementMetricsDto,
  AttentionHeatmapDto,
  RealTimeStatsDto,
  RecordEngagementDto,
} from './dto/heatmaps.dto';

@Injectable()
export class HeatmapsService {
  private readonly logger = new Logger(HeatmapsService.name);

  constructor(
    private prisma: PrismaService,
    private clickTracking: ClickTrackingService,
    private scrollTracking: ScrollTrackingService,
    private predictiveScoring: PredictiveScoringService,
  ) {}

  // Generate heatmap data
  async generateHeatmap(userId: string, dto: GetHeatmapDto): Promise<HeatmapResponseDto> {
    // Verify ownership
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    let dataPoints: any[] = [];

    switch (dto.type) {
      case HeatmapType.CLICK:
        dataPoints = await this.clickTracking.getClickHeatmapData(dto.proposalId);
        break;

      case HeatmapType.SCROLL:
        const scrollData = await this.scrollTracking.getScrollHeatmapData(dto.proposalId);
        dataPoints = scrollData.map((d) => ({ x: 0, y: d.y, value: d.value }));
        break;

      case HeatmapType.ATTENTION:
        dataPoints = await this.generateAttentionHeatmap(dto.proposalId);
        break;

      case HeatmapType.MOVEMENT:
        dataPoints = await this.generateMovementHeatmap(dto.proposalId);
        break;
    }

    // Get session statistics
    const interactions = await this.prisma.proposalInteraction.findMany({
      where: { proposalId: dto.proposalId },
      select: { sessionId: true },
    });

    const uniqueSessions = new Set(interactions.map((i) => i.sessionId)).size;

    return {
      proposalId: dto.proposalId,
      type: dto.type,
      dataPoints,
      totalInteractions: interactions.length,
      uniqueSessions,
      width: dto.width || 1920,
      height: dto.height || 1080,
      generatedAt: new Date(),
    };
  }

  // Get comprehensive engagement metrics
  async getEngagementMetrics(userId: string, proposalId: string): Promise<EngagementMetricsDto> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Get all sessions
    const sessions = await this.prisma.proposalInteraction.groupBy({
      by: ['sessionId'],
      where: { proposalId },
      _count: true,
    });

    const totalViews = sessions.length;
    const uniqueVisitors = totalViews; // Simplified - should track by user

    // Get scroll data per session
    const scrollData = await this.prisma.proposalScrollTracking.groupBy({
      by: ['sessionId'],
      where: { proposalId },
      _max: { scrollDepth: true },
      _sum: { timeSpent: true },
    });

    // Calculate time metrics
    const timeSpents = scrollData.map((s) => (s._sum.timeSpent || 0) / 1000).filter((t) => t > 0);
    const avgTimeSpent =
      timeSpents.length > 0 ? timeSpents.reduce((sum, t) => sum + t, 0) / timeSpents.length : 0;

    const sortedTimes = [...timeSpents].sort((a, b) => a - b);
    const medianTimeSpent =
      sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;

    // Calculate scroll depth
    const scrollDepths = scrollData.map((s) => s._max.scrollDepth || 0);
    const avgScrollDepth =
      scrollDepths.length > 0
        ? scrollDepths.reduce((sum, d) => sum + d, 0) / scrollDepths.length
        : 0;

    // Calculate bounce rate (< 10 seconds)
    const bounces = timeSpents.filter((t) => t < 10).length;
    const bounceRate = totalViews > 0 ? (bounces / totalViews) * 100 : 0;

    // Calculate engagement rate (meaningful interaction)
    const engagedSessions = scrollData.filter(
      (s) => (s._sum.timeSpent || 0) >= 30000 && (s._max.scrollDepth || 0) >= 30,
    ).length;
    const engagementRate = totalViews > 0 ? (engagedSessions / totalViews) * 100 : 0;

    // Calculate conversion rate
    const conversions = await this.prisma.proposal.count({
      where: {
        id: proposalId,
        status: 'APPROVED', // Assuming this status exists
      },
    });
    const conversionRate = totalViews > 0 ? (conversions / totalViews) * 100 : 0;

    // Get section performance
    const topPerformingSections = await this.getTopPerformingSections(proposalId);

    return {
      proposalId,
      totalViews,
      uniqueVisitors,
      avgTimeSpent,
      medianTimeSpent,
      avgScrollDepth,
      bounceRate,
      engagementRate,
      conversionRate,
      topPerformingSections,
    };
  }

  // Get attention heatmap by sections
  async getAttentionHeatmap(userId: string, proposalId: string): Promise<AttentionHeatmapDto> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Get interactions grouped by section
    const interactions = await this.prisma.proposalInteraction.findMany({
      where: { proposalId },
      select: {
        sessionId: true,
        metadata: true,
        timestamp: true,
      },
    });

    // Group by section
    const sectionMap = new Map<string, any>();

    for (const interaction of interactions) {
      const metadata = (interaction.metadata || {}) as Record<string, any>;
      const section = metadata.section || 'unknown';

      if (!sectionMap.has(section)) {
        sectionMap.set(section, {
          sessions: new Set(),
          interactions: 0,
          dwellTimes: [],
        });
      }

      const data = sectionMap.get(section);
      data.sessions.add(interaction.sessionId);
      data.interactions++;

      if (metadata.dwellTime) {
        data.dwellTimes.push(metadata.dwellTime);
      }
    }

    const totalSessions = new Set(interactions.map((i) => i.sessionId)).size;

    const sections = Array.from(sectionMap.entries())
      .map(([sectionId, data]) => {
        const avgDwellTime =
          data.dwellTimes.length > 0
            ? data.dwellTimes.reduce((sum: number, t: number) => sum + t, 0) /
              data.dwellTimes.length
            : 0;

        const viewRate = totalSessions > 0 ? (data.sessions.size / totalSessions) * 100 : 0;
        const interactionRate =
          data.sessions.size > 0 ? (data.interactions / data.sessions.size) * 100 : 0;

        // Calculate attention score (0-100)
        const attentionScore = Math.min(
          100,
          viewRate * 0.3 + interactionRate * 0.3 + Math.min(avgDwellTime / 100, 40),
        );

        return {
          sectionId,
          sectionName: sectionId,
          attentionScore,
          avgDwellTime,
          viewRate,
          interactionRate,
        };
      })
      .sort((a, b) => b.attentionScore - a.attentionScore);

    return {
      proposalId,
      sections,
    };
  }

  // Get real-time analytics
  async getRealTimeStats(
    userId: string,
    proposalId: string,
    lastMinutes: number = 5,
  ): Promise<RealTimeStatsDto> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const since = new Date(Date.now() - lastMinutes * 60 * 1000);

    // Get recent interactions
    const recentInteractions = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        timestamp: { gte: since },
      },
      select: {
        sessionId: true,
        metadata: true,
      },
    });

    const currentViewers = new Set(recentInteractions.map((i) => i.sessionId)).size;

    // Get recent views (unique sessions)
    const recentViews = currentViewers;

    // Get recent conversions (simplified)
    const recentConversions = 0; // Would need conversion tracking

    // Calculate avg engagement score for active sessions
    const avgEngagementScore = await this.calculateAvgEngagementScore(proposalId, since);

    // Group by country
    const countryMap = new Map<string, number>();
    for (const interaction of recentInteractions) {
      const metadata = (interaction.metadata || {}) as Record<string, any>;
      const country = metadata.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    }

    const activeRegions = Array.from(countryMap.entries())
      .map(([country, viewers]) => ({ country, viewers }))
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, 5);

    // Group by device
    const devices = { desktop: 0, mobile: 0, tablet: 0 };
    for (const interaction of recentInteractions) {
      const metadata = (interaction.metadata || {}) as Record<string, any>;
      const device = metadata.deviceType || 'desktop';
      if (device in devices) {
        devices[device as keyof typeof devices]++;
      }
    }

    return {
      proposalId,
      currentViewers,
      recentViews,
      recentConversions,
      avgEngagementScore,
      activeRegions,
      devices,
    };
  }

  // Record engagement summary
  async recordEngagement(dto: RecordEngagementDto): Promise<void> {
    await this.prisma.proposalEngagement.create({
      data: {
        proposalId: dto.proposalId,
        sessionId: dto.sessionId,
        timeSpent: dto.timeSpent,
        maxScrollDepth: dto.maxScrollDepth,
        clicks: dto.clicks || 0,
        hovers: dto.hovers || 0,
        videoWatched: dto.videoWatched || false,
        pricingViewed: dto.pricingViewed || false,
        sectionsViewed: dto.sectionsViewed || [],
      },
    });
  }

  // Private helper methods
  private async generateAttentionHeatmap(proposalId: string): Promise<any[]> {
    // Combine click, scroll, and hover data with time weighting
    const clicks = await this.clickTracking.getClickHeatmapData(proposalId);
    const scrollData = await this.scrollTracking.getScrollHeatmapData(proposalId);

    // Weight clicks heavily, scroll moderately
    const combined = clicks.map((c) => ({ ...c, value: c.value * 3 }));

    for (const scroll of scrollData) {
      combined.push({ x: 0, y: scroll.y, value: scroll.value });
    }

    return combined;
  }

  private async generateMovementHeatmap(proposalId: string): Promise<any[]> {
    // Get hover interactions
    const hovers = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        type: 'hover',
      },
      select: { x: true, y: true },
    });

    // Group by proximity
    const grid = new Map<string, number>();
    const gridSize = 30;

    for (const hover of hovers) {
      const gridX = Math.floor(hover.x / gridSize) * gridSize;
      const gridY = Math.floor(hover.y / gridSize) * gridSize;
      const key = `${gridX},${gridY}`;

      grid.set(key, (grid.get(key) || 0) + 1);
    }

    return Array.from(grid.entries()).map(([key, count]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value: count };
    });
  }

  private async getTopPerformingSections(proposalId: string) {
    // Simplified - would need section definitions
    return [];
  }

  private async calculateAvgEngagementScore(proposalId: string, since: Date): Promise<number> {
    // Get recent sessions
    const sessions = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        timestamp: { gte: since },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });

    if (sessions.length === 0) return 0;

    // Calculate score for each session
    let totalScore = 0;
    for (const session of sessions) {
      const score = await this.predictiveScoring.calculatePredictiveScore(
        proposalId,
        session.sessionId,
      );
      totalScore += score.engagementScore;
    }

    return totalScore / sessions.length;
  }
}
