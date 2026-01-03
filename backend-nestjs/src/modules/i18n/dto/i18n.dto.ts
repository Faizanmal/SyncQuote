import { IsString, IsOptional, IsEnum, IsArray, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  IT = 'it',
  PT = 'pt',
  ZH = 'zh',
  JA = 'ja',
  KO = 'ko',
  AR = 'ar',
  RU = 'ru',
  HI = 'hi',
  HE = 'he',
  FA = 'fa',
  UR = 'ur',
}

export enum TranslationProvider {
  GOOGLE = 'google',
  DEEPL = 'deepl',
  AZURE = 'azure',
  OPENAI = 'openai',
}

export enum CurrencyCode {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY',
  CNY = 'CNY',
  INR = 'INR',
  AUD = 'AUD',
  CAD = 'CAD',
  CHF = 'CHF',
  MXN = 'MXN',
  BRL = 'BRL',
  AED = 'AED',
}

export class TranslateTextDto {
  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  targetLanguage: Language;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  sourceLanguage?: Language;

  @ApiPropertyOptional({ enum: TranslationProvider })
  @IsOptional()
  @IsEnum(TranslationProvider)
  provider?: TranslationProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  preserveFormatting?: boolean;
}

export class TranslateProposalDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  targetLanguage: Language;

  @ApiPropertyOptional({ enum: TranslationProvider })
  @IsOptional()
  @IsEnum(TranslationProvider)
  provider?: TranslationProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createCopy?: boolean; // Create translated copy or overwrite

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  translatePricing?: boolean;
}

export class CreateTranslationDto {
  @ApiProperty()
  @IsString()
  key: string; // Translation key

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language: Language;

  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  namespace?: string; // Group translations

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class BatchTranslateDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  texts: string[];

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  targetLanguage: Language;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  sourceLanguage?: Language;

  @ApiPropertyOptional({ enum: TranslationProvider })
  @IsOptional()
  @IsEnum(TranslationProvider)
  provider?: TranslationProvider;
}

export class UpdateLocalizationSettingsDto {
  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  defaultLanguage?: Language;

  @ApiPropertyOptional({ enum: Language, type: [String] })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  supportedLanguages?: Language[];

  @ApiPropertyOptional({ enum: CurrencyCode })
  @IsOptional()
  @IsEnum(CurrencyCode)
  defaultCurrency?: CurrencyCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoDetectLanguage?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rtlEnabled?: boolean;
}

export class LocalizeProposalDto {
  @ApiProperty()
  @IsString()
  proposalId: string;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFormat?: string;
}

export class TranslationResponseDto {
  originalText: string;
  translatedText: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  provider: TranslationProvider;
  confidence?: number;
  detectedLanguage?: Language;
}

export class ProposalTranslationDto {
  proposalId: string;
  originalProposalId: string;
  language: Language;
  translatedAt: Date;
  provider: TranslationProvider;
  sections: Array<{
    sectionId: string;
    originalText: string;
    translatedText: string;
  }>;
}

export class LanguageDetectionDto {
  @ApiProperty()
  @IsString()
  text: string;
}

export class LanguageDetectionResponseDto {
  detectedLanguage: Language;
  confidence: number;
  alternativeLanguages?: Array<{
    language: Language;
    confidence: number;
  }>;
}

export class CurrencyConversionDto {
  @ApiProperty()
  @IsString()
  amount: string;

  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  from: CurrencyCode;

  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  to: CurrencyCode;
}

export class CurrencyConversionResponseDto {
  amount: string;
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  convertedAmount: string;
  formattedAmount: string;
  timestamp: Date;
}

export class LocalizationPreferencesDto {
  userId: string;
  language: Language;
  currency: CurrencyCode;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  rtl: boolean;
}

export const RTL_LANGUAGES = [Language.AR, Language.HE, Language.FA, Language.UR];

export const LANGUAGE_NAMES: Record<Language, string> = {
  [Language.EN]: 'English',
  [Language.ES]: 'Español',
  [Language.FR]: 'Français',
  [Language.DE]: 'Deutsch',
  [Language.IT]: 'Italiano',
  [Language.PT]: 'Português',
  [Language.ZH]: '中文',
  [Language.JA]: '日本語',
  [Language.KO]: '한국어',
  [Language.AR]: 'العربية',
  [Language.RU]: 'Русский',
  [Language.HI]: 'हिन्दी',
  [Language.HE]: 'עברית',
  [Language.FA]: 'فارسی',
  [Language.UR]: 'اردو',
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  [CurrencyCode.USD]: '$',
  [CurrencyCode.EUR]: '€',
  [CurrencyCode.GBP]: '£',
  [CurrencyCode.JPY]: '¥',
  [CurrencyCode.CNY]: '¥',
  [CurrencyCode.INR]: '₹',
  [CurrencyCode.AUD]: 'A$',
  [CurrencyCode.CAD]: 'C$',
  [CurrencyCode.CHF]: 'CHF',
  [CurrencyCode.MXN]: 'MX$',
  [CurrencyCode.BRL]: 'R$',
  [CurrencyCode.AED]: 'د.إ',
};
