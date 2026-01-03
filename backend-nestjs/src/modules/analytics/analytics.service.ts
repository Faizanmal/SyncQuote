import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsMetrics {
  totalProposals: number;
  activeProposals: number;
  approvedProposals: number;
  declinedProposals: number;
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

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getOverviewMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsMetrics> {
    const dateFilter = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };

    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        ...(startDate || endDate ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        status: true,
        viewCount: true,
        createdAt: true,
        sentAt: true,
        approvedAt: true,
      },
    });

    const totalProposals = proposals.length;
    const activeProposals = proposals.filter(
      (p) => p.status === 'SENT' || p.status === 'VIEWED',
    ).length;
    const approvedProposals = proposals.filter((p) => p.status === 'APPROVED').length;
    const declinedProposals = proposals.filter((p) => p.status === 'DECLINED').length;
    const sentProposals = proposals.filter((p) => p.sentAt).length;

    const conversionRate = sentProposals > 0 ? (approvedProposals / sentProposals) * 100 : 0;
    const totalViews = proposals.reduce((sum, p) => sum + p.viewCount, 0);
    const averageViewsPerProposal = totalProposals > 0 ? totalViews / totalProposals : 0;

    // Calculate average time to signature
    const signedProposals = proposals.filter((p) => p.sentAt && p.approvedAt);
    const averageTimeToSignature =
      signedProposals.length > 0
        ? signedProposals.reduce((sum, p) => {
            const days = (p.approvedAt!.getTime() - p.sentAt!.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / signedProposals.length
        : 0;

    return {
      totalProposals,
      activeProposals,
      approvedProposals,
      declinedProposals,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalViews,
      averageViewsPerProposal: Math.round(averageViewsPerProposal * 100) / 100,
      averageTimeToSignature: Math.round(averageTimeToSignature * 100) / 100,
    };
  }

  async getProposalEngagement(userId: string, limit = 10): Promise<ProposalEngagement[]> {
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
      take: limit,
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

    const activities = await this.prisma.activity.findMany({
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

    return activities;
  }

  async getConversionFunnel(userId: string) {
    const proposals = await this.prisma.proposal.findMany({
      where: { userId },
      select: {
        status: true,
        viewCount: true,
      },
    });

    const total = proposals.length;
    const sent = proposals.filter((p) => p.status !== 'DRAFT').length;
    const viewed = proposals.filter((p) => p.viewCount > 0).length;
    const approved = proposals.filter((p) => p.status === 'APPROVED').length;

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

    // Update proposal view count
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

    // Create activity log
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
