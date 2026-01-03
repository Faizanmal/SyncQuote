import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordScrollDto, ScrollDepthAnalyticsDto } from './dto/heatmaps.dto';

@Injectable()
export class ScrollTrackingService {
  private readonly logger = new Logger(ScrollTrackingService.name);

  constructor(private prisma: PrismaService) {}

  // Record scroll position
  async recordScroll(dto: RecordScrollDto): Promise<void> {
    try {
      await this.prisma.proposalScrollTracking.create({
        data: {
          proposalId: dto.proposalId,
          sessionId: dto.sessionId,
          scrollDepth: dto.scrollDepth,
          scrollPosition: dto.scrollPosition,
          documentHeight: dto.documentHeight,
          viewportHeight: dto.viewportHeight,
          timeSpent: dto.timeSpent,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record scroll: ${error.message}`);
      throw error;
    }
  }

  // Get scroll depth analytics
  async getScrollDepthAnalytics(proposalId: string): Promise<ScrollDepthAnalyticsDto> {
    const scrollData = await this.prisma.proposalScrollTracking.findMany({
      where: { proposalId },
      select: {
        sessionId: true,
        scrollDepth: true,
        timeSpent: true,
      },
    });

    const totalViews = new Set(scrollData.map((s) => s.sessionId)).size;

    // Get max scroll depth per session
    const maxDepthBySession = new Map<string, number>();
    for (const scroll of scrollData) {
      const current = maxDepthBySession.get(scroll.sessionId) || 0;
      maxDepthBySession.set(scroll.sessionId, Math.max(current, scroll.scrollDepth));
    }

    const depths = Array.from(maxDepthBySession.values());

    // Calculate depth buckets (0-10%, 10-20%, etc.)
    const depthBuckets = Array.from({ length: 10 }, (_, i) => ({
      depth: (i + 1) * 10,
      count: 0,
      percentage: 0,
    }));

    for (const depth of depths) {
      const bucketIndex = Math.min(Math.floor(depth / 10), 9);
      depthBuckets[bucketIndex].count++;
    }

    // Calculate percentages
    for (const bucket of depthBuckets) {
      bucket.percentage = totalViews > 0 ? (bucket.count / totalViews) * 100 : 0;
    }

    // Calculate average and median
    const avgScrollDepth =
      depths.length > 0 ? depths.reduce((sum, d) => sum + d, 0) / depths.length : 0;

    const sortedDepths = [...depths].sort((a, b) => a - b);
    const medianScrollDepth =
      sortedDepths.length > 0 ? sortedDepths[Math.floor(sortedDepths.length / 2)] : 0;

    // Find drop-off points
    const dropOffPoints = this.calculateDropOffPoints(depthBuckets, totalViews);

    return {
      proposalId,
      totalViews,
      depthBuckets,
      avgScrollDepth,
      medianScrollDepth,
      dropOffPoints,
    };
  }

  // Get scroll heatmap data
  async getScrollHeatmapData(proposalId: string): Promise<Array<{ y: number; value: number }>> {
    const scrollData = await this.prisma.proposalScrollTracking.findMany({
      where: { proposalId },
      select: { scrollPosition: true, timeSpent: true },
    });

    // Group by Y position buckets
    const grid = new Map<number, { count: number; totalTime: number }>();
    const bucketSize = 50; // 50px buckets

    for (const scroll of scrollData) {
      const bucketY = Math.floor(scroll.scrollPosition / bucketSize) * bucketSize;

      if (!grid.has(bucketY)) {
        grid.set(bucketY, { count: 0, totalTime: 0 });
      }

      const bucket = grid.get(bucketY)!;
      bucket.count++;
      bucket.totalTime += scroll.timeSpent || 0;
    }

    // Convert to heatmap data with attention weighting
    return Array.from(grid.entries()).map(([y, data]) => ({
      y,
      value: data.count + data.totalTime / 1000, // Weight by time spent
    }));
  }

  // Get sections by scroll depth
  async getSectionViewRates(
    proposalId: string,
    sections: Array<{ name: string; startY: number; endY: number }>,
  ) {
    const scrollData = await this.prisma.proposalScrollTracking.findMany({
      where: { proposalId },
      select: {
        sessionId: true,
        scrollPosition: true,
        timeSpent: true,
      },
    });

    const sessionMaxScrolls = new Map<string, number>();
    for (const scroll of scrollData) {
      const current = sessionMaxScrolls.get(scroll.sessionId) || 0;
      sessionMaxScrolls.set(scroll.sessionId, Math.max(current, scroll.scrollPosition));
    }

    const totalSessions = sessionMaxScrolls.size;

    return sections.map((section) => {
      let viewedCount = 0;
      let totalTime = 0;

      for (const [sessionId, maxScroll] of sessionMaxScrolls) {
        if (maxScroll >= section.startY) {
          viewedCount++;

          // Calculate time spent in this section
          const sectionScrolls = scrollData.filter(
            (s) =>
              s.sessionId === sessionId &&
              s.scrollPosition >= section.startY &&
              s.scrollPosition <= section.endY,
          );
          totalTime += sectionScrolls.reduce((sum, s) => sum + (s.timeSpent || 0), 0);
        }
      }

      return {
        section: section.name,
        viewRate: totalSessions > 0 ? (viewedCount / totalSessions) * 100 : 0,
        avgTimeSpent: viewedCount > 0 ? totalTime / viewedCount / 1000 : 0, // Convert to seconds
      };
    });
  }

  // Private helper to calculate drop-off points
  private calculateDropOffPoints(
    depthBuckets: Array<{ depth: number; count: number; percentage: number }>,
    totalViews: number,
  ): Array<{ depth: number; dropOffRate: number }> {
    const dropOffs: Array<{ depth: number; dropOffRate: number }> = [];

    for (let i = 0; i < depthBuckets.length - 1; i++) {
      const current = depthBuckets[i];
      const next = depthBuckets[i + 1];

      const dropOff = current.count - next.count;
      const dropOffRate = current.count > 0 ? (dropOff / current.count) * 100 : 0;

      // Only include significant drop-offs (> 20%)
      if (dropOffRate > 20) {
        dropOffs.push({
          depth: current.depth,
          dropOffRate,
        });
      }
    }

    return dropOffs.sort((a, b) => b.dropOffRate - a.dropOffRate);
  }
}
