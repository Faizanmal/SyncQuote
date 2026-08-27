import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sqlNumber } from '../../common/pagination';

export interface AnalyticsMetrics {
  totalProposals: number;
  activeProposals: number;
  approvedProposals: number;
  declinedProposals: number;
  sentProposals: number;
  conversionRate: number;
  totalViews: number;
  averageViewsPerProposal: number;
  averageTimeToSignature: number; // in days
}

export interface ProposalEngagement {
  proposalId: string;
  title: string;
  status: string;
  viewCount: number;
  commentCount: number;
  firstViewedAt?: Date;
  lastViewedAt?: Date;
  createdAt: Date;
  sentAt?: Date;
  approvedAt?: Date;
}

type CountRow = Record<string, unknown>;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private rangeStart(range = '7d') {
    const start = new Date();
    switch (range) {
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setDate(start.getDate() - 7);
    }
    return start;
  }

  private firstRow<T extends CountRow>(rows: T[]): T | undefined {
    return rows[0];
  }

  async getOverviewMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsMetrics> {
    const start = startDate ?? null;
    const end = endDate ?? null;
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status::text IN ('SENT', 'VIEWED'))::int AS active,
        COUNT(*) FILTER (WHERE status::text = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status::text = 'DECLINED')::int AS declined,
        COUNT(*) FILTER (WHERE "sentAt" IS NOT NULL)::int AS sent,
        COALESCE(SUM("viewCount"), 0)::int AS views,
        AVG(
          EXTRACT(EPOCH FROM ("approvedAt" - "sentAt")) / 86400
        ) FILTER (WHERE "sentAt" IS NOT NULL AND "approvedAt" IS NOT NULL)::double precision AS avg_signature_days
      FROM "Proposal"
      WHERE "userId" = ${userId}
        AND (${start}::timestamptz IS NULL OR "createdAt" >= ${start})
        AND (${end}::timestamptz IS NULL OR "createdAt" <= ${end})
    `;

    const row = this.firstRow(rows) || {};
    const totalProposals = sqlNumber(row.total);
    const sentProposals = sqlNumber(row.sent);
    const approvedProposals = sqlNumber(row.approved);
    const totalViews = sqlNumber(row.views);
    const conversionRate = sentProposals > 0 ? (approvedProposals / sentProposals) * 100 : 0;
    const averageViewsPerProposal = totalProposals > 0 ? totalViews / totalProposals : 0;

    return {
      totalProposals,
      activeProposals: sqlNumber(row.active),
      approvedProposals,
      declinedProposals: sqlNumber(row.declined),
      sentProposals,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalViews,
      averageViewsPerProposal: Math.round(averageViewsPerProposal * 100) / 100,
      averageTimeToSignature: Math.round(sqlNumber(row.avg_signature_days) * 100) / 100,
    };
  }

  async getProposalEngagement(userId: string, limit = 10): Promise<ProposalEngagement[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const proposals = await this.prisma.proposal.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        status: true,
        viewCount: true,
        firstViewedAt: true,
        lastViewedAt: true,
        createdAt: true,
        sentAt: true,
        approvedAt: true,
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: { viewCount: 'desc' },
      take,
    });

    return proposals.map((p) => ({
      proposalId: p.id,
      title: p.title,
      status: p.status,
      viewCount: p.viewCount,
      commentCount: p._count.comments,
      firstViewedAt: p.firstViewedAt || undefined,
      lastViewedAt: p.lastViewedAt || undefined,
      createdAt: p.createdAt,
      sentAt: p.sentAt || undefined,
      approvedAt: p.approvedAt || undefined,
    }));
  }

  async getActivityTimeline(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.activity.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        proposal: {
          select: {
            title: true,
          },
        },
      },
    });
  }

  async getDashboardMetrics(userId: string, range = '7d') {
    const start = this.rangeStart(range);
    const [proposalRows, paidInvoices, sessionRows, comments] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status::text = 'APPROVED')::int AS approved,
          COALESCE(SUM("viewCount"), 0)::int AS views,
          COALESCE(SUM(COALESCE("totalAmount", "estimatedValue", 0)), 0)::double precision AS revenue
        FROM "Proposal"
        WHERE "userId" = ${userId} AND "createdAt" >= ${start}
      `,
      this.prisma.invoice.aggregate({
        where: { userId, status: { in: ['paid', 'PAID'] }, createdAt: { gte: start } },
        _sum: { amountPaid: true, totalAmount: true },
      }),
      this.prisma.$queryRaw<CountRow[]>`
        SELECT
          COALESCE(AVG(s."totalDuration"), 0)::double precision AS "avgDuration",
          COUNT(DISTINCT COALESCE(s."visitorId", s."sessionId"))::int AS "uniqueVisitors",
          COUNT(*)::int AS sessions
        FROM "ProposalViewSession" s
        INNER JOIN "Proposal" p ON p.id = s."proposalId"
        WHERE p."userId" = ${userId} AND s."startedAt" >= ${start}
      `,
      this.prisma.comment.count({
        where: { proposal: { userId }, createdAt: { gte: start } },
      }),
    ]);

    const proposal = this.firstRow(proposalRows) || {};
    const session = this.firstRow(sessionRows) || {};
    const totalProposals = sqlNumber(proposal.total);
    const approved = sqlNumber(proposal.approved);
    const totalViews = sqlNumber(proposal.views);
    const proposalRevenue = sqlNumber(proposal.revenue);
    const totalRevenue =
      paidInvoices._sum.amountPaid || paidInvoices._sum.totalAmount || proposalRevenue;
    const conversionRate = totalProposals > 0 ? (approved / totalProposals) * 100 : 0;

    return {
      totalRevenue: Math.round(sqlNumber(totalRevenue)),
      monthlyRevenue: Math.round(sqlNumber(totalRevenue)),
      totalProposals,
      approvedProposals: approved,
      conversionRate: Math.round(conversionRate * 10) / 10,
      averageViewTime: Math.round(sqlNumber(session.avgDuration)),
      totalViews,
      uniqueVisitors: sqlNumber(session.uniqueVisitors),
      activeUsers: sqlNumber(session.sessions),
      responseTime: 180,
      clientSatisfaction: comments > 0 ? 4.2 : 0,
      revenueGrowth: 0,
    };
  }

  async getTimeSeries(userId: string, range = '7d', metric = 'revenue') {
    const start = this.rangeStart(range);
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        (("createdAt" AT TIME ZONE 'UTC')::date) AS date,
        COUNT(*)::int AS proposals,
        COALESCE(SUM("viewCount"), 0)::int AS views,
        COALESCE(SUM(COALESCE("totalAmount", "estimatedValue", 0)), 0)::double precision AS revenue,
        COUNT(*) FILTER (WHERE status::text = 'APPROVED')::int AS conversions
      FROM "Proposal"
      WHERE "userId" = ${userId} AND "createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1
    `;

    const series = rows.map((row) => {
      const dateValue = row.date;
      const date =
        dateValue instanceof Date
          ? dateValue.toISOString().slice(0, 10)
          : String(dateValue).slice(0, 10);
      return {
        date,
        revenue: sqlNumber(row.revenue),
        proposals: sqlNumber(row.proposals),
        views: sqlNumber(row.views),
        conversions: sqlNumber(row.conversions),
      };
    });

    if (metric && !['revenue', 'proposals', 'views', 'conversions'].includes(metric)) {
      return series;
    }
    return series;
  }

  async getFunnelChart(userId: string, range = '7d') {
    const start = this.rangeStart(range);
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*)::int AS created,
        COUNT(*) FILTER (WHERE status::text <> 'DRAFT')::int AS sent,
        COUNT(*) FILTER (WHERE "viewCount" > 0)::int AS viewed,
        COUNT(*) FILTER (WHERE status::text = 'APPROVED')::int AS approved
      FROM "Proposal"
      WHERE "userId" = ${userId} AND "createdAt" >= ${start}
    `;
    const row = this.firstRow(rows) || {};

    return [
      { name: 'Created', value: sqlNumber(row.created), fill: '#8884d8' },
      { name: 'Sent', value: sqlNumber(row.sent), fill: '#82ca9d' },
      { name: 'Viewed', value: sqlNumber(row.viewed), fill: '#ffc658' },
      { name: 'Approved', value: sqlNumber(row.approved), fill: '#00C49F' },
    ];
  }

  async getConversionBreakdown(userId: string, range = '7d') {
    const funnel = await this.getFunnelChart(userId, range);
    const rows = [];
    for (let i = 1; i < funnel.length; i++) {
      const previous = funnel[i - 1].value || 1;
      const current = funnel[i].value;
      const percentage = previous > 0 ? (current / previous) * 100 : 0;
      rows.push({
        stage: `${funnel[i - 1].name} to ${funnel[i].name}`,
        count: current,
        percentage: Math.round(percentage * 10) / 10,
        dropoff: Math.round((100 - percentage) * 10) / 10,
      });
    }
    return rows;
  }

  async getBehavior(userId: string, range = '7d') {
    const start = this.rangeStart(range);
    const [views, comments, approved, proposals] = await Promise.all([
      this.prisma.proposalViewSession.count({
        where: { proposal: { userId }, startedAt: { gte: start } },
      }),
      this.prisma.comment.count({ where: { proposal: { userId }, createdAt: { gte: start } } }),
      this.prisma.proposal.count({
        where: { userId, status: 'APPROVED', createdAt: { gte: start } },
      }),
      this.prisma.proposal.count({ where: { userId, createdAt: { gte: start } } }),
    ]);

    const rate = (count: number) =>
      proposals > 0 ? Math.round((count / proposals) * 1000) / 10 : 0;

    return [
      { action: 'View Proposal', count: views, avgTime: 120, conversionRate: rate(views) },
      { action: 'Add Comment', count: comments, avgTime: 90, conversionRate: rate(comments) },
      { action: 'Approved', count: approved, avgTime: 180, conversionRate: rate(approved) },
    ];
  }

  async getGeographic(userId: string, range = '7d') {
    const start = this.rangeStart(range);
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COALESCE(s.country, 'Unknown') AS country,
        COUNT(*)::int AS visits,
        COUNT(*) FILTER (WHERE p.status::text = 'APPROVED')::int AS conversions,
        COALESCE(
          SUM(
            CASE
              WHEN p.status::text = 'APPROVED' THEN COALESCE(p."totalAmount", p."estimatedValue", 0)
              ELSE 0
            END
          ),
          0
        )::double precision AS revenue
      FROM "ProposalViewSession" s
      INNER JOIN "Proposal" p ON p.id = s."proposalId"
      WHERE p."userId" = ${userId} AND s."startedAt" >= ${start}
      GROUP BY 1
      ORDER BY visits DESC
    `;

    return rows.map((row) => ({
      country: String(row.country || 'Unknown'),
      visits: sqlNumber(row.visits),
      conversions: sqlNumber(row.conversions),
      revenue: sqlNumber(row.revenue),
    }));
  }

  async getConversionFunnel(userId: string) {
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*)::int AS created,
        COUNT(*) FILTER (WHERE status::text <> 'DRAFT')::int AS sent,
        COUNT(*) FILTER (WHERE "viewCount" > 0)::int AS viewed,
        COUNT(*) FILTER (WHERE status::text = 'APPROVED')::int AS approved
      FROM "Proposal"
      WHERE "userId" = ${userId}
    `;
    const row = this.firstRow(rows) || {};
    const total = sqlNumber(row.created);
    const sent = sqlNumber(row.sent);
    const viewed = sqlNumber(row.viewed);
    const approved = sqlNumber(row.approved);

    return {
      created: total,
      sent,
      viewed,
      approved,
      percentages: {
        sent: total > 0 ? Math.round((sent / total) * 100) : 0,
        viewed: sent > 0 ? Math.round((viewed / sent) * 100) : 0,
        approved: viewed > 0 ? Math.round((approved / viewed) * 100) : 0,
      },
    };
  }

  async trackProposalView(proposalId: string, metadata?: any) {
    const now = new Date();

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { firstViewedAt: true, userId: true, status: true },
    });

    if (!proposal) return;

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        viewCount: { increment: 1 },
        firstViewedAt: proposal.firstViewedAt || now,
        lastViewedAt: now,
        status: proposal.status === 'SENT' ? 'VIEWED' : proposal.status,
      },
    });

    await this.prisma.activity.create({
      data: {
        type: 'proposal_viewed',
        proposalId,
        userId: proposal.userId,
        metadata,
      },
    });
  }
}
