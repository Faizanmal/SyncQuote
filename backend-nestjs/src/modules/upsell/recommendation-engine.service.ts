import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RecommendationDto,
  RecommendationType,
  ClientProfileDto,
  BundleDto,
  CrossSellProductDto,
} from './dto/upsell.dto';

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(private prisma: PrismaService) {}

  // Generate ML-powered recommendations
  async generateRecommendations(
    proposalId: string,
    types?: RecommendationType[],
    limit: number = 5,
  ): Promise<RecommendationDto[]> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || !proposal.clientId) {
      return [];
    }

    const clientProfile = await this.getClientProfile(proposal.clientId);
    const recommendations: RecommendationDto[] = [];

    // Generate different types of recommendations
    if (!types || types.includes(RecommendationType.UPSELL)) {
      recommendations.push(...(await this.generateUpsellRecommendations(proposal, clientProfile)));
    }

    if (!types || types.includes(RecommendationType.CROSS_SELL)) {
      recommendations.push(
        ...(await this.generateCrossSellRecommendations(proposal, clientProfile)),
      );
    }

    if (!types || types.includes(RecommendationType.BUNDLE)) {
      recommendations.push(...(await this.generateBundleRecommendations(proposal, clientProfile)));
    }

    if (!types || types.includes(RecommendationType.UPGRADE)) {
      recommendations.push(...(await this.generateUpgradeRecommendations(proposal, clientProfile)));
    }

    if (!types || types.includes(RecommendationType.ADD_ON)) {
      recommendations.push(...(await this.generateAddOnRecommendations(proposal, clientProfile)));
    }

    // Sort by priority and confidence
    return recommendations
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      })
      .slice(0, limit);
  }

  // Get client profile for ML scoring
  async getClientProfile(clientId: string): Promise<ClientProfileDto> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return this.getDefaultClientProfile(clientId);
    }

    // Get client's proposal history
    const proposals = await this.prisma.proposal.findMany({
      where: { clientId },
      select: {
        status: true,
        totalAmount: true,
        createdAt: true,
        viewCount: true,
      },
    });

    const acceptedProposals = proposals.filter((p) => p.status === 'APPROVED');
    const totalRevenue = acceptedProposals.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const averageOrderValue =
      acceptedProposals.length > 0 ? totalRevenue / acceptedProposals.length : 0;

    const acceptanceRate =
      proposals.length > 0 ? (acceptedProposals.length / proposals.length) * 100 : 0;

    // Calculate engagement score
    const totalViews = proposals.reduce((sum, p) => sum + (p.viewCount || 0), 0);
    const engagementScore = Math.min(100, (totalViews / proposals.length) * 10 + acceptanceRate);

    // Determine price sensitivity (simplified)
    const priceSensitivity =
      averageOrderValue > 10000 ? 'low' : averageOrderValue > 5000 ? 'medium' : 'high';

    // Calculate decision speed
    const avgDaysToDecision = this.calculateAvgDaysToDecision(proposals);
    const decisionSpeed =
      avgDaysToDecision < 7 ? 'fast' : avgDaysToDecision < 14 ? 'medium' : 'slow';

    return {
      clientId,
      clientName: client.name || 'Unknown',
      totalRevenue,
      averageOrderValue,
      lifetimeValue: totalRevenue * 1.5, // Simplified LTV
      paymentHistory: acceptanceRate > 80 ? 'excellent' : acceptanceRate > 60 ? 'good' : 'fair',
      engagementScore,
      proposalsViewed: proposals.length,
      proposalsAccepted: acceptedProposals.length,
      acceptanceRate,
      preferredProducts: await this.getPreferredProducts(clientId),
      priceSearchity: priceSensitivity as any,
      decisionSpeed: decisionSpeed as any,
      segment: this.determineSegment(averageOrderValue, acceptanceRate),
      industry: (client.metadata as any)?.industry || 'Unknown',
      companySize: (client.metadata as any)?.companySize || 'Unknown',
      recommendedStrategy: this.determineStrategy(priceSensitivity, decisionSpeed),
      upsellPotential: this.calculateUpsellPotential({
        averageOrderValue,
        acceptanceRate,
        engagementScore,
      } as any),
      churnRisk: this.calculateChurnRisk(proposals),
    };
  }

  // Generate upsell recommendations
  private async generateUpsellRecommendations(
    proposal: any,
    clientProfile: ClientProfileDto,
  ): Promise<RecommendationDto[]> {
    const recommendations: RecommendationDto[] = [];

    // Get current products in proposal
    const currentProducts = this.extractProductsFromProposal(proposal);

    // Find higher-tier versions
    for (const product of currentProducts) {
      const higherTier = await this.findHigherTierProduct(product);

      if (higherTier) {
        recommendations.push({
          id: `upsell-${higherTier.id}`,
          type: RecommendationType.UPSELL,
          productId: higherTier.id,
          productName: higherTier.name,
          description: `Upgrade to ${higherTier.name} for additional features`,
          currentPrice: product.price,
          recommendedPrice: higherTier.price,
          potentialRevenue: higherTier.price - product.price,
          confidence: this.calculateConfidence(clientProfile, higherTier),
          reasoning: [
            `Client has ${clientProfile.acceptanceRate.toFixed(0)}% acceptance rate`,
            `Average order value: $${clientProfile.averageOrderValue.toFixed(2)}`,
            `Higher tier includes premium features`,
          ],
          clientFit: this.calculateClientFit(clientProfile, higherTier),
          priority: 1,
          estimatedCloseRate: this.estimateCloseRate(clientProfile, higherTier.price),
          suggestedTiming: clientProfile.decisionSpeed === 'fast' ? 'immediate' : 'follow_up',
        });
      }
    }

    return recommendations;
  }

  // Generate cross-sell recommendations
  private async generateCrossSellRecommendations(
    proposal: any,
    clientProfile: ClientProfileDto,
  ): Promise<RecommendationDto[]> {
    const recommendations: RecommendationDto[] = [];
    const currentProducts = this.extractProductsFromProposal(proposal);

    // Find complementary products
    for (const product of currentProducts) {
      const complementary = await this.findComplementaryProducts(product, clientProfile);

      for (const comp of complementary.slice(0, 2)) {
        recommendations.push({
          id: `cross-${comp.id}`,
          type: RecommendationType.CROSS_SELL,
          productId: comp.id,
          productName: comp.name,
          description: `Frequently bought together with ${product.name}`,
          recommendedPrice: comp.price,
          potentialRevenue: comp.price,
          confidence: comp.confidence,
          reasoning: [
            `${comp.buyRate}% of similar clients purchased this`,
            `High compatibility with ${product.name}`,
            `Fits client's ${clientProfile.segment} segment`,
          ],
          clientFit: comp.compatibility,
          priority: 2,
          estimatedCloseRate: comp.buyRate,
          suggestedTiming: 'immediate',
        });
      }
    }

    return recommendations;
  }

  // Generate bundle recommendations
  private async generateBundleRecommendations(
    proposal: any,
    clientProfile: ClientProfileDto,
  ): Promise<RecommendationDto[]> {
    const recommendations: RecommendationDto[] = [];
    const currentProducts = this.extractProductsFromProposal(proposal);

    if (currentProducts.length < 2) {
      return recommendations;
    }

    // Suggest adding one more product for bundle discount
    const additionalProduct = await this.findBestBundleAddition(currentProducts, clientProfile);

    if (additionalProduct) {
      const bundleDiscount = 0.15; // 15% bundle discount
      const currentTotal = currentProducts.reduce((sum, p) => sum + p.price, 0);
      const newTotal = currentTotal + additionalProduct.price;
      const bundlePrice = newTotal * (1 - bundleDiscount);

      recommendations.push({
        id: `bundle-${additionalProduct.id}`,
        type: RecommendationType.BUNDLE,
        productId: additionalProduct.id,
        productName: additionalProduct.name,
        description: `Add ${additionalProduct.name} and save ${(bundleDiscount * 100).toFixed(0)}% on the bundle`,
        recommendedPrice: bundlePrice,
        potentialRevenue: additionalProduct.price,
        confidence: 0.7,
        reasoning: [
          `Save $${(newTotal - bundlePrice).toFixed(2)} with bundle pricing`,
          `Commonly bundled with your selected products`,
          `Best value for your needs`,
        ],
        clientFit: 80,
        priority: 2,
        estimatedCloseRate: 65,
        suggestedTiming: 'immediate',
      });
    }

    return recommendations;
  }

  // Generate upgrade recommendations
  private async generateUpgradeRecommendations(
    proposal: any,
    clientProfile: ClientProfileDto,
  ): Promise<RecommendationDto[]> {
    const recommendations: RecommendationDto[] = [];

    // Check if client is on basic plan/tier
    const currentTier = this.extractTierFromProposal(proposal);

    if (currentTier === 'basic' || currentTier === 'standard') {
      const nextTier = currentTier === 'basic' ? 'standard' : 'premium';
      const tierDiff = currentTier === 'basic' ? 100 : 200;

      recommendations.push({
        id: `upgrade-${nextTier}`,
        type: RecommendationType.UPGRADE,
        productName: `${nextTier.charAt(0).toUpperCase() + nextTier.slice(1)} Plan`,
        description: `Upgrade to ${nextTier} for advanced features and priority support`,
        currentPrice: proposal.totalAmount || 0,
        recommendedPrice: (proposal.totalAmount || 0) + tierDiff,
        potentialRevenue: tierDiff,
        confidence: clientProfile.upsellPotential / 100,
        reasoning: [
          `Your usage patterns suggest ${nextTier} plan would be beneficial`,
          `Unlock advanced analytics and automation`,
          `Priority support and dedicated account manager`,
        ],
        clientFit: clientProfile.upsellPotential,
        priority: 1,
        estimatedCloseRate: this.estimateCloseRate(clientProfile, tierDiff),
        suggestedTiming: 'follow_up',
      });
    }

    return recommendations;
  }

  // Generate add-on recommendations
  private async generateAddOnRecommendations(
    proposal: any,
    clientProfile: ClientProfileDto,
  ): Promise<RecommendationDto[]> {
    const recommendations: RecommendationDto[] = [];

    // Common add-ons
    const addOns = [
      { name: 'Priority Support', price: 99, fit: 85 },
      { name: 'Advanced Analytics', price: 149, fit: 75 },
      { name: 'API Access', price: 199, fit: 60 },
      { name: 'White Label', price: 299, fit: 70 },
    ];

    for (const addOn of addOns) {
      if (clientProfile.averageOrderValue > addOn.price * 5) {
        recommendations.push({
          id: `addon-${addOn.name.toLowerCase().replace(/\s/g, '-')}`,
          type: RecommendationType.ADD_ON,
          productName: addOn.name,
          description: `Enhance your experience with ${addOn.name}`,
          recommendedPrice: addOn.price,
          potentialRevenue: addOn.price,
          confidence: addOn.fit / 100,
          reasoning: [
            `Recommended for ${clientProfile.segment} segment clients`,
            `Adds significant value to your package`,
          ],
          clientFit: addOn.fit,
          priority: 3,
          estimatedCloseRate: addOn.fit * 0.6,
          suggestedTiming: 'follow_up',
        });
      }
    }

    return recommendations.slice(0, 2);
  }

  // Helper methods
  private getDefaultClientProfile(clientId: string): ClientProfileDto {
    return {
      clientId,
      clientName: 'Unknown',
      totalRevenue: 0,
      averageOrderValue: 0,
      lifetimeValue: 0,
      paymentHistory: 'fair',
      engagementScore: 50,
      proposalsViewed: 0,
      proposalsAccepted: 0,
      acceptanceRate: 0,
      preferredProducts: [],
      priceSearchity: 'medium',
      decisionSpeed: 'medium',
      segment: 'new',
      industry: 'Unknown',
      companySize: 'Unknown',
      recommendedStrategy: 'balanced',
      upsellPotential: 50,
      churnRisk: 30,
    };
  }

  private extractProductsFromProposal(proposal: any): any[] {
    // Simplified - extract from pricing blocks
    const products: any[] = [];

    for (const block of proposal.blocks || []) {
      if (block.type === 'pricing' && block.content?.items) {
        products.push(
          ...block.content.items.map((item: any) => ({
            id: item.id || item.name,
            name: item.name,
            price: parseFloat(item.price) || 0,
          })),
        );
      }
    }

    return products;
  }

  private async findHigherTierProduct(product: any): Promise<any | null> {
    // Simplified - would query product database
    return null;
  }

  private async findComplementaryProducts(
    product: any,
    clientProfile: ClientProfileDto,
  ): Promise<any[]> {
    // Simplified - would use collaborative filtering
    return [];
  }

  private async findBestBundleAddition(
    products: any[],
    clientProfile: ClientProfileDto,
  ): Promise<any | null> {
    return null;
  }

  private extractTierFromProposal(proposal: any): string {
    return proposal.metadata?.tier || 'basic';
  }

  private async getPreferredProducts(clientId: string): Promise<string[]> {
    return [];
  }

  private calculateAvgDaysToDecision(proposals: any[]): number {
    return 10; // Simplified
  }

  private determineSegment(aov: number, acceptanceRate: number): string {
    if (aov > 10000 && acceptanceRate > 70) return 'enterprise';
    if (aov > 5000) return 'mid-market';
    return 'smb';
  }

  private determineStrategy(priceSensitivity: string, decisionSpeed: string): string {
    if (priceSensitivity === 'low' && decisionSpeed === 'fast') return 'premium-aggressive';
    if (priceSensitivity === 'high') return 'value-focused';
    return 'balanced';
  }

  private calculateUpsellPotential(clientProfile: ClientProfileDto): number {
    let score = 50;

    if (clientProfile.acceptanceRate > 70) score += 20;
    if (clientProfile.engagementScore > 70) score += 15;
    if (clientProfile.averageOrderValue > 5000) score += 15;

    return Math.min(100, score);
  }

  private calculateChurnRisk(proposals: any[]): number {
    if (proposals.length === 0) return 50;

    const recentProposals = proposals.filter((p) => {
      const daysSince = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 90;
    });

    return recentProposals.length === 0 ? 70 : 20;
  }

  private calculateConfidence(clientProfile: ClientProfileDto, product: any): number {
    let confidence = 0.5;

    if (clientProfile.acceptanceRate > 70) confidence += 0.2;
    if (clientProfile.engagementScore > 70) confidence += 0.15;
    if (clientProfile.upsellPotential > 70) confidence += 0.15;

    return Math.min(1, confidence);
  }

  private calculateClientFit(clientProfile: ClientProfileDto, product: any): number {
    return clientProfile.upsellPotential;
  }

  private estimateCloseRate(clientProfile: ClientProfileDto, price: number): number {
    let rate = clientProfile.acceptanceRate;

    // Adjust based on price vs AOV
    if (clientProfile.averageOrderValue > 0) {
      const priceRatio = price / clientProfile.averageOrderValue;
      if (priceRatio > 1.5) rate *= 0.7;
      else if (priceRatio > 1.2) rate *= 0.85;
    }

    return Math.max(10, Math.min(90, rate));
  }
}
