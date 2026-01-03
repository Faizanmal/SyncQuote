import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum, Min, Max } from 'class-validator';
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

export class PricingSuggestionResponseDto {
  @ApiProperty()
  suggestedPrice: number;

  @ApiProperty()
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  reasoning: string;

  @ApiProperty()
  marketComparison: {
    belowMarket: boolean;
    aboveMarket: boolean;
    marketAverage: number;
  };

  @ApiProperty()
  recommendations: string[];

  @ApiProperty()
  pricingTiers: {
    basic: { price: number; features: string[] };
    standard: { price: number; features: string[] };
    premium: { price: number; features: string[] };
  };
}

export class ProposalOptimizationResponseDto {
  @ApiProperty()
  overallScore: number;

  @ApiProperty()
  improvements: {
    category: string;
    currentScore: number;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    impact: string;
  }[];

  @ApiProperty()
  contentSuggestions: {
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }[];

  @ApiProperty()
  structuralRecommendations: string[];

  @ApiProperty()
  pricingOptimizations: string[];

  @ApiProperty()
  conversionTips: string[];

  @ApiProperty()
  competitiveAdvantages: string[];
}
