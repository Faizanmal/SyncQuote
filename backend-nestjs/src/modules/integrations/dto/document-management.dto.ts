import { IsString, IsUUID, IsOptional, IsArray, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocumentProvider {
  GOOGLE_DRIVE = 'google_drive',
  DROPBOX = 'dropbox',
  ONEDRIVE = 'onedrive',
}

export class ConnectStorageDto {
  @ApiProperty({ enum: DocumentProvider, description: 'Storage provider to connect' })
  @IsEnum(DocumentProvider)
  provider: DocumentProvider;

  @ApiProperty({ description: 'OAuth authorization code' })
  @IsString()
  authorizationCode: string;

  @ApiPropertyOptional({ description: 'OAuth redirect URI used' })
  @IsOptional()
  @IsString()
  redirectUri?: string;
}

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentProvider, description: 'Storage provider' })
  @IsEnum(DocumentProvider)
  provider: DocumentProvider;

  @ApiProperty({ description: 'File name' })
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ description: 'Folder ID to upload to' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'File content as base64' })
  @IsOptional()
  @IsString()
  content?: string;
}

export class SyncProposalDocumentsDto {
  @ApiProperty({ description: 'Proposal ID' })
  @IsUUID()
  proposalId: string;

  @ApiProperty({ enum: DocumentProvider, description: 'Storage provider' })
  @IsEnum(DocumentProvider)
  provider: DocumentProvider;

  @ApiPropertyOptional({ description: 'Folder ID to sync to' })
  @IsOptional()
  @IsString()
  targetFolderId?: string;

  @ApiPropertyOptional({ description: 'Include attachments' })
  @IsOptional()
  includeAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Include versions' })
  @IsOptional()
  includeVersions?: boolean;
}

export class ListDocumentsDto {
  @ApiProperty({ enum: DocumentProvider, description: 'Storage provider' })
  @IsEnum(DocumentProvider)
  provider: DocumentProvider;

  @ApiPropertyOptional({ description: 'Folder ID to list contents of' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ description: 'Maximum number of results' })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  mimeType: string;

  @ApiPropertyOptional()
  size?: number;

  @ApiProperty()
  webViewLink: string;

  @ApiPropertyOptional()
  downloadLink?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  modifiedAt: string;

  @ApiProperty()
  provider: DocumentProvider;
}

export class FolderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  webViewLink: string;

  @ApiProperty()
  provider: DocumentProvider;

  @ApiPropertyOptional()
  parentId?: string;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  files: DocumentResponseDto[];

  @ApiProperty({ type: [FolderResponseDto] })
  folders: FolderResponseDto[];

  @ApiPropertyOptional()
  nextCursor?: string;

  @ApiProperty()
  hasMore: boolean;
}
