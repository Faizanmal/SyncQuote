import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PipelineData {
  stages: {
    id: string;
    name: string;
    order: number;
    probability: number;
    color: string;
    proposalCount: number;
    totalValue: number;
    weightedValue: number;
  }[];
  totalPipeline: number;
  weightedPipeline: number;
}

export interface ForecastData {
  currentMonth: {
    projected: number;
    actual: number;
    target?: number;
  };
  nextMonth: {
    projected: number;
    target?: number;
  };
  quarterly: {
    quarter: string;
    projected: number;
    actual: number;
  }[];
  trends: {
    period: string;
    revenue: number;
    deals: number;
    avgDealSize: number;
  }[];
}

export interface WinRateAnalysis {
  overall: number;
  byMonth: { month: string; rate: number; deals: number }[];
  byValue: { range: string; rate: number; deals: number }[];
  byIndustry: { industry: string; rate: number; deals: number }[];
  avgTimeToClose: number;
}

export interface TeamPerformance {
  members: {
    userId: string;
    name: string;
    proposalsSent: number;
    proposalsWon: number;
    totalRevenue: number;
    winRate: number;
    avgDealSize: number;
    avgResponseTime: number; // hours
  }[];
  totals: {
    proposalsSent: number;
    proposalsWon: number;
    totalRevenue: number;
    avgWinRate: number;
  };
}

@Injectable()
export class ForecastingService {
  constructor(private prisma: PrismaService) {}

  // Pipeline Stages Management
  async createPipelineStage(
    userId: string,
    data: { name: string; order: number; probability: number; color?: string },
  ) {
    return this.prisma.pipelineStage.create({
      data: {
        name: data.name,
        order: data.order,
        probability: data.probability,
        color: data.color || '#6366f1',
        userId,
      },
    });
  }

  async getPipelineStages(userId: string) {
    return this.prisma.pipelineStage.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async updatePipelineStage(
    id: string,
    userId: string,
    data: Partial<{ name: string; order: number; probability: number; color: string }>,
  ) {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { id } });
    if (!stage || stage.userId !== userId) {
      throw new NotFoundException('Pipeline stage not found');
    }
    return this.prisma.pipelineStage.update({
      where: { id },
      data,
    });
  }

  async deletePipelineStage(id: string, userId: string) {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { id } });
    if (!stage || stage.userId !== userId) {
      throw new NotFoundException('Pipeline stage not found');
    }
    return this.prisma.pipelineStage.delete({ where: { id } });
  }

  // Initialize default pipeline stages
  async initializeDefaultStages(userId: string) {
    const existingStages = await this.prisma.pipelineStage.findMany({ where: { userId } });
    if (existingStages.length > 0) return existingStages;

    const defaultStages = [
      { name: 'Lead', order: 1, probability: 10, color: '#94a3b8' },
      { name: 'Qualified', order: 2, probability: 25, color: '#3b82f6' },
      { name: 'Proposal Sent', order: 3, probability: 50, color: '#8b5cf6' },
      { name: 'Negotiation', order: 4, probability: 75, color: '#f59e0b' },
      { name: 'Closed Won', order: 5, probability: 100, color: '#22c55e' },
      { name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444' },
    ];

    return Promise.all(
      defaultStages.map((stage) =>
        this.prisma.pipelineStage.create({
          data: { ...stage, userId },
        }),
      ),
    );
  }

  // Pipeline Overview
  async getPipelineData(userId: string): Promise<PipelineData> {
    const stages = await this.getPipelineStages(userId);

    // If no stages, initialize defaults
    if (stages.length === 0) {
      await this.initializeDefaultStages(userId);
      return this.getPipelineData(userId);
    }

    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: { in: ['DRAFT', 'SENT', 'VIEWED'] },
      },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    // Map proposals to stages based on status
    const statusToStageMap: Record<string, string> = {
      DRAFT: 'Lead',
      SENT: 'Proposal Sent',
      VIEWED: 'Negotiation',
    };

    const stageData = stages.map((stage) => {
      const stageProposals = proposals.filter((p) => {
        const mappedStage = statusToStageMap[p.status] || 'Lead';
        return p.pipelineStageId === stage.id || mappedStage === stage.name;
      });

      const totalValue = stageProposals.reduce((sum, p) => {
        return sum + (p.estimatedValue || this.calculateProposalValue(p));
      }, 0);

      return {
        id: stage.id,
        name: stage.name,
        order: stage.order,
        probability: stage.probability,
        color: stage.color,
        proposalCount: stageProposals.length,
        totalValue,
        weightedValue: totalValue * (stage.probability / 100),
      };
    });

    const totalPipeline = stageData.reduce((sum, s) => sum + s.totalValue, 0);
    const weightedPipeline = stageData.reduce((sum, s) => sum + s.weightedValue, 0);

    return {
      stages: stageData,
      totalPipeline,
      weightedPipeline,
    };
  }

  // Revenue Forecasting
  async getForecast(userId: string): Promise<ForecastData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    // Current month actual (approved proposals)
    const currentMonthApproved = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: 'APPROVED',
        approvedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    const currentMonthActual = currentMonthApproved.reduce(
      (sum, p) => sum + this.calculateProposalValue(p),
      0,
    );

    // Current month projected (active proposals * probability)
    const currentMonthActive = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'VIEWED'] },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    const currentMonthProjected =
      currentMonthActual +
      currentMonthActive.reduce(
        (sum, p) => sum + this.calculateProposalValue(p) * 0.5, // 50% probability for active
        0,
      );

    // Next month projection
    const nextMonthActive = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: { in: ['DRAFT', 'SENT', 'VIEWED'] },
      },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    const nextMonthProjected = nextMonthActive.reduce(
      (sum, p) => sum + this.calculateProposalValue(p) * 0.3, // 30% probability
      0,
    );

    // Quarterly data (last 4 quarters)
    const quarterly = await this.getQuarterlyData(userId);

    // Monthly trends (last 12 months)
    const trends = await this.getMonthlyTrends(userId);

    return {
      currentMonth: {
        projected: Math.round(currentMonthProjected),
        actual: Math.round(currentMonthActual),
      },
      nextMonth: {
        projected: Math.round(nextMonthProjected),
      },
      quarterly,
      trends,
    };
  }

  // Win Rate Analysis
  async getWinRateAnalysis(userId: string): Promise<WinRateAnalysis> {
    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'DECLINED'] },
        sentAt: { not: null },
      },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
      },
    });

    const approved = proposals.filter((p) => p.status === 'APPROVED');
    const overall = proposals.length > 0 ? (approved.length / proposals.length) * 100 : 0;

    // By month
    const byMonth = this.groupByMonth(proposals);

    // By value ranges
    const byValue = this.groupByValueRange(proposals);

    // Average time to close
    const closedDeals = approved.filter((p) => p.sentAt && p.approvedAt);
    const avgTimeToClose =
      closedDeals.length > 0
        ? closedDeals.reduce((sum, p) => {
            const hours = (p.approvedAt!.getTime() - p.sentAt!.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / closedDeals.length
        : 0;

    return {
      overall: Math.round(overall * 100) / 100,
      byMonth,
      byValue,
      byIndustry: [], // Would need industry data on proposals
      avgTimeToClose: Math.round(avgTimeToClose),
    };
  }

  // Team Performance (for teams feature)
  async getTeamPerformance(userId: string, teamId?: string): Promise<TeamPerformance> {
    // For now, return single user performance
    // Will expand when team feature is fully implemented
    const proposals = await this.prisma.proposal.findMany({
      where: { userId },
      include: {
        blocks: {
          include: { pricingItems: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const sent = proposals.filter((p) => p.sentAt);
    const won = proposals.filter((p) => p.status === 'APPROVED');
    const totalRevenue = won.reduce((sum, p) => sum + this.calculateProposalValue(p), 0);

    // Calculate average response time (time from sent to first view)
    const viewedProposals = proposals.filter((p) => p.sentAt && p.firstViewedAt);
    const avgResponseTime =
      viewedProposals.length > 0
        ? viewedProposals.reduce((sum, p) => {
            const hours = (p.firstViewedAt!.getTime() - p.sentAt!.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / viewedProposals.length
        : 0;

    const member = {
      userId,
      name: proposals[0]?.user?.name || 'Unknown',
      proposalsSent: sent.length,
      proposalsWon: won.length,
      totalRevenue,
      winRate: sent.length > 0 ? (won.length / sent.length) * 100 : 0,
      avgDealSize: won.length > 0 ? totalRevenue / won.length : 0,
      avgResponseTime: Math.round(avgResponseTime),
    };

    return {
      members: [member],
      totals: {
        proposalsSent: member.proposalsSent,
        proposalsWon: member.proposalsWon,
        totalRevenue: member.totalRevenue,
        avgWinRate: member.winRate,
      },
    };
  }

  // Helper methods
  private calculateProposalValue(proposal: any): number {
    if (proposal.estimatedValue) return proposal.estimatedValue;

    let total = 0;
    for (const block of proposal.blocks || []) {
      if (block.type === 'PRICING_TABLE' && block.pricingItems) {
        for (const item of block.pricingItems) {
          if (item.type !== 'OPTIONAL') {
            total += item.price;
          }
        }
      }
    }

    if (proposal.taxRate > 0) {
      total = total * (1 + proposal.taxRate / 100);
    }

    return total;
  }

  private async getQuarterlyData(userId: string) {
    const quarters: { quarter: string; projected: number; actual: number }[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const quarterStart = new Date(now.getFullYear(), now.getMonth() - i * 3 - 2, 1);
      const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);

      const proposals = await this.prisma.proposal.findMany({
        where: {
          userId,
          status: 'APPROVED',
          approvedAt: {
            gte: quarterStart,
            lte: quarterEnd,
          },
        },
        include: {
          blocks: {
            include: { pricingItems: true },
          },
        },
      });

      const actual = proposals.reduce((sum, p) => sum + this.calculateProposalValue(p), 0);

      quarters.push({
        quarter: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`,
        projected: actual, // For past quarters, projected = actual
        actual,
      });
    }

    return quarters;
  }

  private async getMonthlyTrends(userId: string) {
    const trends: { period: string; revenue: number; deals: number; avgDealSize: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

      const proposals = await this.prisma.proposal.findMany({
        where: {
          userId,
          status: 'APPROVED',
          approvedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: {
          blocks: {
            include: { pricingItems: true },
          },
        },
      });

      const revenue = proposals.reduce((sum, p) => sum + this.calculateProposalValue(p), 0);

      trends.push({
        period: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue,
        deals: proposals.length,
        avgDealSize: proposals.length > 0 ? revenue / proposals.length : 0,
      });
    }

    return trends;
  }

  private groupByMonth(proposals: any[]) {
    const monthMap = new Map<string, { won: number; total: number }>();

    proposals.forEach((p) => {
      const date = p.approvedAt || p.declinedAt || p.sentAt;
      if (!date) return;

      const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const existing = monthMap.get(month) || { won: 0, total: 0 };

      monthMap.set(month, {
        won: existing.won + (p.status === 'APPROVED' ? 1 : 0),
        total: existing.total + 1,
      });
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        rate: data.total > 0 ? (data.won / data.total) * 100 : 0,
        deals: data.total,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  private groupByValueRange(proposals: any[]) {
    const ranges = [
      { label: '$0-1k', min: 0, max: 1000 },
      { label: '$1k-5k', min: 1000, max: 5000 },
      { label: '$5k-10k', min: 5000, max: 10000 },
      { label: '$10k-25k', min: 10000, max: 25000 },
      { label: '$25k+', min: 25000, max: Infinity },
    ];

    return ranges.map((range) => {
      const inRange = proposals.filter((p) => {
        const value = this.calculateProposalValue(p);
        return value >= range.min && value < range.max;
      });

      const won = inRange.filter((p) => p.status === 'APPROVED').length;

      return {
        range: range.label,
        rate: inRange.length > 0 ? (won / inRange.length) * 100 : 0,
        deals: inRange.length,
      };
    });
  }
}
