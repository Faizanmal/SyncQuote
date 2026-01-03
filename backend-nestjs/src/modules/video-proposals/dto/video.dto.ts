import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  IsNumber,
  IsArray,
  ValidateNested,
  IsObject,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum VideoProvider {
  LOOM = 'loom',
  VIDYARD = 'vidyard',
  YOUTUBE = 'youtube',
  VIMEO = 'vimeo',
  WISTIA = 'wistia',
  UPLOADED = 'uploaded',
}

export enum VideoStatus {
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export class VideoAnnotationDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  timestamp!: number; // seconds

  @ApiProperty()
  @IsString()
  type!: string; // 'text', 'link', 'cta', 'highlight'

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  position?: { x: number; y: number }; // percentage position

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duration?: number; // how long to show (seconds)

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  style?: Record<string, any>;
}

export class CTAOverlayDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  timestamp!: number;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  buttonText!: string;

  @ApiProperty()
  @IsString()
  action!: string; // 'scroll_to_section', 'external_link', 'approve_proposal'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actionTarget?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pauseVideo?: boolean;
}

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: VideoProvider })
  @IsEnum(VideoProvider)
  provider!: VideoProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string; // Loom/Vidyard video ID

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  embedUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duration?: number; // seconds

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalId?: string;

  @ApiPropertyOptional({ type: [VideoAnnotationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoAnnotationDto)
  annotations?: VideoAnnotationDto[];

  @ApiPropertyOptional({ type: [CTAOverlayDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTAOverlayDto)
  ctaOverlays?: CTAOverlayDto[];
}

export class UpdateVideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [VideoAnnotationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoAnnotationDto)
  annotations?: VideoAnnotationDto[];

  @ApiPropertyOptional({ type: [CTAOverlayDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CTAOverlayDto)
  ctaOverlays?: CTAOverlayDto[];
}

export class VideoViewEventDto {
  @ApiProperty()
  @IsString()
  videoId!: string;

  @ApiProperty()
  @IsString()
  sessionId!: string;

  @ApiProperty()
  @IsString()
  event!: string; // 'play', 'pause', 'seek', 'complete', 'cta_click'

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  currentTime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentComplete?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ctaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class VideoAnalyticsDto {
  @ApiProperty()
  videoId!: string;

  @ApiProperty()
  totalViews!: number;

  @ApiProperty()
  uniqueViewers!: number;

  @ApiProperty()
  totalWatchTime!: number; // seconds

  @ApiProperty()
  averageWatchTime!: number; // seconds

  @ApiProperty()
  completionRate!: number; // percentage

  @ApiProperty()
  engagementScore!: number; // 0-100

  @ApiProperty()
  ctaClicks!: number;

  @ApiProperty()
  ctaClickRate!: number;

  @ApiProperty()
  dropOffPoints!: Array<{ timestamp: number; dropOffRate: number }>;

  @ApiProperty()
  viewsByDay!: Array<{ date: string; views: number }>;
}

export class PersonalizedVideoDto {
  @ApiProperty()
  @IsString()
  templateVideoId!: string;

  @ApiProperty()
  @IsString()
  recipientName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customVariables?: Record<string, string>;
}

export class UploadVideoDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalId?: string;
}

export class ConnectLoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizationCode?: string;
}

export class ConnectVidyardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;
}
