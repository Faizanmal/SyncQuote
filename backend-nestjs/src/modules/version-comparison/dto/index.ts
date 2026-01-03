import { IsString, IsOptional, IsBoolean, IsEnum, IsArray } from 'class-validator';

export enum DiffOutputFormat {
  UNIFIED = 'unified',
  SIDE_BY_SIDE = 'side_by_side',
  INLINE = 'inline',
}

export enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
  UNCHANGED = 'unchanged',
}

export class CompareVersionsDto {
  @IsString()
  proposalId: string;

  @IsString()
  sourceVersionId: string;

  @IsString()
  targetVersionId: string;

  @IsOptional()
  @IsEnum(DiffOutputFormat)
  format?: DiffOutputFormat;

  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];
}

export class GetVersionHistoryDto {
  @IsString()
  proposalId: string;

  @IsOptional()
  @IsBoolean()
  includeContent?: boolean;

  @IsOptional()
  @IsBoolean()
  includeDiffs?: boolean;
}

export class RestoreVersionDto {
  @IsString()
  proposalId: string;

  @IsString()
  versionId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateSnapshotDto {
  @IsString()
  proposalId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAutoSnapshot?: boolean;
}

// Change Tracking Types
export interface ContentChange {
  type: ChangeType;
  path: string;
  oldValue?: any;
  newValue?: any;
  lineNumber?: number;
}

export interface SectionDiff {
  sectionId: string;
  sectionName: string;
  changes: ContentChange[];
  addedLines: number;
  removedLines: number;
  modifiedLines: number;
}

export interface VersionDiff {
  sourceVersion: {
    id: string;
    number: number;
    createdAt: Date;
    createdBy?: string;
  };
  targetVersion: {
    id: string;
    number: number;
    createdAt: Date;
    createdBy?: string;
  };
  summary: {
    totalChanges: number;
    addedLines: number;
    removedLines: number;
    modifiedSections: number;
  };
  sections: SectionDiff[];
  metadata?: {
    titleChanged: boolean;
    statusChanged: boolean;
    pricingChanged: boolean;
  };
}
