import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RecommendationType {
  UPSELL = 'upsell',
  CROSS_SELL = 'cross_sell',
  BUNDLE = 'bundle',
  UPGRADE = 'upgrade',
  ADD_ON = 'add_on',
}

export enum PricingStrategy {
  VALUE_BASED = 'value_based',
  COMPETITIVE = 'competitive',
  COST_PLUS = 'cost_plus',
  DYNAMIC = 'dynamic',
  TIERED = 'tiered',
}

export class GetRecommendationsDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional({ enum: RecommendationType, type: [String] })
  @IsOptional()
  @IsArray()
  @IsEnum(RecommendationType, { each: true })
  types?: RecommendationType[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeRationale?: boolean;
}

export class RecommendationDto {
  id: string;
  type: RecommendationType;
  productId?: string;
  productName: string;
  description: string;
  currentPrice?: number;
  recommendedPrice: number;
  potentialRevenue: number;
  confidence: number; // 0-1
  reasoning: string[];
  clientFit: number; // 0-100
  priority: number; // 1-5
  estimatedCloseRate: number; // Percentage
  suggestedTiming: string; // 'immediate', 'follow_up', 'renewal'
}

export class GenerateRecommendationsDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class CalculateDynamicPriceDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ enum: PricingStrategy })
  @IsOptional()
  @IsEnum(PricingStrategy)
  strategy?: PricingStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basePrice?: number;
}

export class DynamicPriceResponseDto {
  productId: string;
  clientId: string;
  basePrice: number;
  recommendedPrice: number;
  discountPercentage: number;
  strategy: PricingStrategy;
  factors: {
    clientValue: { score: number; weight: number; impact: number };
    marketDemand: { score: number; weight: number; impact: number };
    competitivePosition: { score: number; weight: number; impact: number };
    urgency: { score: number; weight: number; impact: number };
    relationship: { score: number; weight: number; impact: number };
  };
  confidence: number;
  validUntil: Date;
}

export class ClientProfilingDto {
  @ApiProperty()
  @IsString()
  clientId: string;
}

export class ClientProfileDto {
  clientId: string;
  clientName: string;

  // Financial
  totalRevenue: number;
  averageOrderValue: number;
  lifetimeValue: number;
  paymentHistory: 'excellent' | 'good' | 'fair' | 'poor';

  // Engagement
  engagementScore: number; // 0-100
  proposalsViewed: number;
  proposalsAccepted: number;
  acceptanceRate: number;

  // Behavioral
  preferredProducts: string[];
  priceSearchity: 'high' | 'medium' | 'low';
  decisionSpeed: 'fast' | 'medium' | 'slow';

  // Segmentation
  segment: string;
  industry: string;
  companySize: string;

  // Recommendations
  recommendedStrategy: string;
  upsellPotential: number; // 0-100
  churnRisk: number; // 0-100
}

export class BundleRecommendationDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(10)
  minItems?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(50)
  minDiscountPercentage?: number;
}

export class BundleDto {
  id: string;
  name: string;
  description: string;
  products: Array<{
    productId: string;
    productName: string;
    individualPrice: number;
  }>;
  bundlePrice: number;
  individualTotal: number;
  savings: number;
  savingsPercentage: number;
  confidence: number;
  reasoning: string[];
}

export class PriceOptimizationDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aggressiveDiscounting?: boolean;
}

export class PriceOptimizationResultDto {
  proposalId: string;
  originalTotal: number;
  optimizedTotal: number;
  potentialSavings: number;
  recommendations: Array<{
    itemId: string;
    itemName: string;
    currentPrice: number;
    optimizedPrice: number;
    rationale: string;
    confidence: number;
  }>;
  estimatedAcceptanceImprovement: number; // Percentage
}

export class CrossSellOpportunityDto {
  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class CrossSellProductDto {
  productId: string;
  productName: string;
  category: string;
  price: number;
  compatibility: number; // 0-100
  buyRate: number; // Percentage of similar clients who bought this
  reasoning: string;
  estimatedRevenue: number;
}

export class UpsellTriggerDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty({ enum: ['approval', 'view', 'milestone'] })
  @IsEnum(['approval', 'view', 'milestone'])
  triggerType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sendImmediately?: boolean;
}

export class UpsellCampaignDto {
  id: string;
  name: string;
  targetClientIds: string[];
  recommendations: RecommendationDto[];
  estimatedRevenue: number;
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'active' | 'completed';
}
