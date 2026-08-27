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
      this.logger.error(`Failed to record interaction: ${(error as Error).message}`);
      throw error;
    }
  }

  // Get click analytics for a proposal
  async getClickAnalytics(proposalId: string): Promise<ClickAnalyticsDto> {
    const [totals, topRows, sectionRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ totalClicks: unknown; uniqueElements: unknown }>>`
        SELECT
          COUNT(*)::int AS "totalClicks",
          COUNT(DISTINCT COALESCE("elementId", CONCAT("elementType", ':', "elementText")))::int AS "uniqueElements"
        FROM "ProposalInteraction"
        WHERE "proposalId" = ${proposalId} AND type = ${InteractionType.CLICK}
      `,
      this.prisma.$queryRaw<
        Array<{
          elementId: string | null;
          elementType: string | null;
          elementText: string | null;
          clicks: unknown;
          uniqueUsers: unknown;
        }>
      >`
        SELECT
          "elementId",
          "elementType",
          "elementText",
          COUNT(*)::int AS clicks,
          COUNT(DISTINCT "sessionId")::int AS "uniqueUsers"
        FROM "ProposalInteraction"
        WHERE "proposalId" = ${proposalId} AND type = ${InteractionType.CLICK}
        GROUP BY 1, 2, 3
        ORDER BY clicks DESC
        LIMIT 20
      `,
      this.prisma.$queryRaw<Array<{ section: string; clicks: unknown }>>`
        SELECT
          COALESCE(metadata->>'section', 'unknown') AS section,
          COUNT(*)::int AS clicks
        FROM "ProposalInteraction"
        WHERE "proposalId" = ${proposalId} AND type = ${InteractionType.CLICK}
        GROUP BY 1
      `,
    ]);

    const summary = totals[0];
    const clicksBySection: Record<string, number> = {};
    for (const row of sectionRows) {
      clicksBySection[row.section || 'unknown'] = Number(row.clicks) || 0;
    }

    return {
      proposalId,
      totalClicks: Number(summary?.totalClicks) || 0,
      uniqueElements: Number(summary?.uniqueElements) || 0,
      topElements: topRows.map((element) => ({
        elementId: element.elementId || undefined,
        elementType: element.elementType || 'unknown',
        elementText: element.elementText || undefined,
        clicks: Number(element.clicks) || 0,
        uniqueUsers: Number(element.uniqueUsers) || 0,
        avgTimeBeforeClick: 0,
      })),
      clicksBySection,
    };
  }

  // Get click heatmap data points
  async getClickHeatmapData(
    proposalId: string,
  ): Promise<Array<{ x: number; y: number; value: number }>> {
    const gridSize = 20;
    const rows = await this.prisma.$queryRaw<Array<{ x: unknown; y: unknown; value: unknown }>>`
      SELECT
        (FLOOR(x / ${gridSize}) * ${gridSize})::int AS x,
        (FLOOR(y / ${gridSize}) * ${gridSize})::int AS y,
        COUNT(*)::int AS value
      FROM "ProposalInteraction"
      WHERE "proposalId" = ${proposalId} AND type = ${InteractionType.CLICK}
      GROUP BY 1, 2
    `;

    return rows.map((row) => ({
      x: Number(row.x) || 0,
      y: Number(row.y) || 0,
      value: Number(row.value) || 0,
    }));
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
      this.logger.error(`Failed to record batch interactions: ${(error as Error).message}`);
      throw error;
    }
  }
}
