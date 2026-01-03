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
  x: number;
  y: number;
  value: number; // Intensity/weight
  count?: number; // Number of interactions
}

export class HeatmapResponseDto {
  proposalId: string;
  type: HeatmapType;
  dataPoints: HeatmapDataPoint[];
  totalInteractions: number;
  uniqueSessions: number;
  width: number;
  height: number;
  generatedAt: Date;
}

export class ScrollDepthAnalyticsDto {
  proposalId: string;
  totalViews: number;
  depthBuckets: Array<{
    depth: number; // 0-10%, 10-20%, etc.
    count: number;
    percentage: number;
  }>;
  avgScrollDepth: number;
  medianScrollDepth: number;
  dropOffPoints: Array<{
    depth: number;
    dropOffRate: number;
  }>;
}

export class ClickAnalyticsDto {
  proposalId: string;
  totalClicks: number;
  uniqueElements: number;
  topElements: Array<{
    elementId?: string;
    elementType: string;
    elementText?: string;
    clicks: number;
    uniqueUsers: number;
    avgTimeBeforeClick: number; // Milliseconds
  }>;
  clicksBySection: Record<string, number>;
}

export class EngagementMetricsDto {
  proposalId: string;
  totalViews: number;
  uniqueVisitors: number;
  avgTimeSpent: number; // Seconds
  medianTimeSpent: number;
  avgScrollDepth: number;
  bounceRate: number; // Percentage who left within 10 seconds
  engagementRate: number; // Percentage with meaningful engagement
  conversionRate: number;
  topPerformingSections: Array<{
    section: string;
    viewRate: number;
    avgTimeSpent: number;
  }>;
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

export class PredictiveScoreResponseDto {
  proposalId: string;
  sessionId?: string;
  conversionProbability: number; // 0-1
  engagementScore: number; // 0-100
  qualityScore: number; // 0-100
  factors: {
    timeSpent: { value: number; weight: number; score: number };
    scrollDepth: { value: number; weight: number; score: number };
    interactions: { value: number; weight: number; score: number };
    returningVisitor: { value: boolean; weight: number; score: number };
    deviceType: { value: string; weight: number; score: number };
    timeOfDay: { value: string; weight: number; score: number };
    pricingViewed: { value: boolean; weight: number; score: number };
  };
  recommendation: string;
  nextBestAction: string;
}

export class AttentionHeatmapDto {
  proposalId: string;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    attentionScore: number; // 0-100
    avgDwellTime: number; // Milliseconds
    viewRate: number; // Percentage of visitors who saw it
    interactionRate: number; // Percentage who interacted
  }>;
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

export class RealTimeStatsDto {
  proposalId: string;
  currentViewers: number;
  recentViews: number;
  recentConversions: number;
  avgEngagementScore: number;
  activeRegions: Array<{
    country: string;
    viewers: number;
  }>;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}
