import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Industry {
  TECHNOLOGY = 'technology',
  CONSULTING = 'consulting',
  MARKETING = 'marketing',
  DESIGN = 'design',
  LEGAL = 'legal',
  FINANCE = 'finance',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  REAL_ESTATE = 'real_estate',
  MANUFACTURING = 'manufacturing',
  OTHER = 'other',
}

export enum ProjectComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ENTERPRISE = 'enterprise',
}

export class CompetitorDataDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tier?: string;
}

export class SmartPricingSuggestionDto {
  @ApiProperty({ description: 'Service or product name' })
  @IsString()
  serviceName: string;

  @ApiPropertyOptional({ description: 'Detailed service description' })
  @IsString()
  @IsOptional()
  serviceDescription?: string;

  @ApiProperty({ enum: Industry })
  @IsEnum(Industry)
  industry: Industry;

  @ApiProperty({ enum: ProjectComplexity })
  @IsEnum(ProjectComplexity)
  complexity: ProjectComplexity;

  @ApiPropertyOptional({ description: 'Estimated hours for the project' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  estimatedHours?: number;

  @ApiPropertyOptional({ description: 'Target client company size' })
  @IsString()
  @IsOptional()
  clientCompanySize?: string;

  @ApiPropertyOptional({ description: 'Client budget range' })
  @IsString()
  @IsOptional()
  clientBudgetRange?: string;

  @ApiPropertyOptional({ description: 'Geographic region' })
  @IsString()
  @IsOptional()
  region?: string;

  @ApiPropertyOptional({ description: 'Your historical average rate' })
  @IsNumber()
  @IsOptional()
  historicalRate?: number;

  @ApiPropertyOptional({ description: 'Competitor pricing data', type: [CompetitorDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitorDataDto)
  @IsOptional()
  competitorData?: CompetitorDataDto[];
}

export class ProposalOptimizationDto {
  @ApiProperty({ description: 'Proposal ID to optimize' })
  @IsString()
  proposalId: string;

  @ApiPropertyOptional({ description: 'Specific areas to focus on' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  focusAreas?: string[];

  @ApiPropertyOptional({ description: 'Target conversion rate improvement' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  targetConversionImprovement?: number;
}

export class PriceRangeDto {
  @ApiProperty()
  low: number;

  @ApiProperty()
  mid: number;

  @ApiProperty()
  high: number;
}

export class MarketComparisonDto {
  @ApiProperty()
  belowMarket: boolean;

  @ApiProperty()
  aboveMarket: boolean;

  @ApiProperty()
  marketAverage: number;
}

export class PricingTierDto {
  @ApiProperty()
  price: number;

  @ApiProperty({ type: [String] })
  features: string[];
}

export class PricingTiersDto {
  @ApiProperty({ type: () => PricingTierDto })
  basic: PricingTierDto;

  @ApiProperty({ type: () => PricingTierDto })
  standard: PricingTierDto;

  @ApiProperty({ type: () => PricingTierDto })
  premium: PricingTierDto;
}

export class PricingSuggestionResponseDto {
  @ApiProperty()
  suggestedPrice: number;

  @ApiProperty({ type: () => PriceRangeDto })
  priceRange: PriceRangeDto;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  reasoning: string;

  @ApiProperty({ type: () => MarketComparisonDto })
  marketComparison: MarketComparisonDto;

  @ApiProperty({ type: [String] })
  recommendations: string[];

  @ApiProperty({ type: () => PricingTiersDto })
  pricingTiers: PricingTiersDto;
}

export class ProposalImprovementDto {
  @ApiProperty()
  category: string;

  @ApiProperty()
  currentScore: number;

  @ApiProperty()
  suggestion: string;

  @ApiProperty()
  priority: 'high' | 'medium' | 'low';

  @ApiProperty()
  impact: string;
}

export class ContentSuggestionDto {
  @ApiProperty()
  section: string;

  @ApiProperty()
  original: string;

  @ApiProperty()
  suggested: string;

  @ApiProperty()
  reason: string;
}

export class ProposalOptimizationResponseDto {
  @ApiProperty()
  overallScore: number;

  @ApiProperty({ type: () => [ProposalImprovementDto] })
  improvements: ProposalImprovementDto[];

  @ApiProperty({ type: () => [ContentSuggestionDto] })
  contentSuggestions: ContentSuggestionDto[];

  @ApiProperty({ type: [String] })
  structuralRecommendations: string[];

  @ApiProperty({ type: [String] })
  pricingOptimizations: string[];

  @ApiProperty({ type: [String] })
  conversionTips: string[];

  @ApiProperty({ type: [String] })
  competitiveAdvantages: string[];
}
