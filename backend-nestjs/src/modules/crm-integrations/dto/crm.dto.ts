import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CrmProvider {
  HUBSPOT = 'hubspot',
  SALESFORCE = 'salesforce',
  PIPEDRIVE = 'pipedrive',
  ZOHO = 'zoho',
}

export enum SyncDirection {
  CRM_TO_SYNCQUOTE = 'crm_to_syncquote',
  SYNCQUOTE_TO_CRM = 'syncquote_to_crm',
  BIDIRECTIONAL = 'bidirectional',
}

export class ConnectCrmDto {
  @ApiProperty({ enum: CrmProvider })
  @IsEnum(CrmProvider)
  provider: CrmProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instanceUrl?: string; // For Salesforce
}

export class FieldMappingDto {
  @ApiProperty()
  @IsString()
  syncQuoteField: string;

  @ApiProperty()
  @IsString()
  crmField: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transformFunction?: string; // 'uppercase', 'lowercase', 'currency', etc.
}

export class ConfigureSyncDto {
  @ApiProperty({ enum: SyncDirection })
  @IsEnum(SyncDirection)
  direction: SyncDirection;

  @ApiProperty({ type: [FieldMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  fieldMappings: FieldMappingDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSyncContacts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncProposalStatus?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  syncTriggers?: string[]; // ['proposal_sent', 'proposal_approved', 'proposal_signed']
}

export class CrmContactDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class CrmDealDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

export class SyncResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  syncedRecords: number;

  @ApiPropertyOptional()
  @IsOptional()
  errors?: Array<{ record: string; error: string }>;

  @ApiProperty()
  timestamp: Date;
}

export class WebhookPayloadDto {
  @ApiProperty({ enum: CrmProvider })
  @IsEnum(CrmProvider)
  provider: CrmProvider;

  @ApiProperty()
  @IsString()
  eventType: string;

  @ApiProperty()
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signature?: string;
}

// Stage mapping between CRM and SyncQuote
export class StageMappingDto {
  @ApiProperty()
  @IsString()
  syncQuoteStatus: string; // draft, sent, viewed, approved, declined, signed

  @ApiProperty()
  @IsString()
  crmStageId: string;

  @ApiProperty()
  @IsString()
  crmStageName: string;
}

export class ConfigureStageMappingDto {
  @ApiProperty({ type: [StageMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageMappingDto)
  mappings: StageMappingDto[];
}
