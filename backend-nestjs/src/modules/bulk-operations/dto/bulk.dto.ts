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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BulkAction {
  SEND = 'send',
  ARCHIVE = 'archive',
  DELETE = 'delete',
  UPDATE_STATUS = 'update_status',
  ASSIGN_TAG = 'assign_tag',
  REMOVE_TAG = 'remove_tag',
  CLONE = 'clone',
  EXPORT_PDF = 'export_pdf',
  EXPORT_CSV = 'export_csv',
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
}

export class BulkRecipientDto {
  @ApiProperty()
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customVariables?: Record<string, string>;
}

export class BulkSendDto {
  @ApiProperty()
  @IsString()
  templateId: string;

  @ApiProperty({ type: [BulkRecipientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkRecipientDto)
  @ArrayMinSize(1)
  recipients: BulkRecipientDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  personalizeContent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  scheduleForLater?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  scheduledAt?: Date;
}

export class BulkStatusUpdateDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  proposalIds: string[];

  @ApiProperty()
  @IsString()
  status: string; // 'draft', 'sent', 'archived', etc.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkTagDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  proposalIds: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  tagIds: string[];
}

export class BulkDeleteDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  proposalIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  permanent?: boolean; // Soft delete by default
}

export class TemplateVariationDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  modifications?: Record<string, any>; // Field overrides

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  count?: number; // Number of copies to create
}

export class BulkCloneDto {
  @ApiProperty()
  @IsString()
  templateId: string;

  @ApiProperty({ type: [TemplateVariationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariationDto)
  @ArrayMinSize(1)
  variations: TemplateVariationDto[];
}

export class BulkExportDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  proposalIds: string[];

  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeAnalytics?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeComments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[]; // Specific fields to include
}

export class BulkAnalyticsReportDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proposalIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[]; // views, conversions, engagement, etc.
}

export class BulkOperationResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  processedItems: number;

  @ApiProperty()
  failedItems: number;

  @ApiPropertyOptional()
  @IsOptional()
  errors?: Array<{ itemId: string; error: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  results?: Array<{ itemId: string; result: any }>;

  @ApiProperty()
  timestamp: Date;

  @ApiPropertyOptional()
  @IsOptional()
  downloadUrl?: string; // For export operations
}

export class BatchJobDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  status: string; // 'pending', 'processing', 'completed', 'failed'

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  processedItems: number;

  @ApiProperty()
  progress: number; // 0-100

  @ApiPropertyOptional()
  @IsOptional()
  error?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  @IsOptional()
  completedAt?: Date;
}
