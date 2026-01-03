import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictiveScoreResponseDto } from './dto/heatmaps.dto';

@Injectable()
export class PredictiveScoringService {
  private readonly logger = new Logger(PredictiveScoringService.name);

  constructor(private prisma: PrismaService) {}

  // Calculate predictive score for a proposal/session
  async calculatePredictiveScore(
    proposalId: string,
    sessionId?: string,
  ): Promise<PredictiveScoreResponseDto> {
    // Get engagement data
    const engagement = await this.getEngagementData(proposalId, sessionId);

    // Calculate individual factor scores
    const timeSpentScore = this.calculateTimeSpentScore(engagement.timeSpent);
    const scrollDepthScore = this.calculateScrollDepthScore(engagement.maxScrollDepth);
    const interactionScore = this.calculateInteractionScore(engagement.interactions);
    const returningScore = engagement.isReturning ? 20 : 0;
    const deviceScore = this.calculateDeviceScore(engagement.deviceType);
    const timeOfDayScore = this.calculateTimeOfDayScore(engagement.timeOfDay);
    const pricingScore = engagement.pricingViewed ? 25 : 0;

    // Weighted factors
    const factors = {
      timeSpent: {
        value: engagement.timeSpent,
        weight: 0.2,
        score: timeSpentScore,
      },
      scrollDepth: {
        value: engagement.maxScrollDepth,
        weight: 0.15,
        score: scrollDepthScore,
      },
      interactions: {
        value: engagement.interactions,
        weight: 0.15,
        score: interactionScore,
      },
      returningVisitor: {
        value: engagement.isReturning,
        weight: 0.1,
        score: returningScore,
      },
      deviceType: {
        value: engagement.deviceType,
        weight: 0.05,
        score: deviceScore,
      },
      timeOfDay: {
        value: engagement.timeOfDay,
        weight: 0.05,
        score: timeOfDayScore,
      },
      pricingViewed: {
        value: engagement.pricingViewed,
        weight: 0.3,
        score: pricingScore,
      },
    };

    // Calculate weighted engagement score (0-100)
    const engagementScore = Object.values(factors).reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0,
    );

    // Calculate quality score (how complete is the viewing)
    const qualityScore = this.calculateQualityScore(engagement);

    // Calculate conversion probability using logistic regression approximation
    const conversionProbability = this.calculateConversionProbability(
      engagementScore,
      qualityScore,
      engagement,
    );

    // Generate recommendations
    const recommendation = this.generateRecommendation(conversionProbability, engagement);
    const nextBestAction = this.determineNextBestAction(engagement, conversionProbability);

    return {
      proposalId,
      sessionId,
      conversionProbability,
      engagementScore: Math.round(engagementScore),
      qualityScore: Math.round(qualityScore),
      factors,
      recommendation,
      nextBestAction,
    };
  }

  // Get all engagement data for scoring
  private async getEngagementData(proposalId: string, sessionId?: string) {
    const where = sessionId ? { proposalId, sessionId } : { proposalId };

    // Get interactions
    const interactions = await this.prisma.proposalInteraction.findMany({
      where,
      select: {
        type: true,
        elementType: true,
        timestamp: true,
        metadata: true,
      },
    });

    // Get scroll data
    const scrollData = await this.prisma.proposalScrollTracking.findMany({
      where,
      select: {
        scrollDepth: true,
        timeSpent: true,
      },
    });

    // Calculate metrics
    const maxScrollDepth =
      scrollData.length > 0 ? Math.max(...scrollData.map((s) => s.scrollDepth)) : 0;

    const timeSpent = scrollData.reduce((sum, s) => sum + (s.timeSpent || 0), 0) / 1000; // Convert to seconds

    const pricingViewed = interactions.some((i) => {
      const metadata = (i.metadata || {}) as Record<string, any>;
      return i.elementType === 'pricing-table' || metadata.section === 'pricing';
    });

    // Check if returning visitor (simplistic - could use session history)
    const isReturning = sessionId ? await this.checkReturningVisitor(proposalId, sessionId) : false;

    // Get device type from first interaction metadata
    const metadata = (interactions[0]?.metadata || {}) as Record<string, any>;
    const deviceType = metadata.deviceType || 'desktop';

    // Get time of day from first interaction
    const timeOfDay =
      interactions.length > 0 ? this.getTimeOfDay(interactions[0].timestamp) : 'business';

    return {
      timeSpent,
      maxScrollDepth,
      interactions: interactions.length,
      pricingViewed,
      isReturning,
      deviceType,
      timeOfDay,
      clickCount: interactions.filter((i) => i.type === 'click').length,
      hoverCount: interactions.filter((i) => i.type === 'hover').length,
    };
  }

  // Individual scoring functions
  private calculateTimeSpentScore(seconds: number): number {
    // Score increases logarithmically up to 600 seconds (10 minutes)
    if (seconds <= 0) return 0;
    if (seconds >= 600) return 100;

    return Math.min(100, (Math.log(seconds + 1) / Math.log(601)) * 100);
  }

  private calculateScrollDepthScore(depth: number): number {
    // Linear score up to 100%
    return Math.min(100, depth);
  }

  private calculateInteractionScore(count: number): number {
    // Diminishing returns after 20 interactions
    if (count <= 0) return 0;
    if (count >= 20) return 100;

    return Math.min(100, (count / 20) * 100);
  }

  private calculateDeviceScore(deviceType: string): number {
    // Desktop users slightly more likely to convert
    const scores: Record<string, number> = {
      desktop: 70,
      laptop: 70,
      mobile: 50,
      tablet: 60,
    };
    return scores[deviceType] || 50;
  }

  private calculateTimeOfDayScore(timeOfDay: string): number {
    // Business hours = higher conversion
    const scores: Record<string, number> = {
      business: 80,
      evening: 60,
      night: 40,
      early_morning: 50,
    };
    return scores[timeOfDay] || 60;
  }

  private calculateQualityScore(engagement: any): number {
    let score = 0;

    // Viewed more than 50% (+30 points)
    if (engagement.maxScrollDepth >= 50) score += 30;

    // Viewed pricing (+30 points)
    if (engagement.pricingViewed) score += 30;

    // Multiple interactions (+20 points)
    if (engagement.interactions >= 5) score += 20;

    // Spent reasonable time (+20 points)
    if (engagement.timeSpent >= 60) score += 20;

    return Math.min(100, score);
  }

  private calculateConversionProbability(
    engagementScore: number,
    qualityScore: number,
    engagement: any,
  ): number {
    // Logistic regression approximation
    // probability = 1 / (1 + e^(-z))

    let z = -5; // Base intercept (low probability)

    z += engagementScore * 0.05; // +0.05 per engagement point
    z += qualityScore * 0.03; // +0.03 per quality point

    if (engagement.pricingViewed) z += 2;
    if (engagement.isReturning) z += 1.5;
    if (engagement.maxScrollDepth >= 80) z += 1;
    if (engagement.timeSpent >= 180) z += 1; // 3+ minutes

    const probability = 1 / (1 + Math.exp(-z));

    return Math.max(0, Math.min(1, probability));
  }

  private generateRecommendation(probability: number, engagement: any): string {
    if (probability >= 0.7) {
      return 'High conversion likelihood. Consider sending a personalized follow-up or scheduling a call.';
    } else if (probability >= 0.4) {
      return 'Moderate interest shown. Send additional resources or address potential concerns.';
    } else if (engagement.maxScrollDepth < 50) {
      return 'Low engagement. Consider A/B testing the opening section or simplifying the proposal.';
    } else if (!engagement.pricingViewed) {
      return 'Pricing section not viewed. Consider highlighting pricing earlier or making it more prominent.';
    } else {
      return 'Limited engagement. Consider reaching out to address questions or concerns.';
    }
  }

  private determineNextBestAction(engagement: any, probability: number): string {
    if (probability >= 0.7) {
      return 'Send personalized email with next steps';
    } else if (probability >= 0.5) {
      return 'Share case study or testimonial';
    } else if (!engagement.pricingViewed) {
      return 'Offer pricing consultation call';
    } else if (engagement.timeSpent < 60) {
      return 'Send simplified one-pager version';
    } else {
      return 'Schedule discovery call to address concerns';
    }
  }

  // Helper methods
  private async checkReturningVisitor(proposalId: string, sessionId: string): Promise<boolean> {
    const previousSessions = await this.prisma.proposalInteraction.findMany({
      where: {
        proposalId,
        sessionId: { not: sessionId },
      },
      take: 1,
    });

    return previousSessions.length > 0;
  }

  private getTimeOfDay(timestamp: Date): string {
    const hour = timestamp.getHours();

    if (hour >= 9 && hour < 17) return 'business';
    if (hour >= 17 && hour < 22) return 'evening';
    if (hour >= 22 || hour < 6) return 'night';
    return 'early_morning';
  }
}
