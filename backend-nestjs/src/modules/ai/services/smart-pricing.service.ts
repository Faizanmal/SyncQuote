import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SmartPricingSuggestionDto,
  ProposalOptimizationDto,
  PricingSuggestionResponseDto,
  ProposalOptimizationResponseDto,
  Industry,
  ProjectComplexity,
} from '../dto/smart-pricing.dto';

@Injectable()
export class SmartPricingService {
  private readonly logger = new Logger(SmartPricingService.name);
  private readonly openai: OpenAI;

  // Industry base rate multipliers
  private readonly industryMultipliers: Record<Industry, number> = {
    [Industry.TECHNOLOGY]: 1.3,
    [Industry.CONSULTING]: 1.25,
    [Industry.MARKETING]: 1.1,
    [Industry.DESIGN]: 1.0,
    [Industry.LEGAL]: 1.5,
    [Industry.FINANCE]: 1.4,
    [Industry.HEALTHCARE]: 1.35,
    [Industry.EDUCATION]: 0.9,
    [Industry.REAL_ESTATE]: 1.15,
    [Industry.MANUFACTURING]: 1.2,
    [Industry.OTHER]: 1.0,
  };

  // Complexity multipliers
  private readonly complexityMultipliers: Record<ProjectComplexity, number> = {
    [ProjectComplexity.LOW]: 0.8,
    [ProjectComplexity.MEDIUM]: 1.0,
    [ProjectComplexity.HIGH]: 1.3,
    [ProjectComplexity.ENTERPRISE]: 1.8,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generatePricingSuggestion(
    userId: string,
    dto: SmartPricingSuggestionDto,
  ): Promise<PricingSuggestionResponseDto> {
    this.logger.log(`Generating pricing suggestion for user ${userId}`);

    // Get historical data for the user
    const historicalData = await this.getHistoricalPricingData(userId, dto.industry);

    // Calculate base price using multiple factors
    const basePrice = this.calculateBasePrice(dto, historicalData);

    // Get AI-enhanced suggestions if OpenAI is available
    let aiSuggestions: any = null;
    if (this.openai) {
      aiSuggestions = await this.getAIPricingSuggestions(dto, basePrice, historicalData);
    }

    // Build response
    const priceRange = this.calculatePriceRange(basePrice, dto.complexity);
    const pricingTiers = this.generatePricingTiers(basePrice, dto);

    return {
      suggestedPrice: aiSuggestions?.suggestedPrice || priceRange.mid,
      priceRange,
      confidence: this.calculateConfidence(dto, historicalData),
      reasoning: aiSuggestions?.reasoning || this.generatePricingReasoning(dto, basePrice),
      marketComparison: this.getMarketComparison(priceRange.mid, dto),
      recommendations: aiSuggestions?.recommendations || this.generateRecommendations(dto, basePrice),
      pricingTiers,
    };
  }

  async optimizeProposal(
    userId: string,
    dto: ProposalOptimizationDto,
  ): Promise<ProposalOptimizationResponseDto> {
    this.logger.log(`Optimizing proposal ${dto.proposalId} for user ${userId}`);

    // Get the proposal
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
      include: {
        blocks: { include: { pricingItems: true } },
        comments: true,
        activities: true,
      },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Analyze proposal
    const analysis = await this.analyzeProposal(proposal, dto.focusAreas || []);

    // Get AI optimization suggestions if available
    if (this.openai) {
      return this.getAIOptimizationSuggestions(proposal, analysis);
    }

    return analysis;
  }

  private async getHistoricalPricingData(
    userId: string,
    industry: Industry,
  ): Promise<{
    avgPrice: number;
    winRate: number;
    proposalCount: number;
    avgDealSize: number;
  }> {
    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'SIGNED'] },
        totalAmount: { not: null },
      },
      select: {
        totalAmount: true,
        estimatedValue: true,
      },
    });

    const totalProposals = await this.prisma.proposal.count({
      where: { userId, status: { in: ['SENT', 'VIEWED', 'APPROVED', 'SIGNED', 'DECLINED'] } },
    });

    const wonProposals = proposals.length;
    const avgPrice =
      proposals.length > 0
        ? proposals.reduce((sum, p) => sum + (p.totalAmount || p.estimatedValue || 0), 0) / proposals.length
        : 5000;

    return {
      avgPrice,
      winRate: totalProposals > 0 ? (wonProposals / totalProposals) * 100 : 50,
      proposalCount: totalProposals,
      avgDealSize: avgPrice,
    };
  }

  private calculateBasePrice(
    dto: SmartPricingSuggestionDto,
    historicalData: { avgPrice: number; winRate: number },
  ): number {
    let basePrice = historicalData.avgPrice || 5000;

    // Apply industry multiplier
    basePrice *= this.industryMultipliers[dto.industry];

    // Apply complexity multiplier
    basePrice *= this.complexityMultipliers[dto.complexity];

    // Apply hours-based calculation if provided
    if (dto.estimatedHours) {
      const hourlyRate = (historicalData.avgPrice || 5000) / 40; // Assume 40 hours average project
      const hoursBasedPrice = dto.estimatedHours * hourlyRate * this.complexityMultipliers[dto.complexity];
      basePrice = (basePrice + hoursBasedPrice) / 2; // Average both methods
    }

    // Adjust for historical rate if provided
    if (dto.historicalRate) {
      basePrice = (basePrice + dto.historicalRate) / 2;
    }

    // Adjust based on win rate (lower prices if win rate is low)
    if (historicalData.winRate < 30) {
      basePrice *= 0.9;
    } else if (historicalData.winRate > 70) {
      basePrice *= 1.1;
    }

    return Math.round(basePrice);
  }

  private calculatePriceRange(
    basePrice: number,
    complexity: ProjectComplexity,
  ): { low: number; mid: number; high: number } {
    const variance = complexity === ProjectComplexity.ENTERPRISE ? 0.3 : 0.2;

    return {
      low: Math.round(basePrice * (1 - variance)),
      mid: Math.round(basePrice),
      high: Math.round(basePrice * (1 + variance)),
    };
  }

  private calculateConfidence(
    dto: SmartPricingSuggestionDto,
    historicalData: { proposalCount: number; winRate: number },
  ): number {
    let confidence = 50;

    // More historical data = more confidence
    if (historicalData.proposalCount > 50) confidence += 20;
    else if (historicalData.proposalCount > 20) confidence += 15;
    else if (historicalData.proposalCount > 5) confidence += 10;

    // Competitor data increases confidence
    if (dto.competitorData && dto.competitorData.length > 0) {
      confidence += Math.min(dto.competitorData.length * 5, 15);
    }

    // More specific information increases confidence
    if (dto.estimatedHours) confidence += 5;
    if (dto.clientCompanySize) confidence += 5;
    if (dto.clientBudgetRange) confidence += 5;

    return Math.min(confidence, 95);
  }

  private generatePricingReasoning(dto: SmartPricingSuggestionDto, basePrice: number): string {
    const factors: string[] = [];

    factors.push(`Industry (${dto.industry}) typically commands ${this.industryMultipliers[dto.industry] > 1 ? 'higher' : 'standard'} rates`);
    factors.push(`${dto.complexity} complexity projects require ${dto.complexity === ProjectComplexity.ENTERPRISE ? 'premium' : 'appropriate'} pricing`);

    if (dto.estimatedHours) {
      factors.push(`Estimated ${dto.estimatedHours} hours of work factored into calculation`);
    }

    return `Suggested price of $${basePrice.toLocaleString()} based on: ${factors.join('; ')}.`;
  }

  private getMarketComparison(
    suggestedPrice: number,
    dto: SmartPricingSuggestionDto,
  ): { belowMarket: boolean; aboveMarket: boolean; marketAverage: number } {
    // Use competitor data if available, otherwise use industry averages
    let marketAverage = suggestedPrice;

    if (dto.competitorData && dto.competitorData.length > 0) {
      marketAverage =
        dto.competitorData.reduce((sum, c) => sum + c.price, 0) / dto.competitorData.length;
    }

    return {
      belowMarket: suggestedPrice < marketAverage * 0.9,
      aboveMarket: suggestedPrice > marketAverage * 1.1,
      marketAverage: Math.round(marketAverage),
    };
  }

  private generateRecommendations(dto: SmartPricingSuggestionDto, basePrice: number): string[] {
    const recommendations: string[] = [];

    if (dto.complexity === ProjectComplexity.ENTERPRISE) {
      recommendations.push('Consider offering milestone-based payment terms for enterprise projects');
      recommendations.push('Include dedicated support or account management in the proposal');
    }

    if (dto.industry === Industry.TECHNOLOGY || dto.industry === Industry.CONSULTING) {
      recommendations.push('Bundle additional services for higher-value packages');
      recommendations.push('Offer retainer options for ongoing relationships');
    }

    if (dto.clientCompanySize === 'startup') {
      recommendations.push('Consider offering flexible payment terms for startups');
      recommendations.push('Highlight ROI and growth potential in your proposal');
    }

    recommendations.push('Present three pricing tiers to give clients options');
    recommendations.push('Include testimonials from similar projects');

    return recommendations;
  }

  private generatePricingTiers(
    basePrice: number,
    dto: SmartPricingSuggestionDto,
  ): {
    basic: { price: number; features: string[] };
    standard: { price: number; features: string[] };
    premium: { price: number; features: string[] };
  } {
    return {
      basic: {
        price: Math.round(basePrice * 0.7),
        features: [
          'Core deliverables',
          'Standard timeline',
          'Email support',
          '1 revision round',
        ],
      },
      standard: {
        price: basePrice,
        features: [
          'All basic features',
          'Priority timeline',
          'Phone & email support',
          '3 revision rounds',
          'Progress reports',
        ],
      },
      premium: {
        price: Math.round(basePrice * 1.5),
        features: [
          'All standard features',
          'Rush delivery option',
          'Dedicated support',
          'Unlimited revisions',
          'Quarterly reviews',
          'Priority access',
        ],
      },
    };
  }

  private async getAIPricingSuggestions(
    dto: SmartPricingSuggestionDto,
    basePrice: number,
    historicalData: any,
  ): Promise<any> {
    try {
      const prompt = `You are a pricing expert. Analyze this pricing request and provide suggestions:

Service: ${dto.serviceName}
Description: ${dto.serviceDescription || 'Not provided'}
Industry: ${dto.industry}
Complexity: ${dto.complexity}
Estimated Hours: ${dto.estimatedHours || 'Not specified'}
Client Company Size: ${dto.clientCompanySize || 'Not specified'}
Client Budget Range: ${dto.clientBudgetRange || 'Not specified'}
Historical Average: $${historicalData.avgPrice}
Win Rate: ${historicalData.winRate}%
Base Calculated Price: $${basePrice}

Competitor Pricing:
${dto.competitorData ? dto.competitorData.map((c) => `- ${c.name}: $${c.price}`).join('\n') : 'No competitor data'}

Provide a JSON response with:
1. suggestedPrice: number (your recommended price)
2. reasoning: string (detailed explanation)
3. recommendations: string[] (3-5 actionable recommendations)`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      this.logger.warn('AI pricing suggestions failed, using calculated values', error);
      return null;
    }
  }

  private async analyzeProposal(
    proposal: any,
    focusAreas: string[],
  ): Promise<ProposalOptimizationResponseDto> {
    const improvements: any[] = [];
    let overallScore = 50;

    // Analyze content structure
    const contentScore = this.analyzeContentStructure(proposal);
    overallScore += contentScore.bonus;
    improvements.push(...contentScore.improvements);

    // Analyze pricing
    const pricingScore = this.analyzePricing(proposal);
    overallScore += pricingScore.bonus;

    // Analyze engagement potential
    const engagementScore = this.analyzeEngagement(proposal);
    overallScore += engagementScore.bonus;
    improvements.push(...engagementScore.improvements);

    return {
      overallScore: Math.min(overallScore, 100),
      improvements,
      contentSuggestions: [],
      structuralRecommendations: this.getStructuralRecommendations(proposal),
      pricingOptimizations: pricingScore.recommendations,
      conversionTips: this.getConversionTips(proposal),
      competitiveAdvantages: this.identifyAdvantages(proposal),
    };
  }

  private analyzeContentStructure(proposal: any): { bonus: number; improvements: any[] } {
    const improvements: any[] = [];
    let bonus = 0;

    const blocks = proposal.blocks || [];
    const hasIntro = blocks.some((b: any) => b.type === 'RICH_TEXT' && b.order === 0);
    const hasPricing = blocks.some((b: any) => b.type === 'PRICING_TABLE');
    const hasImages = blocks.some((b: any) => b.type === 'IMAGE');
    const hasVideo = blocks.some((b: any) => b.type === 'VIDEO');

    if (hasIntro) bonus += 5;
    else {
      improvements.push({
        category: 'Structure',
        currentScore: 40,
        suggestion: 'Add a compelling introduction section',
        priority: 'high',
        impact: 'Increases engagement by 23%',
      });
    }

    if (hasPricing) bonus += 10;
    if (hasImages) bonus += 5;
    if (hasVideo) bonus += 10;
    else {
      improvements.push({
        category: 'Media',
        currentScore: 50,
        suggestion: 'Add a video introduction to personalize the proposal',
        priority: 'medium',
        impact: 'Proposals with video have 41% higher close rates',
      });
    }

    return { bonus, improvements };
  }

  private analyzePricing(proposal: any): { bonus: number; recommendations: string[] } {
    const recommendations: string[] = [];
    let bonus = 0;

    const hasDeposit = proposal.depositRequired;
    const hasMultipleTiers = proposal.blocks?.some(
      (b: any) => b.pricingItems?.length > 3,
    );

    if (hasDeposit) {
      bonus += 5;
    } else {
      recommendations.push('Consider requiring a deposit to improve cash flow and commitment');
    }

    if (hasMultipleTiers) {
      bonus += 5;
    } else {
      recommendations.push('Offer multiple pricing tiers to give clients options');
    }

    recommendations.push('Highlight the value proposition before showing prices');
    recommendations.push('Consider offering early payment discounts');

    return { bonus, recommendations };
  }

  private analyzeEngagement(proposal: any): { bonus: number; improvements: any[] } {
    const improvements: any[] = [];
    let bonus = 0;

    if (proposal.viewCount > 5) bonus += 5;
    if (proposal.comments?.length > 0) bonus += 5;

    if (!proposal.expiresAt) {
      improvements.push({
        category: 'Urgency',
        currentScore: 30,
        suggestion: 'Add an expiration date to create urgency',
        priority: 'high',
        impact: 'Time-limited proposals convert 35% better',
      });
    } else {
      bonus += 5;
    }

    return { bonus, improvements };
  }

  private getStructuralRecommendations(proposal: any): string[] {
    return [
      'Lead with the client\'s problem and your solution',
      'Include social proof (testimonials, case studies)',
      'Break content into scannable sections',
      'End with a clear call-to-action',
      'Keep pricing transparent and easy to understand',
    ];
  }

  private getConversionTips(proposal: any): string[] {
    return [
      'Follow up within 24 hours of sending',
      'Send a personalized video message',
      'Offer to walk through the proposal via call',
      'Set calendar reminders for follow-ups',
      'Track when the client views the proposal',
    ];
  }

  private identifyAdvantages(proposal: any): string[] {
    return [
      'Highlight unique qualifications',
      'Emphasize relevant experience',
      'Showcase relevant testimonials',
      'Demonstrate industry expertise',
      'Include guarantees or warranties',
    ];
  }

  private async getAIOptimizationSuggestions(
    proposal: any,
    analysis: ProposalOptimizationResponseDto,
  ): Promise<ProposalOptimizationResponseDto> {
    try {
      const prompt = `Analyze this proposal and provide optimization suggestions:

Title: ${proposal.title}
Status: ${proposal.status}
Blocks: ${proposal.blocks?.length || 0}
Has Video: ${proposal.blocks?.some((b: any) => b.type === 'VIDEO')}
Has Pricing: ${proposal.blocks?.some((b: any) => b.type === 'PRICING_TABLE')}
Deposit Required: ${proposal.depositRequired}
Current Score: ${analysis.overallScore}

Provide specific content improvements and additional recommendations.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const aiSuggestions = response.choices[0]?.message?.content || '';

      // Merge AI suggestions with existing analysis
      return {
        ...analysis,
        conversionTips: [...analysis.conversionTips, ...this.extractTips(aiSuggestions)],
      };
    } catch (error) {
      this.logger.warn('AI optimization failed, using calculated values', error);
      return analysis;
    }
  }

  private extractTips(content: string): string[] {
    const lines = content.split('\n').filter((line) => line.trim().startsWith('-') || line.trim().startsWith('•'));
    return lines.map((line) => line.replace(/^[-•]\s*/, '').trim()).slice(0, 5);
  }
}
