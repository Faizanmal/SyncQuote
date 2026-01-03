import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsUrl,
} from 'class-validator';

export enum ApiKeyPermission {
  PROPOSALS_READ = 'proposals:read',
  PROPOSALS_WRITE = 'proposals:write',
  PROPOSALS_DELETE = 'proposals:delete',
  TEMPLATES_READ = 'templates:read',
  TEMPLATES_WRITE = 'templates:write',
  CLIENTS_READ = 'clients:read',
  CLIENTS_WRITE = 'clients:write',
  ANALYTICS_READ = 'analytics:read',
  WEBHOOKS_MANAGE = 'webhooks:manage',
}

export enum WebhookEvent {
  PROPOSAL_CREATED = 'proposal.created',
  PROPOSAL_UPDATED = 'proposal.updated',
  PROPOSAL_SENT = 'proposal.sent',
  PROPOSAL_VIEWED = 'proposal.viewed',
  PROPOSAL_APPROVED = 'proposal.approved',
  PROPOSAL_DECLINED = 'proposal.declined',
  PROPOSAL_SIGNED = 'proposal.signed',
  PROPOSAL_EXPIRED = 'proposal.expired',
  COMMENT_ADDED = 'comment.added',
  PAYMENT_RECEIVED = 'payment.received',
}

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsEnum(ApiKeyPermission, { each: true })
  permissions: ApiKeyPermission[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ApiKeyPermission, { each: true })
  permissions?: ApiKeyPermission[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];
}

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events?: WebhookEvent[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateOAuthAppDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  redirectUri: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalRedirectUris?: string[];

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsArray()
  @IsEnum(ApiKeyPermission, { each: true })
  scopes: ApiKeyPermission[];
}

export class OAuthAuthorizeDto {
  @IsString()
  clientId: string;

  @IsString()
  redirectUri: string;

  @IsString()
  responseType: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  codeChallenge?: string;

  @IsOptional()
  @IsString()
  codeChallengeMethod?: string;
}

export class OAuthTokenDto {
  @IsString()
  grantType: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsString()
  clientId: string;

  @IsString()
  clientSecret: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  codeVerifier?: string;
}

// Public API DTOs
export class CreateProposalApiDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateProposalApiDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ListProposalsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  search?: string;
}
