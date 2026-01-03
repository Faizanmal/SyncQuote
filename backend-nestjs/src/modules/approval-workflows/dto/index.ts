import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ApprovalConditionType {
  PROPOSAL_VALUE_ABOVE = 'PROPOSAL_VALUE_ABOVE',
  PROPOSAL_VALUE_BELOW = 'PROPOSAL_VALUE_BELOW',
  PROPOSAL_VALUE_BETWEEN = 'PROPOSAL_VALUE_BETWEEN',
  CLIENT_TYPE = 'CLIENT_TYPE',
  PROPOSAL_CATEGORY = 'PROPOSAL_CATEGORY',
  DISCOUNT_ABOVE = 'DISCOUNT_ABOVE',
  CUSTOM_FIELD = 'CUSTOM_FIELD',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  DELEGATED = 'DELEGATED',
  EXPIRED = 'EXPIRED',
}

export enum EscalationAction {
  NOTIFY = 'NOTIFY',
  REASSIGN = 'REASSIGN',
  AUTO_APPROVE = 'AUTO_APPROVE',
  AUTO_REJECT = 'AUTO_REJECT',
}

export class ApprovalConditionDto {
  @IsEnum(ApprovalConditionType)
  type: ApprovalConditionType;

  @IsOptional()
  value?: any;

  @IsOptional()
  @IsNumber()
  minValue?: number;

  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @IsOptional()
  @IsString()
  field?: string;
}

export class ApprovalStepDto {
  @IsNumber()
  @Min(1)
  order: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  approverIds: string[];

  @IsOptional()
  @IsBoolean()
  requireAllApprovers?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  requiredApprovals?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeoutHours?: number;

  @IsOptional()
  @IsEnum(EscalationAction)
  escalationAction?: EscalationAction;

  @IsOptional()
  @IsString()
  escalationToUserId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalConditionDto)
  conditions?: ApprovalConditionDto[];
}

export class CreateApprovalWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps: ApprovalStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalConditionDto)
  triggerConditions?: ApprovalConditionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minProposalValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxProposalValue?: number;
}

export class UpdateApprovalWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps?: ApprovalStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalConditionDto)
  triggerConditions?: ApprovalConditionDto[];
}

export class SubmitApprovalDto {
  @IsString()
  proposalId: string;

  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovalActionDto {
  @IsEnum(ApprovalStatus)
  action: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];
}

export class DelegateApprovalDto {
  @IsString()
  delegateToUserId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  expiresInHours?: number;
}

export class EscalateApprovalDto {
  @IsString()
  escalateToUserId: string;

  @IsString()
  reason: string;
}
