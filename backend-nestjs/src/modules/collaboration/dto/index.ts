import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export enum ReviewCycleStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  COMPLETED = 'completed',
}

export enum CollaboratorRole {
  VIEWER = 'viewer',
  COMMENTER = 'commenter',
  EDITOR = 'editor',
  ADMIN = 'admin',
}

export enum ChangeTrackingMode {
  OFF = 'off',
  TRACK_CHANGES = 'track_changes',
  SUGGEST_MODE = 'suggest_mode',
}

export enum SuggestionStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

// Collaborator DTOs
export class AddCollaboratorDto {
  @IsString()
  proposalId: string;

  @IsString()
  email: string;

  @IsEnum(CollaboratorRole)
  role: CollaboratorRole;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionPermissions?: string[];
}

export class UpdateCollaboratorDto {
  @IsOptional()
  @IsEnum(CollaboratorRole)
  role?: CollaboratorRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionPermissions?: string[];
}

// Review Cycle DTOs
export class CreateReviewCycleDto {
  @IsString()
  proposalId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  reviewers: ReviewerDto[];

  @IsOptional()
  @IsNumber()
  dueInDays?: number;

  @IsOptional()
  @IsBoolean()
  requireAllApprovals?: boolean;
}

export class ReviewerDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class SubmitReviewDto {
  @IsString()
  reviewCycleId: string;

  @IsEnum(ReviewCycleStatus)
  decision: ReviewCycleStatus.APPROVED | ReviewCycleStatus.CHANGES_REQUESTED;

  @IsOptional()
  @IsString()
  feedback?: string;
}

// Comment DTOs
export class CreateCommentDto {
  @IsString()
  proposalId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsObject()
  position?: {
    startOffset: number;
    endOffset: number;
    selectedText?: string;
  };
}

export class UpdateCommentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}

export class ResolveCommentDto {
  @IsBoolean()
  resolved: boolean;

  @IsOptional()
  @IsString()
  resolution?: string;
}

// Change Suggestion DTOs
export class CreateSuggestionDto {
  @IsString()
  proposalId: string;

  @IsString()
  sectionId: string;

  @IsString()
  originalContent: string;

  @IsString()
  suggestedContent: string;

  @IsOptional()
  @IsString()
  explanation?: string;
}

export class RespondToSuggestionDto {
  @IsEnum(SuggestionStatus)
  status: SuggestionStatus.ACCEPTED | SuggestionStatus.REJECTED;

  @IsOptional()
  @IsString()
  response?: string;
}

// Real-time Presence DTOs
export class UpdatePresenceDto {
  @IsString()
  proposalId: string;

  @IsOptional()
  @IsString()
  currentSection?: string;

  @IsOptional()
  @IsObject()
  cursor?: {
    position: number;
    selection?: { start: number; end: number };
  };
}

// Change Tracking DTOs
export class SetTrackingModeDto {
  @IsString()
  proposalId: string;

  @IsEnum(ChangeTrackingMode)
  mode: ChangeTrackingMode;
}

export class AcceptRejectChangesDto {
  @IsString()
  proposalId: string;

  @IsArray()
  @IsString({ each: true })
  changeIds: string[];

  @IsBoolean()
  accept: boolean;
}
