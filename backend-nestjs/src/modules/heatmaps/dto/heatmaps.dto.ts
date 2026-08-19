import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InteractionType {
  CLICK = 'click',
  HOVER = 'hover',
  SCROLL = 'scroll',
  FOCUS = 'focus',
  INPUT = 'input',
  COPY = 'copy',
  VIDEO_PLAY = 'video_play',
  VIDEO_PAUSE = 'video_pause',
}

export enum HeatmapType {
  CLICK = 'click',
  SCROLL = 'scroll',
  ATTENTION = 'attention',
  MOVEMENT = 'movement',
}

export class RecordInteractionDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty({ enum: InteractionType })
  @IsEnum(InteractionType)
  type: InteractionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  elementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  elementType?: string; // 'button', 'link', 'pricing-table', etc.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  elementText?: string;

  @ApiProperty()
  @IsNumber()
  x: number; // X coordinate (viewport or absolute)

  @ApiProperty()
  @IsNumber()
  y: number; // Y coordinate

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  scrollDepth?: number; // Percentage (0-100)

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  viewportWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  viewportHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timestamp?: number; // Unix timestamp in ms

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RecordScrollDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  scrollDepth: number; // Percentage

  @ApiProperty()
  @IsNumber()
  scrollPosition: number; // Pixels from top

  @ApiProperty()
  @IsNumber()
  documentHeight: number;

  @ApiProperty()
  @IsNumber()
  viewportHeight: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeSpent?: number; // Milliseconds at this depth
}

export class RecordEngagementDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  timeSpent: number; // Total time in milliseconds

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxScrollDepth: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  clicks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hovers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  videoWatched?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pricingViewed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  sectionsViewed?: string[];
}

export class GetHeatmapDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty({ enum: HeatmapType })
  @IsEnum(HeatmapType)
  type: HeatmapType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  width?: number; // Target heatmap width

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number; // Target heatmap height

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  intensity?: number; // Intensity multiplier
}

export class HeatmapDataPoint {
  @ApiProperty()
  x: number;

  @ApiProperty()
  y: number;

  @ApiProperty()
  value: number;

  @ApiPropertyOptional()
  count?: number;
}

export class HeatmapResponseDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty({ enum: HeatmapType })
  type: HeatmapType;

  @ApiProperty({ type: () => [HeatmapDataPoint] })
  dataPoints: HeatmapDataPoint[];

  @ApiProperty()
  totalInteractions: number;

  @ApiProperty()
  uniqueSessions: number;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  generatedAt: Date;
}

export class DepthBucketDto {
  @ApiProperty()
  depth: number;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;
}

export class DropOffPointDto {
  @ApiProperty()
  depth: number;

  @ApiProperty()
  dropOffRate: number;
}

export class ScrollDepthAnalyticsDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  totalViews: number;

  @ApiProperty({ type: () => [DepthBucketDto] })
  depthBuckets: DepthBucketDto[];

  @ApiProperty()
  avgScrollDepth: number;

  @ApiProperty()
  medianScrollDepth: number;

  @ApiProperty({ type: () => [DropOffPointDto] })
  dropOffPoints: DropOffPointDto[];
}

export class TopClickedElementDto {
  @ApiPropertyOptional()
  elementId?: string;

  @ApiProperty()
  elementType: string;

  @ApiPropertyOptional()
  elementText?: string;

  @ApiProperty()
  clicks: number;

  @ApiProperty()
  uniqueUsers: number;

  @ApiProperty()
  avgTimeBeforeClick: number;
}

export class ClickAnalyticsDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  totalClicks: number;

  @ApiProperty()
  uniqueElements: number;

  @ApiProperty({ type: () => [TopClickedElementDto] })
  topElements: TopClickedElementDto[];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  clicksBySection: Record<string, number>;
}

export class TopPerformingSectionDto {
  @ApiProperty()
  section: string;

  @ApiProperty()
  viewRate: number;

  @ApiProperty()
  avgTimeSpent: number;
}

export class EngagementMetricsDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  totalViews: number;

  @ApiProperty()
  uniqueVisitors: number;

  @ApiProperty()
  avgTimeSpent: number;

  @ApiProperty()
  medianTimeSpent: number;

  @ApiProperty()
  avgScrollDepth: number;

  @ApiProperty()
  bounceRate: number;

  @ApiProperty()
  engagementRate: number;

  @ApiProperty()
  conversionRate: number;

  @ApiProperty({ type: () => [TopPerformingSectionDto] })
  topPerformingSections: TopPerformingSectionDto[];
}

export class PredictiveScoreDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class ScoreFactorDto {
  @ApiProperty()
  value: number | boolean | string;

  @ApiProperty()
  weight: number;

  @ApiProperty()
  score: number;
}

export class PredictiveFactorsDto {
  @ApiProperty({ type: () => ScoreFactorDto })
  timeSpent: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  scrollDepth: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  interactions: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  returningVisitor: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  deviceType: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  timeOfDay: ScoreFactorDto;

  @ApiProperty({ type: () => ScoreFactorDto })
  pricingViewed: ScoreFactorDto;
}

export class PredictiveScoreResponseDto {
  @ApiProperty()
  proposalId: string;

  @ApiPropertyOptional()
  sessionId?: string;

  @ApiProperty()
  conversionProbability: number;

  @ApiProperty()
  engagementScore: number;

  @ApiProperty()
  qualityScore: number;

  @ApiProperty({ type: () => PredictiveFactorsDto })
  factors: PredictiveFactorsDto;

  @ApiProperty()
  recommendation: string;

  @ApiProperty()
  nextBestAction: string;
}

export class AttentionSectionDto {
  @ApiProperty()
  sectionId: string;

  @ApiProperty()
  sectionName: string;

  @ApiProperty()
  attentionScore: number;

  @ApiProperty()
  avgDwellTime: number;

  @ApiProperty()
  viewRate: number;

  @ApiProperty()
  interactionRate: number;
}

export class AttentionHeatmapDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty({ type: () => [AttentionSectionDto] })
  sections: AttentionSectionDto[];
}

export class RealTimeAnalyticsDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  lastMinutes?: number; // Default 5
}

export class ActiveRegionDto {
  @ApiProperty()
  country: string;

  @ApiProperty()
  viewers: number;
}

export class DeviceBreakdownDto {
  @ApiProperty()
  desktop: number;

  @ApiProperty()
  mobile: number;

  @ApiProperty()
  tablet: number;
}

export class RealTimeStatsDto {
  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  currentViewers: number;

  @ApiProperty()
  recentViews: number;

  @ApiProperty()
  recentConversions: number;

  @ApiProperty()
  avgEngagementScore: number;

  @ApiProperty({ type: () => [ActiveRegionDto] })
  activeRegions: ActiveRegionDto[];

  @ApiProperty({ type: () => DeviceBreakdownDto })
  devices: DeviceBreakdownDto;
}
