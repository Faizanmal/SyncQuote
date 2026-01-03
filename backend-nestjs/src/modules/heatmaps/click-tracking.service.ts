import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordInteractionDto, ClickAnalyticsDto, InteractionType } from './dto/heatmaps.dto';

@Injectable()
export class ClickTrackingService {
  private readonly logger = new Logger(ClickTrackingService.name);

  constructor(private prisma: PrismaService) {}

  // Record a click or interaction
  async recordInteraction(dto: RecordInteractionDto): Promise<void> {
    try {
      await this.prisma.proposalInteraction.create({
        data: {
          proposalId: dto.proposalId,
          sessionId: dto.sessionId,
          type: dto.type,
          elementId: dto.elementId,
          elementType: dto.elementType,
          elementText: dto.elementText,
          x: dto.x,
          y: dto.y,
          scrollDepth: dto.scrollDepth,
          viewportWidth: dto.viewportWidth,
          viewportHeight: dto.viewportHeight,
          timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
          metadata: dto.metadata || {},
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record interaction: ${error.message}`);
      throw error;
    }
  }

  // Get click analytics for a proposal
  async getClickAnalytics(proposalId: string): Promise<ClickAnalyticsDto> {
    const clicks = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        type: InteractionType.CLICK,
      },
      select: {
        elementId: true,
        elementType: true,
        elementText: true,
        sessionId: true,
        timestamp: true,
        metadata: true,
      },
    });

    const totalClicks = clicks.length;
    const uniqueSessions = new Set(clicks.map((c) => c.sessionId)).size;

    // Group by element
    const elementMap = new Map<string, any>();

    for (const click of clicks) {
      const key = click.elementId || `${click.elementType}:${click.elementText}`;

      if (!elementMap.has(key)) {
        elementMap.set(key, {
          elementId: click.elementId,
          elementType: click.elementType || 'unknown',
          elementText: click.elementText,
          clicks: 0,
          sessions: new Set(),
          timestamps: [],
        });
      }

      const element = elementMap.get(key);
      element.clicks++;
      element.sessions.add(click.sessionId);
      element.timestamps.push(click.timestamp);
    }

    // Calculate top elements
    const topElements = Array.from(elementMap.values())
      .map((element: any) => {
        // Calculate avg time before click (from session start)
        const avgTime = this.calculateAvgTimeBeforeClick(element.timestamps);

        return {
          elementId: element.elementId,
          elementType: element.elementType,
          elementText: element.elementText,
          clicks: element.clicks,
          uniqueUsers: element.sessions.size,
          avgTimeBeforeClick: avgTime,
        };
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    // Group by section (from metadata if available)
    const clicksBySection: Record<string, number> = {};
    for (const click of clicks) {
      const metadata = (click.metadata || {}) as Record<string, any>;
      const section = metadata.section || 'unknown';
      clicksBySection[section] = (clicksBySection[section] || 0) + 1;
    }

    return {
      proposalId,
      totalClicks,
      uniqueElements: elementMap.size,
      topElements,
      clicksBySection,
    };
  }

  // Get click heatmap data points
  async getClickHeatmapData(
    proposalId: string,
  ): Promise<Array<{ x: number; y: number; value: number }>> {
    const clicks = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        type: InteractionType.CLICK,
      },
      select: { x: true, y: true, viewportWidth: true, viewportHeight: true },
    });

    // Normalize coordinates and group by proximity
    const grid = new Map<string, number>();
    const gridSize = 20; // Group clicks in 20px buckets

    for (const click of clicks) {
      const gridX = Math.floor(click.x / gridSize) * gridSize;
      const gridY = Math.floor(click.y / gridSize) * gridSize;
      const key = `${gridX},${gridY}`;

      grid.set(key, (grid.get(key) || 0) + 1);
    }

    // Convert to data points
    return Array.from(grid.entries()).map(([key, count]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value: count };
    });
  }

  // Get most clicked elements
  async getMostClickedElements(proposalId: string, limit: number = 10) {
    const clicks = await this.prisma.proposalInteraction.groupBy({
      by: ['elementId', 'elementType', 'elementText'],
      where: {
        proposalId,
        type: InteractionType.CLICK,
        elementId: { not: null },
      },
      _count: true,
      orderBy: { _count: { elementId: 'desc' } },
      take: limit,
    });

    return clicks.map((click) => ({
      elementId: click.elementId,
      elementType: click.elementType,
      elementText: click.elementText,
      clicks: click._count,
    }));
  }

  // Private helper
  private calculateAvgTimeBeforeClick(timestamps: Date[]): number {
    if (timestamps.length === 0) return 0;

    // Group by session and calculate time from session start
    // For now, simplified - return 0
    return 0;
  }

  // Batch record interactions
  async recordInteractionsBatch(interactions: RecordInteractionDto[]): Promise<void> {
    try {
      await this.prisma.proposalInteraction.createMany({
        data: interactions.map((dto) => ({
          proposalId: dto.proposalId,
          sessionId: dto.sessionId,
          type: dto.type,
          elementId: dto.elementId,
          elementType: dto.elementType,
          elementText: dto.elementText,
          x: dto.x,
          y: dto.y,
          scrollDepth: dto.scrollDepth,
          viewportWidth: dto.viewportWidth,
          viewportHeight: dto.viewportHeight,
          timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
          metadata: dto.metadata || {},
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to record batch interactions: ${error.message}`);
      throw error;
    }
  }
}
