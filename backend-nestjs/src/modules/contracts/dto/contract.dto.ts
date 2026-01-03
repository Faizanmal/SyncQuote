import { IsString, IsUUID, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ContractStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  PENDING_SIGNATURE = 'pending_signature',
  SIGNED = 'signed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export class CreateContractDto {
  @ApiProperty({ description: 'Contract title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Contract description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Proposal ID this contract is for' })
  @IsUUID()
  proposalId: string;

  @ApiPropertyOptional({ description: 'Contract template ID' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Contract content (HTML or Markdown)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Custom terms and conditions' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional({ description: 'Contract effective date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Contract expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Custom variables for template' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class UpdateContractDto {
  @ApiPropertyOptional({ description: 'Contract title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Contract description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Contract content (HTML or Markdown)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Custom terms and conditions' })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional({ description: 'Contract effective date' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Contract expiration date' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ description: 'Contract status', enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}

export class CreateContractTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Template content with variable placeholders' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Template category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Available variable definitions' })
  @IsOptional()
  @IsArray()
  variables?: ContractVariableDto[];

  @ApiPropertyOptional({ description: 'Make template available to team' })
  @IsOptional()
  @IsBoolean()
  isTeamTemplate?: boolean;
}

export class ContractVariableDto {
  @ApiProperty({ description: 'Variable name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Variable type', enum: ['text', 'number', 'date', 'boolean', 'select'] })
  @IsEnum(['text', 'number', 'date', 'boolean', 'select'])
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';

  @ApiPropertyOptional({ description: 'Variable label for display' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Default value' })
  @IsOptional()
  defaultValue?: any;

  @ApiPropertyOptional({ description: 'Is required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Options for select type' })
  @IsOptional()
  @IsArray()
  options?: string[];
}

export class RequestSignatureDto {
  @ApiProperty({ description: 'Contract ID' })
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'Signer email' })
  @IsString()
  signerEmail: string;

  @ApiProperty({ description: 'Signer name' })
  @IsString()
  signerName: string;

  @ApiPropertyOptional({ description: 'Custom email message' })
  @IsOptional()
  @IsString()
  emailMessage?: string;

  @ApiPropertyOptional({ description: 'Signature due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Send reminder emails' })
  @IsOptional()
  @IsBoolean()
  sendReminders?: boolean;
}

export class SignContractDto {
  @ApiProperty({ description: 'Signature data (base64 image or typed name)' })
  @IsString()
  signatureData: string;

  @ApiProperty({ description: 'Signature type', enum: ['drawn', 'typed', 'uploaded'] })
  @IsEnum(['drawn', 'typed', 'uploaded'])
  signatureType: 'drawn' | 'typed' | 'uploaded';

  @ApiProperty({ description: 'Signer IP address' })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ description: 'Agreed to terms' })
  @IsOptional()
  @IsBoolean()
  agreedToTerms?: boolean;
}

export class ContractResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  proposalId: string;

  @ApiProperty({ enum: ContractStatus })
  status: ContractStatus;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional()
  effectiveDate?: string;

  @ApiPropertyOptional()
  expirationDate?: string;

  @ApiPropertyOptional()
  signedAt?: string;

  @ApiPropertyOptional()
  signedBy?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class ContractTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  variables: ContractVariableDto[];

  @ApiProperty()
  isTeamTemplate: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
