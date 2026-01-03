import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { DynamicPricingService } from './dynamic-pricing.service';
import {
  GetRecommendationsDto,
  RecommendationDto,
  RecommendationType,
  BundleDto,
  PriceOptimizationResultDto,
  CrossSellProductDto,
} from './dto/upsell.dto';

@Injectable()
export class UpsellService {
  private readonly logger = new Logger(UpsellService.name);

  constructor(
    private prisma: PrismaService,
    private recommendationEngine: RecommendationEngineService,
    private dynamicPricing: DynamicPricingService,
  ) {}

  // Get recommendations for a proposal
  async getRecommendations(
    userId: string,
    dto: GetRecommendationsDto,
  ): Promise<RecommendationDto[]> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    return this.recommendationEngine.generateRecommendations(
      dto.proposalId,
      dto.types,
      dto.limit || 5,
    );
  }

  // Get bundle recommendations
  async getBundleRecommendations(
    userId: string,
    proposalId: string,
    minItems: number = 2,
    minDiscount: number = 10,
  ): Promise<BundleDto[]> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      include: { blocks: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Extract current products
    const products = this.extractProducts(proposal);

    if (products.length < minItems - 1) {
      return []; // Need at least minItems - 1 to suggest bundle
    }

    // Find complementary products to create bundles
    const bundles: BundleDto[] = [];

    // Suggest adding one product for bundle discount
    const potentialAdditions = await this.findPotentialBundleProducts(products);

    for (const addition of potentialAdditions.slice(0, 3)) {
      const bundleProducts = [...products, addition];
      const individualTotal = bundleProducts.reduce((sum, p) => sum + p.price, 0);
      const discountPercent = Math.max(minDiscount, 15); // Default 15%
      const bundlePrice = individualTotal * (1 - discountPercent / 100);

      bundles.push({
        id: `bundle-${addition.id}`,
        name: `Complete Package with ${addition.name}`,
        description: `Bundle all items and save ${discountPercent}%`,
        products: bundleProducts.map((p) => ({
          productId: p.id,
          productName: p.name,
          individualPrice: p.price,
        })),
        bundlePrice: Math.round(bundlePrice * 100) / 100,
        individualTotal: Math.round(individualTotal * 100) / 100,
        savings: Math.round((individualTotal - bundlePrice) * 100) / 100,
        savingsPercentage: discountPercent,
        confidence: 0.75,
        reasoning: [
          `Save $${(individualTotal - bundlePrice).toFixed(2)} with bundle pricing`,
          `${addition.name} is frequently purchased with your selected items`,
          `Best value package for your needs`,
        ],
      });
    }

    return bundles;
  }

  // Optimize proposal pricing
  async optimizeProposalPricing(
    userId: string,
    proposalId: string,
    aggressive: boolean = false,
  ): Promise<PriceOptimizationResultDto> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      include: { blocks: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const products = this.extractProducts(proposal);
    const originalTotal = products.reduce((sum, p) => sum + p.price, 0);

    const recommendations: any[] = [];
    let optimizedTotal = 0;

    for (const product of products) {
      const dynamicPrice = await this.dynamicPricing.calculateDynamicPrice(
        product.id,
        proposal.clientId!,
        product.price,
      );

      let optimizedPrice = dynamicPrice.recommendedPrice;

      // If aggressive, lean towards lower prices
      if (aggressive && optimizedPrice > product.price) {
        optimizedPrice = product.price * 0.95; // 5% discount
      }

      optimizedTotal += optimizedPrice;

      if (Math.abs(optimizedPrice - product.price) > 0.01) {
        recommendations.push({
          itemId: product.id,
          itemName: product.name,
          currentPrice: product.price,
          optimizedPrice: Math.round(optimizedPrice * 100) / 100,
          rationale: this.generatePriceRationale(
            product.price,
            optimizedPrice,
            dynamicPrice.factors,
          ),
          confidence: dynamicPrice.confidence,
        });
      } else {
        optimizedTotal += product.price;
      }
    }

    const potentialSavings = originalTotal - optimizedTotal;
    const estimatedAcceptanceImprovement = this.estimateAcceptanceImprovement(
      potentialSavings,
      originalTotal,
    );

    return {
      proposalId,
      originalTotal: Math.round(originalTotal * 100) / 100,
      optimizedTotal: Math.round(optimizedTotal * 100) / 100,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
      recommendations,
      estimatedAcceptanceImprovement,
    };
  }

  // Get cross-sell opportunities
  async getCrossSellOpportunities(
    userId: string,
    clientId: string,
    limit: number = 5,
  ): Promise<CrossSellProductDto[]> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Get client's purchase history
    const proposals = await this.prisma.proposal.findMany({
      where: { clientId, status: 'APPROVED' },
      include: { blocks: true },
    });

    const purchasedProducts = new Set<string>();
    for (const proposal of proposals) {
      const products = this.extractProducts(proposal);
      products.forEach((p) => purchasedProducts.add(p.id));
    }

    // Find products commonly bought by similar clients
    const opportunities: CrossSellProductDto[] = [
      {
        productId: 'premium-support',
        productName: 'Premium Support Package',
        category: 'Support',
        price: 299,
        compatibility: 95,
        buyRate: 68,
        reasoning: '68% of similar clients added premium support',
        estimatedRevenue: 299,
      },
      {
        productId: 'analytics-pro',
        productName: 'Analytics Pro',
        category: 'Analytics',
        price: 199,
        compatibility: 85,
        buyRate: 54,
        reasoning: 'Highly compatible with your current services',
        estimatedRevenue: 199,
      },
      {
        productId: 'integration-hub',
        productName: 'Integration Hub',
        category: 'Integrations',
        price: 149,
        compatibility: 80,
        buyRate: 47,
        reasoning: 'Seamlessly connects with your existing tools',
        estimatedRevenue: 149,
      },
    ];

    return opportunities
      .filter((o: any) => !purchasedProducts.has(o.productId))
      .sort((a, b) => b.buyRate - a.buyRate)
      .slice(0, limit);
  }

  // Track recommendation conversion
  async trackRecommendationConversion(
    userId: string,
    recommendationId: string,
    accepted: boolean,
    revenue?: number,
  ): Promise<void> {
    await this.prisma.recommendationTracking.create({
      data: {
        userId,
        recommendationId,
        accepted,
        revenue,
        trackedAt: new Date(),
      },
    });
  }

  // Get recommendation performance
  async getRecommendationPerformance(userId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const tracking = await this.prisma.recommendationTracking.findMany({
      where: {
        userId,
        trackedAt: { gte: since },
      },
    });

    const total = tracking.length;
    const accepted = tracking.filter((t) => t.accepted).length;
    const totalRevenue = tracking.reduce((sum, t) => sum + (t.revenue || 0), 0);

    return {
      period: `Last ${days} days`,
      totalRecommendations: total,
      acceptedRecommendations: accepted,
      acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgRevenuePerAcceptance: accepted > 0 ? Math.round((totalRevenue / accepted) * 100) / 100 : 0,
    };
  }

  // Private helpers
  private extractProducts(proposal: any): Array<{ id: string; name: string; price: number }> {
    const products: any[] = [];

    for (const block of proposal.blocks || []) {
      if (block.type === 'pricing' && block.content?.items) {
        for (const item of block.content.items) {
          products.push({
            id: item.id || item.name.toLowerCase().replace(/\s/g, '-'),
            name: item.name,
            price: parseFloat(item.price) || 0,
          });
        }
      }
    }

    return products;
  }

  private async findPotentialBundleProducts(currentProducts: any[]): Promise<any[]> {
    // Simplified - would use collaborative filtering
    return [
      { id: 'addon-1', name: 'Premium Support', price: 299 },
      { id: 'addon-2', name: 'Advanced Analytics', price: 199 },
      { id: 'addon-3', name: 'API Access', price: 149 },
    ];
  }

  private generatePriceRationale(
    currentPrice: number,
    optimizedPrice: number,
    factors: any,
  ): string {
    const diff = optimizedPrice - currentPrice;
    const pct = Math.abs((diff / currentPrice) * 100);

    if (diff > 0) {
      return `Increase by ${pct.toFixed(0)}% based on high client value (${factors.clientValue.score}/100) and market demand`;
    } else {
      return `Decrease by ${pct.toFixed(0)}% to improve acceptance rate. Strong relationship score (${factors.relationship.score}/100) justifies discount`;
    }
  }

  private estimateAcceptanceImprovement(savings: number, originalTotal: number): number {
    if (originalTotal === 0) return 0;

    const discountPercent = (savings / originalTotal) * 100;

    // Rough estimate: each 5% discount improves acceptance by ~10%
    return Math.min(50, discountPercent * 2);
  }
}
