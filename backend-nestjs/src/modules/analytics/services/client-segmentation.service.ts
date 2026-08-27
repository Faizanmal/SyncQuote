import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface ClientSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  clientCount: number;
  totalValue: number;
  averageValue: number;
  conversionRate: number;
  clients: ClientSegmentMember[];
}

export interface SegmentCriteria {
  minValue?: number;
  maxValue?: number;
  industries?: string[];
  proposalCountMin?: number;
  proposalCountMax?: number;
  winRateMin?: number;
  winRateMax?: number;
  lastActivityDays?: number;
  engagementLevel?: 'high' | 'medium' | 'low';
}

export interface ClientSegmentMember {
  id: string;
  email: string;
  name: string;
  company: string;
  totalValue: number;
  proposalCount: number;
  wonCount: number;
  winRate: number;
  lastActivity: Date;
  engagementScore: number;
  totalViews: number;
}

export interface PerformanceBenchmark {
  metric: string;
  yourValue: number;
  industryAverage: number;
  topPerformers: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

@Injectable()
export class ClientSegmentationService {
  private readonly logger = new Logger(ClientSegmentationService.name);
  private segmentCache: Map<string, ClientSegment[]> = new Map();

  // Industry benchmark data (in production, this would come from aggregated data)
  private readonly industryBenchmarks = {
    conversionRate: { average: 25, topPerformers: 45 },
    avgDealSize: { average: 8500, topPerformers: 25000 },
    responseTime: { average: 48, topPerformers: 12 }, // hours
    proposalsPerMonth: { average: 15, topPerformers: 50 },
    winRate: { average: 30, topPerformers: 55 },
    avgTimeToClose: { average: 14, topPerformers: 5 }, // days
    clientRetention: { average: 65, topPerformers: 90 },
    upsellRate: { average: 15, topPerformers: 35 },
  };

  constructor(private readonly prisma: PrismaService) {}

  async getClientSegments(userId: string): Promise<ClientSegment[]> {
    const cacheKey = `segments:${userId}`;
    if (this.segmentCache.has(cacheKey)) {
      return this.segmentCache.get(cacheKey)!;
    }

    const segments = await this.generateClientSegments(userId);
    this.segmentCache.set(cacheKey, segments);

    // Cache expires after 1 hour
    setTimeout(() => this.segmentCache.delete(cacheKey), 3600000);

    return segments;
  }

  async generateClientSegments(userId: string): Promise<ClientSegment[]> {
    this.logger.log(`Generating client segments for user ${userId}`);

    // Get all clients with their proposal data
    const clientData = await this.getClientData(userId);

    // Define standard segments
    const segments: ClientSegment[] = [
      await this.createSegment(
        'high-value',
        'High Value Clients',
        'Clients with total value above $50,000',
        { minValue: 50000 },
        clientData,
      ),

      await this.createSegment(
        'frequent-buyers',
        'Frequent Buyers',
        'Clients with 3+ proposals',
        { proposalCountMin: 3 },
        clientData,
      ),

      await this.createSegment(
        'high-engagement',
        'Highly Engaged',
        'Clients with high engagement scores',
        { engagementLevel: 'high' },
        clientData,
      ),

      await this.createSegment(
        'at-risk',
        'At Risk',
        'Clients with no activity in 90+ days',
        { lastActivityDays: 90 },
        clientData,
      ),

      await this.createSegment(
        'new-clients',
        'New Clients',
        'Clients acquired in the last 30 days',
        { lastActivityDays: -30 },
        clientData,
      ), // Negative means within last X days

      await this.createSegment(
        'high-conversion',
        'High Conversion',
        'Clients with 50%+ win rate',
        { winRateMin: 50 },
        clientData,
      ),

      await this.createSegment(
        'enterprise',
        'Enterprise',
        'High-value clients with multiple projects',
        { minValue: 100000, proposalCountMin: 5 },
        clientData,
      ),
    ];

    return segments.filter((s) => s.clientCount > 0);
  }

  private async getClientData(userId: string): Promise<Map<string, ClientSegmentMember>> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        email: string;
        name: string | null;
        proposalCount: unknown;
        wonCount: unknown;
        totalValue: unknown;
        totalViews: unknown;
        lastActivity: Date | null;
      }>
    >`
      SELECT
        "recipientEmail" AS email,
        MAX("recipientName") AS name,
        COUNT(*)::int AS "proposalCount",
        COUNT(*) FILTER (WHERE status::text IN ('APPROVED', 'SIGNED'))::int AS "wonCount",
        COALESCE(
          SUM(
            CASE
              WHEN status::text IN ('APPROVED', 'SIGNED')
                THEN COALESCE("totalAmount", "estimatedValue", 0)
              ELSE 0
            END
          ),
          0
        )::double precision AS "totalValue",
        COALESCE(SUM("viewCount"), 0)::int AS "totalViews",
        MAX(COALESCE("signedAt", "approvedAt", "updatedAt")) AS "lastActivity"
      FROM "Proposal"
      WHERE "userId" = ${userId}
        AND "recipientEmail" IS NOT NULL
      GROUP BY "recipientEmail"
    `;

    const clientMap = new Map<string, ClientSegmentMember>();

    for (const row of rows) {
      const proposalCount = Number(row.proposalCount) || 0;
      const wonCount = Number(row.wonCount) || 0;
      const client: ClientSegmentMember = {
        id: row.email,
        email: row.email,
        name: row.name || 'Unknown',
        company: '',
        totalValue: Number(row.totalValue) || 0,
        proposalCount,
        wonCount,
        winRate: proposalCount > 0 ? (wonCount / proposalCount) * 100 : 0,
        lastActivity: row.lastActivity || new Date(0),
        engagementScore: 0,
        totalViews: Number(row.totalViews) || 0,
      };
      client.engagementScore = this.calculateEngagementScore(client);
      clientMap.set(row.email, client);
    }

    return clientMap;
  }

  private calculateEngagementScore(client: any): number {
    let score = 0;

    // Views per proposal
    const viewsPerProposal = client.totalViews / Math.max(client.proposalCount, 1);
    score += Math.min(viewsPerProposal * 5, 25);

    // Win rate contribution
    score += client.winRate * 0.3;

    // Recency (days since last activity)
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(client.lastActivity).getTime()) / (1000 * 60 * 60 * 24),
    );
    score += Math.max(0, 25 - daysSinceActivity);

    // Volume
    score += Math.min(client.proposalCount * 3, 20);

    return Math.min(Math.round(score), 100);
  }

  private async createSegment(
    id: string,
    name: string,
    description: string,
    criteria: SegmentCriteria,
    clientData: Map<string, ClientSegmentMember>,
  ): Promise<ClientSegment> {
    const clients = Array.from(clientData.values()).filter((client) =>
      this.matchesCriteria(client, criteria),
    );

    const totalValue = clients.reduce((sum, c) => sum + c.totalValue, 0);
    const totalProposals = clients.reduce((sum, c) => sum + c.proposalCount, 0);
    const wonProposals = clients.filter((c) => c.winRate > 0).length;

    return {
      id,
      name,
      description,
      criteria,
      clientCount: clients.length,
      totalValue,
      averageValue: clients.length > 0 ? totalValue / clients.length : 0,
      conversionRate: totalProposals > 0 ? (wonProposals / totalProposals) * 100 : 0,
      clients,
    };
  }

  private matchesCriteria(client: ClientSegmentMember, criteria: SegmentCriteria): boolean {
    if (criteria.minValue !== undefined && client.totalValue < criteria.minValue) return false;
    if (criteria.maxValue !== undefined && client.totalValue > criteria.maxValue) return false;
    if (criteria.proposalCountMin !== undefined && client.proposalCount < criteria.proposalCountMin)
      return false;
    if (criteria.proposalCountMax !== undefined && client.proposalCount > criteria.proposalCountMax)
      return false;
    if (criteria.winRateMin !== undefined && client.winRate < criteria.winRateMin) return false;
    if (criteria.winRateMax !== undefined && client.winRate > criteria.winRateMax) return false;

    if (criteria.lastActivityDays !== undefined) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(client.lastActivity).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (criteria.lastActivityDays > 0 && daysSinceActivity < criteria.lastActivityDays)
        return false;
      if (criteria.lastActivityDays < 0 && daysSinceActivity > Math.abs(criteria.lastActivityDays))
        return false;
    }

    if (criteria.engagementLevel) {
      const level =
        client.engagementScore >= 70 ? 'high' : client.engagementScore >= 40 ? 'medium' : 'low';
      if (level !== criteria.engagementLevel) return false;
    }

    return true;
  }

  async getPerformanceBenchmarks(userId: string): Promise<PerformanceBenchmark[]> {
    this.logger.log(`Generating performance benchmarks for user ${userId}`);

    const userMetrics = await this.calculateUserMetrics(userId);
    const benchmarks: PerformanceBenchmark[] = [];

    // Conversion Rate
    benchmarks.push(
      this.createBenchmark(
        'Conversion Rate',
        userMetrics.conversionRate,
        this.industryBenchmarks.conversionRate,
        '%',
      ),
    );

    // Average Deal Size
    benchmarks.push(
      this.createBenchmark(
        'Average Deal Size',
        userMetrics.avgDealSize,
        this.industryBenchmarks.avgDealSize,
        '$',
      ),
    );

    // Win Rate
    benchmarks.push(
      this.createBenchmark('Win Rate', userMetrics.winRate, this.industryBenchmarks.winRate, '%'),
    );

    // Proposals Per Month
    benchmarks.push(
      this.createBenchmark(
        'Proposals Per Month',
        userMetrics.proposalsPerMonth,
        this.industryBenchmarks.proposalsPerMonth,
        'count',
      ),
    );

    // Average Time to Close
    benchmarks.push(
      this.createBenchmark(
        'Time to Close (Days)',
        userMetrics.avgTimeToClose,
        this.industryBenchmarks.avgTimeToClose,
        'days',
        true, // Lower is better
      ),
    );

    // Client Retention
    benchmarks.push(
      this.createBenchmark(
        'Client Retention',
        userMetrics.clientRetention,
        this.industryBenchmarks.clientRetention,
        '%',
      ),
    );

    return benchmarks;
  }

  private async calculateUserMetrics(userId: string): Promise<{
    conversionRate: number;
    avgDealSize: number;
    winRate: number;
    proposalsPerMonth: number;
    avgTimeToClose: number;
    clientRetention: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [metricRows, returningRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          recent: unknown;
          won: unknown;
          sent: unknown;
          wonValue: unknown;
          uniqueClients: unknown;
          avgCloseDays: unknown;
        }>
      >`
        SELECT
          COUNT(*) FILTER (WHERE "createdAt" >= ${thirtyDaysAgo})::int AS recent,
          COUNT(*) FILTER (WHERE status::text IN ('APPROVED', 'SIGNED'))::int AS won,
          COUNT(*) FILTER (
            WHERE status::text IN ('SENT', 'VIEWED', 'APPROVED', 'SIGNED', 'DECLINED')
          )::int AS sent,
          COALESCE(
            SUM(
              CASE
                WHEN status::text IN ('APPROVED', 'SIGNED')
                  THEN COALESCE("totalAmount", "estimatedValue", 0)
                ELSE 0
              END
            ),
            0
          )::double precision AS "wonValue",
          COUNT(DISTINCT "recipientEmail") FILTER (WHERE "recipientEmail" IS NOT NULL)::int AS "uniqueClients",
          AVG(EXTRACT(EPOCH FROM (COALESCE("signedAt", "approvedAt") - "sentAt")) / 86400)
            FILTER (
              WHERE "sentAt" IS NOT NULL
                AND COALESCE("signedAt", "approvedAt") IS NOT NULL
                AND status::text IN ('APPROVED', 'SIGNED')
            )::double precision AS "avgCloseDays"
        FROM "Proposal"
        WHERE "userId" = ${userId}
      `,
      this.prisma.$queryRaw<Array<{ returning: unknown }>>`
        SELECT COUNT(*)::int AS returning
        FROM (
          SELECT "recipientEmail"
          FROM "Proposal"
          WHERE "userId" = ${userId} AND "recipientEmail" IS NOT NULL
          GROUP BY "recipientEmail"
          HAVING COUNT(*) > 1
        ) repeating_clients
      `,
    ]);

    const metrics = metricRows[0];
    const sent = Number(metrics?.sent) || 0;
    const won = Number(metrics?.won) || 0;
    const uniqueClients = Number(metrics?.uniqueClients) || 0;
    const returning = Number(returningRows[0]?.returning) || 0;
    const conversionRate = sent > 0 ? (won / sent) * 100 : 0;

    return {
      conversionRate,
      avgDealSize: won > 0 ? Number(metrics?.wonValue || 0) / won : 0,
      winRate: conversionRate,
      proposalsPerMonth: Number(metrics?.recent) || 0,
      avgTimeToClose: Number(metrics?.avgCloseDays) || 14,
      clientRetention: uniqueClients > 0 ? (returning / uniqueClients) * 100 : 0,
    };
  }

  private createBenchmark(
    metric: string,
    yourValue: number,
    benchmark: { average: number; topPerformers: number },
    unit: string,
    lowerIsBetter = false,
  ): PerformanceBenchmark {
    const percentile = lowerIsBetter
      ? this.calculatePercentileLower(yourValue, benchmark.average, benchmark.topPerformers)
      : this.calculatePercentile(yourValue, benchmark.average, benchmark.topPerformers);

    const trend = this.determineTrend(yourValue, benchmark.average, lowerIsBetter);
    const recommendation = this.generateRecommendation(metric, yourValue, benchmark, lowerIsBetter);

    return {
      metric,
      yourValue: Math.round(yourValue * 100) / 100,
      industryAverage: benchmark.average,
      topPerformers: benchmark.topPerformers,
      percentile,
      trend,
      recommendation,
    };
  }

  private calculatePercentile(value: number, average: number, topPerformers: number): number {
    if (value >= topPerformers) return 95;
    if (value >= average) {
      return 50 + ((value - average) / (topPerformers - average)) * 45;
    }
    return Math.max(5, (value / average) * 50);
  }

  private calculatePercentileLower(value: number, average: number, topPerformers: number): number {
    if (value <= topPerformers) return 95;
    if (value <= average) {
      return 50 + ((average - value) / (average - topPerformers)) * 45;
    }
    return Math.max(5, 50 - ((value - average) / average) * 45);
  }

  private determineTrend(
    value: number,
    average: number,
    lowerIsBetter: boolean,
  ): 'up' | 'down' | 'stable' {
    const diff = lowerIsBetter ? average - value : value - average;
    const threshold = average * 0.1;

    if (diff > threshold) return 'up';
    if (diff < -threshold) return 'down';
    return 'stable';
  }

  private generateRecommendation(
    metric: string,
    yourValue: number,
    benchmark: { average: number; topPerformers: number },
    lowerIsBetter: boolean,
  ): string {
    const isGood = lowerIsBetter ? yourValue < benchmark.average : yourValue > benchmark.average;

    const recommendations: Record<string, { good: string; improve: string }> = {
      'Conversion Rate': {
        good: 'Great conversion rate! Consider A/B testing to optimize further.',
        improve: 'Focus on follow-up timing and proposal personalization to improve conversions.',
      },
      'Average Deal Size': {
        good: 'Strong deal sizes! Explore upselling opportunities to increase further.',
        improve: 'Consider bundling services or targeting higher-value clients.',
      },
      'Win Rate': {
        good: "Excellent win rate! Document what's working for your team.",
        improve: 'Qualify leads better and focus on ideal client profiles.',
      },
      'Proposals Per Month': {
        good: 'High volume! Ensure quality is maintained.',
        improve: 'Streamline your proposal process with templates and automation.',
      },
      'Time to Close (Days)': {
        good: 'Fast close times! Your sales process is efficient.',
        improve: 'Identify bottlenecks in your approval process.',
      },
      'Client Retention': {
        good: 'Strong retention! Leverage referrals from happy clients.',
        improve: 'Implement regular check-ins and proactive communication.',
      },
    };

    return (
      recommendations[metric]?.[isGood ? 'good' : 'improve'] ||
      (isGood ? "You're performing above average!" : "There's room for improvement.")
    );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async clearSegmentCache() {
    this.logger.log('Clearing segment cache');
    this.segmentCache.clear();
  }
}
