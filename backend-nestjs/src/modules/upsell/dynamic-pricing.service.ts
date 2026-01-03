import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicPriceResponseDto, PricingStrategy, ClientProfileDto } from './dto/upsell.dto';

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  constructor(private prisma: PrismaService) {}

  // Calculate dynamic price based on multiple factors
  async calculateDynamicPrice(
    productId: string,
    clientId: string,
    basePrice: number,
    strategy: PricingStrategy = PricingStrategy.DYNAMIC,
  ): Promise<DynamicPriceResponseDto> {
    // Get client data
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return this.getDefaultPricing(productId, clientId, basePrice, strategy);
    }

    // Calculate factors
    const clientValue = await this.calculateClientValueScore(clientId);
    const marketDemand = await this.calculateMarketDemandScore(productId);
    const competitivePosition = await this.calculateCompetitiveScore(productId);
    const urgency = await this.calculateUrgencyScore(clientId);
    const relationship = await this.calculateRelationshipScore(clientId);

    // Define factor weights
    const weights = {
      clientValue: 0.25,
      marketDemand: 0.2,
      competitivePosition: 0.2,
      urgency: 0.15,
      relationship: 0.2,
    };

    // Calculate price adjustments
    const clientValueImpact = (clientValue / 100) * weights.clientValue * 0.3; // Max 30% adjustment
    const marketDemandImpact = (marketDemand / 100) * weights.marketDemand * 0.2;
    const competitiveImpact = (competitivePosition / 100) * weights.competitivePosition * 0.15;
    const urgencyImpact = (urgency / 100) * weights.urgency * 0.1;
    const relationshipImpact = (relationship / 100) * weights.relationship * -0.15; // Discount for good relationships

    // Calculate total adjustment (can be positive or negative)
    const totalAdjustment =
      1 +
      clientValueImpact +
      marketDemandImpact +
      competitiveImpact +
      urgencyImpact +
      relationshipImpact;

    // Apply strategy-specific rules
    let recommendedPrice = basePrice * totalAdjustment;

    switch (strategy) {
      case PricingStrategy.VALUE_BASED:
        // Focus more on client value
        recommendedPrice = basePrice * (1 + clientValueImpact * 2);
        break;

      case PricingStrategy.COMPETITIVE:
        // Focus more on market position
        recommendedPrice = basePrice * (1 + competitiveImpact * 2);
        break;

      case PricingStrategy.COST_PLUS:
        // Minimum markup, less variance
        recommendedPrice = Math.max(basePrice * 1.1, basePrice * (1 + totalAdjustment * 0.5));
        break;

      case PricingStrategy.TIERED:
        // Round to nearest tier
        recommendedPrice = this.roundToTier(recommendedPrice);
        break;
    }

    // Apply bounds (10% to 40% adjustment max)
    recommendedPrice = Math.max(basePrice * 0.6, Math.min(basePrice * 1.4, recommendedPrice));

    const discountPercentage = ((basePrice - recommendedPrice) / basePrice) * 100;

    // Calculate confidence based on data quality
    const confidence = this.calculatePricingConfidence({
      clientValue,
      marketDemand,
      competitivePosition,
      urgency,
      relationship,
    });

    // Valid for 7 days
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    return {
      productId,
      clientId,
      basePrice,
      recommendedPrice: Math.round(recommendedPrice * 100) / 100,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
      strategy,
      factors: {
        clientValue: {
          score: clientValue,
          weight: weights.clientValue,
          impact: clientValueImpact,
        },
        marketDemand: {
          score: marketDemand,
          weight: weights.marketDemand,
          impact: marketDemandImpact,
        },
        competitivePosition: {
          score: competitivePosition,
          weight: weights.competitivePosition,
          impact: competitiveImpact,
        },
        urgency: {
          score: urgency,
          weight: weights.urgency,
          impact: urgencyImpact,
        },
        relationship: {
          score: relationship,
          weight: weights.relationship,
          impact: relationshipImpact,
        },
      },
      confidence,
      validUntil,
    };
  }

  // Calculate optimal price point for maximum revenue
  async optimizePrice(productId: string, clientId: string, basePrice: number): Promise<number> {
    // Get historical conversion rates at different price points
    const pricePoints = [
      basePrice * 0.7,
      basePrice * 0.8,
      basePrice * 0.9,
      basePrice,
      basePrice * 1.1,
      basePrice * 1.2,
    ];

    let maxExpectedRevenue = 0;
    let optimalPrice = basePrice;

    for (const price of pricePoints) {
      const estimatedConversionRate = await this.estimateConversionRate(clientId, price);
      const expectedRevenue = price * (estimatedConversionRate / 100);

      if (expectedRevenue > maxExpectedRevenue) {
        maxExpectedRevenue = expectedRevenue;
        optimalPrice = price;
      }
    }

    return optimalPrice;
  }

  // Calculate price elasticity
  async calculatePriceElasticity(productId: string): Promise<number> {
    // Simplified - would analyze historical data
    // Returns elasticity coefficient (% change in demand / % change in price)
    return -1.5; // Typical B2B elasticity
  }

  // Private helper methods
  private async calculateClientValueScore(clientId: string): Promise<number> {
    const proposals = await this.prisma.proposal.findMany({
      where: { clientId, status: 'APPROVED' },
      select: { totalAmount: true },
    });

    const totalRevenue = proposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Score based on revenue (simplified)
    if (totalRevenue > 50000) return 90;
    if (totalRevenue > 20000) return 75;
    if (totalRevenue > 10000) return 60;
    if (totalRevenue > 5000) return 50;
    return 30;
  }

  private async calculateMarketDemandScore(productId: string): Promise<number> {
    // Simplified - would analyze market trends, seasonality, etc.
    // High demand = higher score = higher price
    return 70;
  }

  private async calculateCompetitiveScore(productId: string): Promise<number> {
    // Simplified - would compare to competitor pricing
    // Strong position = higher score = higher price
    return 65;
  }

  private async calculateUrgencyScore(clientId: string): Promise<number> {
    // Check for time-sensitive factors
    const recentProposals = await this.prisma.proposal.findMany({
      where: {
        clientId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    // More recent activity = higher urgency
    if (recentProposals.length > 3) return 80;
    if (recentProposals.length > 1) return 60;
    return 40;
  }

  private async calculateRelationshipScore(clientId: string): Promise<number> {
    const proposals = await this.prisma.proposal.findMany({
      where: { clientId },
      select: {
        status: true,
        createdAt: true,
      },
    });

    if (proposals.length === 0) return 30; // New client

    const acceptedCount = proposals.filter((p) => p.status === 'APPROVED').length;
    const acceptanceRate = (acceptedCount / proposals.length) * 100;

    // Check relationship length
    const oldestProposal = proposals.reduce((oldest, p) =>
      new Date(p.createdAt) < new Date(oldest.createdAt) ? p : oldest,
    );

    const relationshipMonths =
      (Date.now() - new Date(oldestProposal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);

    let score = acceptanceRate * 0.6;
    if (relationshipMonths > 12) score += 20;
    else if (relationshipMonths > 6) score += 10;

    return Math.min(100, score);
  }

  private async estimateConversionRate(clientId: string, price: number): Promise<number> {
    // Get historical data
    const proposals = await this.prisma.proposal.findMany({
      where: { clientId },
      select: {
        totalAmount: true,
        status: true,
      },
    });

    if (proposals.length === 0) return 50; // Default

    // Calculate base conversion rate
    const acceptedCount = proposals.filter((p) => p.status === 'APPROVED').length;
    const baseRate = (acceptedCount / proposals.length) * 100;

    // Adjust based on price vs historical average
    const avgPrice = proposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0) / proposals.length;

    if (avgPrice === 0) return baseRate;

    const priceRatio = price / avgPrice;

    // Simple price sensitivity model
    let adjustedRate = baseRate;
    if (priceRatio > 1.3) adjustedRate *= 0.6;
    else if (priceRatio > 1.1) adjustedRate *= 0.8;
    else if (priceRatio < 0.9) adjustedRate *= 1.1;

    return Math.max(10, Math.min(90, adjustedRate));
  }

  private roundToTier(price: number): number {
    // Round to common pricing tiers
    const tiers = [99, 199, 299, 499, 999, 1999, 2999, 4999, 9999];

    for (const tier of tiers) {
      if (price <= tier) return tier;
    }

    // Round to nearest 1000
    return Math.round(price / 1000) * 1000;
  }

  private calculatePricingConfidence(factors: Record<string, number>): number {
    // Confidence based on how much data we have
    const scores = Object.values(factors);
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Higher average score = more data = higher confidence
    if (avg > 70) return 0.9;
    if (avg > 50) return 0.75;
    if (avg > 30) return 0.6;
    return 0.5;
  }

  private getDefaultPricing(
    productId: string,
    clientId: string,
    basePrice: number,
    strategy: PricingStrategy,
  ): DynamicPriceResponseDto {
    return {
      productId,
      clientId,
      basePrice,
      recommendedPrice: basePrice,
      discountPercentage: 0,
      strategy,
      factors: {
        clientValue: { score: 50, weight: 0.25, impact: 0 },
        marketDemand: { score: 50, weight: 0.2, impact: 0 },
        competitivePosition: { score: 50, weight: 0.2, impact: 0 },
        urgency: { score: 50, weight: 0.15, impact: 0 },
        relationship: { score: 50, weight: 0.2, impact: 0 },
      },
      confidence: 0.5,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }
}
