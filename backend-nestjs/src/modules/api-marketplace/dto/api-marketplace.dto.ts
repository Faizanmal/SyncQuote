import { IsString, IsUUID, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean, IsObject, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AppCategory {
  CRM = 'crm',
  COMMUNICATION = 'communication',
  PRODUCTIVITY = 'productivity',
  ANALYTICS = 'analytics',
  PAYMENTS = 'payments',
  STORAGE = 'storage',
  CALENDAR = 'calendar',
  AI = 'ai',
  AUTOMATION = 'automation',
  OTHER = 'other',
}

export enum AppStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum InstallationStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  EXPIRED = 'expired',
}

export class AppPermissionDto {
  @ApiProperty({ description: 'Permission scope name' })
  @IsString()
  scope: string;

  @ApiProperty({ description: 'Permission description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Is this permission required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class AppWebhookDto {
  @ApiProperty({ description: 'Event type to subscribe to' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Webhook URL' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Webhook secret for verification' })
  @IsOptional()
  @IsString()
  secret?: string;
}

export class RegisterAppDto {
  @ApiProperty({ description: 'App name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'App description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Detailed app description (supports markdown)' })
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiProperty({ description: 'App category', enum: AppCategory })
  @IsEnum(AppCategory)
  category: AppCategory;

  @ApiPropertyOptional({ description: 'App icon URL' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'App screenshots URLs' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  screenshots?: string[];

  @ApiPropertyOptional({ description: 'App website URL' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Support email' })
  @IsOptional()
  @IsString()
  supportEmail?: string;

  @ApiPropertyOptional({ description: 'Privacy policy URL' })
  @IsOptional()
  @IsUrl()
  privacyPolicyUrl?: string;

  @ApiPropertyOptional({ description: 'Terms of service URL' })
  @IsOptional()
  @IsUrl()
  termsOfServiceUrl?: string;

  @ApiProperty({ description: 'OAuth redirect URIs' })
  @IsArray()
  @IsUrl({}, { each: true })
  redirectUris: string[];

  @ApiProperty({ description: 'Required permissions', type: [AppPermissionDto] })
  @IsArray()
  @Type(() => AppPermissionDto)
  permissions: AppPermissionDto[];

  @ApiPropertyOptional({ description: 'Webhook subscriptions', type: [AppWebhookDto] })
  @IsOptional()
  @IsArray()
  @Type(() => AppWebhookDto)
  webhooks?: AppWebhookDto[];

  @ApiPropertyOptional({ description: 'App configuration schema (JSON Schema)' })
  @IsOptional()
  @IsObject()
  configSchema?: Record<string, any>;
}

export class UpdateAppDto {
  @ApiPropertyOptional({ description: 'App name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'App description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Detailed app description' })
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiPropertyOptional({ description: 'App category', enum: AppCategory })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;

  @ApiPropertyOptional({ description: 'App icon URL' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'App screenshots URLs' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  screenshots?: string[];

  @ApiPropertyOptional({ description: 'OAuth redirect URIs' })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({ description: 'Required permissions' })
  @IsOptional()
  @IsArray()
  @Type(() => AppPermissionDto)
  permissions?: AppPermissionDto[];

  @ApiPropertyOptional({ description: 'Webhook subscriptions' })
  @IsOptional()
  @IsArray()
  @Type(() => AppWebhookDto)
  webhooks?: AppWebhookDto[];
}

export class InstallAppDto {
  @ApiProperty({ description: 'App ID to install' })
  @IsUUID()
  appId: string;

  @ApiPropertyOptional({ description: 'App configuration values' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Install for entire team' })
  @IsOptional()
  @IsBoolean()
  teamWide?: boolean;
}

export class UpdateAppInstallationDto {
  @ApiPropertyOptional({ description: 'Updated configuration' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Installation status', enum: InstallationStatus })
  @IsOptional()
  @IsEnum(InstallationStatus)
  status?: InstallationStatus;
}

export class SearchAppsDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by category', enum: AppCategory })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;

  @ApiPropertyOptional({ description: 'Filter by featured apps' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Sort by: popular, recent, rating' })
  @IsOptional()
  @IsString()
  sortBy?: 'popular' | 'recent' | 'rating';

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page' })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class RateAppDto {
  @ApiProperty({ description: 'App ID' })
  @IsUUID()
  appId: string;

  @ApiProperty({ description: 'Rating (1-5)' })
  @IsNumber()
  rating: number;

  @ApiPropertyOptional({ description: 'Review text' })
  @IsOptional()
  @IsString()
  review?: string;
}

export class AppResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional()
  longDescription?: string;

  @ApiProperty({ enum: AppCategory })
  category: AppCategory;

  @ApiProperty({ enum: AppStatus })
  status: AppStatus;

  @ApiPropertyOptional()
  iconUrl?: string;

  @ApiPropertyOptional()
  screenshots?: string[];

  @ApiPropertyOptional()
  websiteUrl?: string;

  @ApiProperty()
  developerId: string;

  @ApiProperty()
  developerName: string;

  @ApiProperty({ type: [AppPermissionDto] })
  permissions: AppPermissionDto[];

  @ApiProperty()
  installCount: number;

  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  reviewCount: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class AppInstallationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  appId: string;

  @ApiProperty()
  appName: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  teamId?: string;

  @ApiProperty({ enum: InstallationStatus })
  status: InstallationStatus;

  @ApiPropertyOptional()
  configuration?: Record<string, any>;

  @ApiProperty()
  installedAt: string;

  @ApiPropertyOptional()
  lastUsedAt?: string;
}

export class AppCredentialsResponseDto {
  @ApiProperty()
  clientId: string;

  @ApiProperty({ description: 'Client secret (only shown once)' })
  clientSecret: string;

  @ApiProperty()
  createdAt: string;
}

export class AppReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  appId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  review?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
