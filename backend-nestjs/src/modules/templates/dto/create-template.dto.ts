import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';

export enum TemplateCategory {
  CONSULTING = 'CONSULTING',
  WEB_DEVELOPMENT = 'WEB_DEVELOPMENT',
  MARKETING = 'MARKETING',
  CONSTRUCTION = 'CONSTRUCTION',
  DESIGN = 'DESIGN',
  LEGAL = 'LEGAL',
  OTHER = 'OTHER',
}

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsObject()
  content: any; // JSON structure of proposal blocks
}
