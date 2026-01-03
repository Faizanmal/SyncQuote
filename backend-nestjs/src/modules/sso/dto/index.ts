import { IsString, IsUrl, IsOptional, IsBoolean, IsEnum, IsArray, IsNumber } from 'class-validator';

export enum SsoProvider {
  SAML = 'saml',
  OKTA = 'okta',
  AZURE_AD = 'azure_ad',
  GOOGLE_WORKSPACE = 'google_workspace',
  ONELOGIN = 'onelogin',
}

export enum DirectorySyncProvider {
  SCIM = 'scim',
  AZURE_AD = 'azure_ad',
  OKTA = 'okta',
  GOOGLE_WORKSPACE = 'google_workspace',
}

export enum SessionSecurityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  STRICT = 'strict',
}

// SSO Configuration DTOs
export class CreateSsoConfigDto {
  @IsEnum(SsoProvider)
  provider: SsoProvider;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  enforceForDomain?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  // SAML specific
  @IsOptional()
  @IsUrl()
  entryPoint?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  certificate?: string;

  @IsOptional()
  @IsString()
  privateKey?: string;

  // OAuth/OIDC specific
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsUrl()
  authorizationUrl?: string;

  @IsOptional()
  @IsUrl()
  tokenUrl?: string;

  @IsOptional()
  @IsUrl()
  userInfoUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSsoConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  enforceForDomain?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}

// Directory Sync DTOs
export class CreateDirectorySyncDto {
  @IsEnum(DirectorySyncProvider)
  provider: DirectorySyncProvider;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoProvisionUsers?: boolean;

  @IsBoolean()
  @IsOptional()
  autoDeprovisionUsers?: boolean;

  @IsBoolean()
  @IsOptional()
  syncGroups?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  // SCIM specific
  @IsOptional()
  @IsString()
  scimEndpoint?: string;

  @IsOptional()
  @IsString()
  bearerToken?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateDirectorySyncDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoProvisionUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDeprovisionUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  syncGroups?: boolean;
}

// Security Policy DTOs
export class UpdateSecurityPolicyDto {
  @IsOptional()
  @IsEnum(SessionSecurityLevel)
  sessionSecurityLevel?: SessionSecurityLevel;

  @IsOptional()
  @IsBoolean()
  requireMfa?: boolean;

  @IsOptional()
  @IsNumber()
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsNumber()
  maxConcurrentSessions?: number;

  @IsOptional()
  @IsBoolean()
  enforceIpWhitelist?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIpRanges?: string[];

  @IsOptional()
  @IsBoolean()
  logAllAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  preventAccountSharing?: boolean;

  @IsOptional()
  @IsNumber()
  passwordMinLength?: number;

  @IsOptional()
  @IsBoolean()
  passwordRequireUppercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireLowercase?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireNumbers?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordRequireSpecialChars?: boolean;

  @IsOptional()
  @IsNumber()
  passwordExpiryDays?: number;
}

// SAML Request DTOs
export class SamlLoginDto {
  @IsString()
  configId: string;

  @IsOptional()
  @IsString()
  relayState?: string;
}

export class SamlCallbackDto {
  @IsString()
  SAMLResponse: string;

  @IsOptional()
  @IsString()
  RelayState?: string;
}

// Session Management DTOs
export class TerminateSessionDto {
  @IsString()
  sessionId: string;
}

export class UpdateSessionSettingsDto {
  @IsOptional()
  @IsNumber()
  timeoutMinutes?: number;

  @IsOptional()
  @IsNumber()
  maxConcurrentSessions?: number;
}
