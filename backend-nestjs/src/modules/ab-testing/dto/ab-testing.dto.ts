import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsBoolean,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TestType {
  PRICING_PRESENTATION = 'pricing_presentation',
  TEMPLATE = 'template',
  EMAIL_SUBJECT = 'email_subject',
  LANDING_PAGE = 'landing_page',
  CTA_BUTTON = 'cta_button',
  CUSTOM = 'custom',
}

export enum TestStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum WinnerMetric {
  CONVERSION_RATE = 'conversion_rate',
  VIEW_RATE = 'view_rate',
  ENGAGEMENT_TIME = 'engagement_time',
  CLICK_RATE = 'click_rate',
  APPROVAL_RATE = 'approval_rate',
  REVENUE = 'revenue',
}

export class TestVariantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  trafficAllocation: number; // Percentage of traffic

  @ApiProperty()
  @IsObject()
  content: Record<string, any>; // Variant-specific content/config

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isControl?: boolean;
}

export class CreateAbTestDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TestType })
  @IsEnum(TestType)
  type: TestType;

  @ApiProperty({ enum: WinnerMetric })
  @IsEnum(WinnerMetric)
  primaryMetric: WinnerMetric;

  @ApiPropertyOptional({ enum: WinnerMetric, type: [String] })
  @IsOptional()
  @IsArray()
  @IsEnum(WinnerMetric, { each: true })
  secondaryMetrics?: WinnerMetric[];

  @ApiProperty({ type: [TestVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestVariantDto)
  @ArrayMinSize(2)
  variants: TestVariantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(100)
  minSampleSize?: number; // Minimum conversions needed for statistical significance

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.8)
  @Max(0.99)
  confidenceLevel?: number; // Default 0.95 (95%)

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSelectWinner?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  targetTemplateId?: string; // For template tests

  @ApiPropertyOptional()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  endDate?: Date;
}

export class UpdateAbTestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TestStatus })
  @IsOptional()
  @IsEnum(TestStatus)
  status?: TestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(100)
  minSampleSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSelectWinner?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  endDate?: Date;
}

export class VariantTrafficAllocationDto {
  @ApiProperty()
  variantId: string;

  @ApiProperty()
  trafficAllocation: number;
}

export class UpdateVariantTrafficDto {
  @ApiProperty({ type: () => [VariantTrafficAllocationDto] })
  @IsArray()
  allocations: VariantTrafficAllocationDto[];
}

export class RecordConversionDto {
  @ApiProperty()
  @IsString()
  testId: string;

  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  event: string; // 'view', 'click', 'approval', 'sign', etc.

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  value?: number; // Revenue or other numeric value

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ConfidenceIntervalDto {
  @ApiProperty()
  lower: number;

  @ApiProperty()
  upper: number;
}

export class VariantResultDto {
  @ApiProperty()
  variantId: string;

  @ApiProperty()
  variantName: string;

  @ApiProperty()
  isControl: boolean;

  @ApiProperty()
  impressions: number;

  @ApiProperty()
  conversions: number;

  @ApiProperty()
  conversionRate: number;

  @ApiProperty()
  avgValue: number;

  @ApiProperty()
  totalValue: number;

  @ApiProperty()
  standardError: number;

  @ApiProperty({ type: () => ConfidenceIntervalDto })
  confidenceInterval: ConfidenceIntervalDto;

  @ApiPropertyOptional()
  relativeImprovement?: number;

  @ApiPropertyOptional()
  pValue?: number;

  @ApiPropertyOptional()
  isSignificant?: boolean;
}

export class AbTestResultsDto {
  testId: string;
  testName: string;
  status: TestStatus;
  primaryMetric: WinnerMetric;

  // Test parameters
  confidenceLevel: number;
  minSampleSize: number;

  // Overall stats
  totalImpressions: number;
  totalConversions: number;

  // Per-variant results
  variants: VariantResultDto[];

  // Winner determination
  hasWinner: boolean;
  winnerId?: string;
  winnerName?: string;

  // Statistical power
  statisticalPower: number;
  isStatisticallySignificant: boolean;

  // Recommendations
  recommendation: string;
  daysToSignificance?: number;
}

export class EmailSubjectTestDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  subjectLines: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(10)
  testSize?: number; // Number of recipients per variant
}

export class PricingTestVariantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  displayStyle: string; // 'table', 'cards', 'tiered', 'comparison', 'minimal'

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showOriginalPrice?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  styling?: Record<string, any>;
}

export class CreatePricingTestDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  templateId: string;

  @ApiProperty({ type: [PricingTestVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTestVariantDto)
  @ArrayMinSize(2)
  variants: PricingTestVariantDto[];
}
