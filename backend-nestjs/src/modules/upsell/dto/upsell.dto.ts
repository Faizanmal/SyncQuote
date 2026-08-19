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

export class PricingFactorDto {
  @ApiProperty()
  score: number;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  impact: number;
}

export class DynamicPriceFactorsDto {
  @ApiProperty({ type: () => PricingFactorDto })
  clientValue: PricingFactorDto;

  @ApiProperty({ type: () => PricingFactorDto })
  marketDemand: PricingFactorDto;

  @ApiProperty({ type: () => PricingFactorDto })
  competitivePosition: PricingFactorDto;

  @ApiProperty({ type: () => PricingFactorDto })
  urgency: PricingFactorDto;

  @ApiProperty({ type: () => PricingFactorDto })
  relationship: PricingFactorDto;
}

export class DynamicPriceResponseDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  basePrice: number;

  @ApiProperty()
  recommendedPrice: number;

  @ApiProperty()
  discountPercentage: number;

  @ApiProperty({ enum: PricingStrategy })
  strategy: PricingStrategy;

  @ApiProperty({ type: () => DynamicPriceFactorsDto })
  factors: DynamicPriceFactorsDto;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
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

export class BundleProductDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  individualPrice: number;
}

export class BundleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: () => [BundleProductDto] })
  products: BundleProductDto[];

  @ApiProperty()
  bundlePrice: number;

  @ApiProperty()
  individualTotal: number;

  @ApiProperty()
  savings: number;

  @ApiProperty()
  savingsPercentage: number;

  @ApiProperty()
  confidence: number;

  @ApiProperty({ type: [String] })
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

export class PriceOptimizationRecommendationDto {
  @ApiProperty()
  itemId: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  currentPrice: number;

  @ApiProperty()
  optimizedPrice: number;

  @ApiProperty()
  rationale: string;

  @ApiProperty()
  confidence: number;
}

export class PriceOptimizationResultDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  originalTotal: number;

  @ApiProperty()
  optimizedTotal: number;

  @ApiProperty()
  potentialSavings: number;

  @ApiProperty({ type: () => [PriceOptimizationRecommendationDto] })
  recommendations: PriceOptimizationRecommendationDto[];

  @ApiProperty()
  estimatedAcceptanceImprovement: number;
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
