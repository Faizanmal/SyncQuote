import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum TemplateCategory {
  BUSINESS = 'BUSINESS',
  CONSULTING = 'CONSULTING',
  CREATIVE = 'CREATIVE',
  TECHNOLOGY = 'TECHNOLOGY',
  MARKETING = 'MARKETING',
  SALES = 'SALES',
  LEGAL = 'LEGAL',
  FINANCE = 'FINANCE',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  REAL_ESTATE = 'REAL_ESTATE',
  OTHER = 'OTHER',
}

export enum TemplatePriceType {
  FREE = 'free',
  PAID = 'paid',
  PREMIUM = 'premium',
}

export enum TemplateStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export class PublishTemplateDto {
  @IsString()
  templateId: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsEnum(TemplatePriceType)
  priceType: TemplatePriceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  previewImages?: string[];

  @IsOptional()
  @IsString()
  demoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateMarketplaceTemplateDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  previewImages?: string[];
}

export class CreateReviewDto {
  @IsString()
  marketplaceTemplateId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class SearchMarketplaceDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @IsOptional()
  @IsEnum(TemplatePriceType)
  priceType?: TemplatePriceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minRating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  sortBy?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class PurchaseTemplateDto {
  @IsString()
  marketplaceTemplateId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

export class ReportTemplateDto {
  @IsString()
  marketplaceTemplateId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}
