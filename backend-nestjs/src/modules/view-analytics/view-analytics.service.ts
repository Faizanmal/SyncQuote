import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

export interface StartSessionDto {
  proposalId: string;
  sessionId: string;
  visitorId?: string;
  viewerEmail?: string;
  viewerName?: string;
  viewerCompany?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  city?: string;
}

export interface UpdateSessionDto {
  sessionId: string;
  totalDuration?: number;
  scrollDepth?: number;
  pagesViewed?: number;
  interactions?: number;
}

export interface TrackSectionViewDto {
  sessionId: string;
  sectionType: string;
  sectionIndex: number;
  blockId?: string;
  viewDuration?: number;
  scrollDepth?: number;
  interactions?: number;
}

export interface ViewAnalyticsSummary {
  totalSessions: number;
  uniqueVisitors: number;
  averageDuration: number;
  averageScrollDepth: number;
  topSections: {
    sectionType: string;
    totalDuration: number;
    averageDuration: number;
    viewCount: number;
  }[];
  viewsByDevice: {
    device: string;
    count: number;
  }[];
  viewsByLocation: {
    country: string;
    count: number;
  }[];
  viewTimeline: {
    date: string;
    views: number;
  }[];
}

@Injectable()
export class ViewAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async startSession(data: StartSessionDto) {
    const session = await this.prisma.proposalViewSession.create({
      data: {
        proposalId: data.proposalId,
        sessionId: data.sessionId,
        visitorId: data.visitorId,
        viewerEmail: data.viewerEmail,
        viewerName: data.viewerName,
        viewerCompany: data.viewerCompany,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        device: data.device,
        browser: data.browser,
        os: data.os,
        country: data.country,
        city: data.city,
      },
    });

    // Update proposal view count and timestamps
    await this.prisma.proposal.update({
      where: { id: data.proposalId },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
        firstViewedAt: {
          set: await this.prisma.proposal
            .findUnique({
              where: { id: data.proposalId },
              select: { firstViewedAt: true },
            })
            .then((p: { firstViewedAt: Date | null } | null) => p?.firstViewedAt || new Date()),
        },
      },
    });

    // Notify proposal owner via WebSocket
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: data.proposalId },
      select: { userId: true, title: true },
    });

    if (proposal) {
      this.eventsGateway.sendToUser(proposal.userId, 'proposal:viewed', {
        proposalId: data.proposalId,
        title: proposal.title,
        viewerName: data.viewerName,
        viewerEmail: data.viewerEmail,
        device: data.device,
        location: data.city && data.country ? `${data.city}, ${data.country}` : null,
      });
    }

    return session;
  }

  async updateSession(data: UpdateSessionDto) {
    const session = await this.prisma.proposalViewSession.update({
      where: { sessionId: data.sessionId },
      data: {
        totalDuration: data.totalDuration,
        scrollDepth: data.scrollDepth,
        pagesViewed: data.pagesViewed,
        interactions: data.interactions,
        lastActivityAt: new Date(),
      },
    });

    return session;
  }

  async endSession(sessionId: string) {
    return this.prisma.proposalViewSession.update({
      where: { sessionId },
      data: {
        endedAt: new Date(),
      },
    });
  }

  async trackSectionView(data: TrackSectionViewDto) {
    // Try to find existing section view for this session
    const existing = await this.prisma.proposalSectionView.findFirst({
      where: {
        sessionId: data.sessionId,
        sectionType: data.sectionType,
        sectionIndex: data.sectionIndex,
      },
    });

    if (existing) {
      // Update existing
      return this.prisma.proposalSectionView.update({
        where: { id: existing.id },
        data: {
          viewDuration: { increment: data.viewDuration || 0 },
          scrollDepth:
            data.scrollDepth !== undefined
              ? Math.max(existing.scrollDepth, data.scrollDepth)
              : existing.scrollDepth,
          interactions: { increment: data.interactions || 0 },
          revisits: { increment: 1 },
          lastViewedAt: new Date(),
        },
      });
    }

    // Create new
    return this.prisma.proposalSectionView.create({
      data: {
        sessionId: data.sessionId,
        sectionType: data.sectionType,
        sectionIndex: data.sectionIndex,
        blockId: data.blockId,
        viewDuration: data.viewDuration || 0,
        scrollDepth: data.scrollDepth || 0,
        interactions: data.interactions || 0,
      },
    });
  }

  async getProposalAnalytics(proposalId: string): Promise<ViewAnalyticsSummary> {
    const sessions = await this.prisma.proposalViewSession.findMany({
      where: { proposalId },
      include: {
        sectionViews: true,
      },
    });

    type SessionData = {
      visitorId: string | null;
      sessionId: string;
      totalDuration: number;
      scrollDepth: number;
      sectionViews: { sectionType: string; viewDuration: number }[];
    };
    const uniqueVisitors = new Set(sessions.map((s: SessionData) => s.visitorId || s.sessionId))
      .size;
    const totalDuration = sessions.reduce(
      (sum: number, s: SessionData) => sum + s.totalDuration,
      0,
    );
    const averageDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;
    const averageScrollDepth =
      sessions.length > 0
        ? sessions.reduce((sum: number, s: SessionData) => sum + s.scrollDepth, 0) / sessions.length
        : 0;

    // Aggregate section views
    type SectionViewData = { sectionType: string; viewDuration: number };
    const sectionMap = new Map<string, { duration: number; count: number }>();
    sessions.forEach((s: { sectionViews: SectionViewData[] }) => {
      s.sectionViews.forEach((sv: SectionViewData) => {
        const existing = sectionMap.get(sv.sectionType) || { duration: 0, count: 0 };
        sectionMap.set(sv.sectionType, {
          duration: existing.duration + sv.viewDuration,
          count: existing.count + 1,
        });
      });
    });

    const topSections = Array.from(sectionMap.entries())
      .map(([sectionType, data]: [string, { duration: number; count: number }]) => ({
        sectionType,
        totalDuration: data.duration,
        averageDuration: data.count > 0 ? data.duration / data.count : 0,
        viewCount: data.count,
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    // Device breakdown
    const deviceMap = new Map<string, number>();
    sessions.forEach((s: { device: string | null }) => {
      const device = s.device || 'unknown';
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
    });

    const viewsByDevice = Array.from(deviceMap.entries())
      .map(([device, count]: [string, number]) => ({ device, count }))
      .sort((a, b) => b.count - a.count);

    // Location breakdown
    const locationMap = new Map<string, number>();
    sessions.forEach((s: { country: string | null }) => {
      if (s.country) {
        locationMap.set(s.country, (locationMap.get(s.country) || 0) + 1);
      }
    });

    const viewsByLocation = Array.from(locationMap.entries())
      .map(([country, count]: [string, number]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // View timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timelineMap = new Map<string, number>();
    sessions
      .filter((s: { startedAt: Date }) => s.startedAt >= thirtyDaysAgo)
      .forEach((s: { startedAt: Date }) => {
        const date = s.startedAt.toISOString().split('T')[0];
        timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
      });

    const viewTimeline = Array.from(timelineMap.entries())
      .map(([date, views]: [string, number]) => ({ date, views }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSessions: sessions.length,
      uniqueVisitors,
      averageDuration: Math.round(averageDuration),
      averageScrollDepth: Math.round(averageScrollDepth * 100) / 100,
      topSections,
      viewsByDevice,
      viewsByLocation,
      viewTimeline,
    };
  }

  async getSectionHeatmap(proposalId: string) {
    const sectionViews = await this.prisma.proposalSectionView.findMany({
      where: {
        session: {
          proposalId,
        },
      },
    });

    // Aggregate by section
    const heatmap = new Map<
      string,
      {
        sectionType: string;
        sectionIndex: number;
        totalDuration: number;
        avgDuration: number;
        avgScrollDepth: number;
        interactionCount: number;
        viewCount: number;
      }
    >();

    type SectionViewRecord = {
      sectionType: string;
      sectionIndex: number;
      viewDuration: number;
      scrollDepth: number;
      interactions: number;
    };
    sectionViews.forEach((sv: SectionViewRecord) => {
      const key = `${sv.sectionType}-${sv.sectionIndex}`;
      const existing = heatmap.get(key);

      if (existing) {
        existing.totalDuration += sv.viewDuration;
        existing.avgDuration = existing.totalDuration / (existing.viewCount + 1);
        existing.avgScrollDepth =
          (existing.avgScrollDepth * existing.viewCount + sv.scrollDepth) /
          (existing.viewCount + 1);
        existing.interactionCount += sv.interactions;
        existing.viewCount += 1;
      } else {
        heatmap.set(key, {
          sectionType: sv.sectionType,
          sectionIndex: sv.sectionIndex,
          totalDuration: sv.viewDuration,
          avgDuration: sv.viewDuration,
          avgScrollDepth: sv.scrollDepth,
          interactionCount: sv.interactions,
          viewCount: 1,
        });
      }
    });

    return Array.from(heatmap.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
  }

  async getRecentViewers(proposalId: string, limit = 10) {
    return this.prisma.proposalViewSession.findMany({
      where: { proposalId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        viewerEmail: true,
        viewerName: true,
        viewerCompany: true,
        device: true,
        country: true,
        city: true,
        totalDuration: true,
        scrollDepth: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }
}
