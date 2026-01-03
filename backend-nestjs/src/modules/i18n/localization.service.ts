import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CurrencyConversionDto,
  CurrencyConversionResponseDto,
  CurrencyCode,
  CURRENCY_SYMBOLS,
  Language,
  RTL_LANGUAGES,
} from './dto/i18n.dto';

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);
  private exchangeRatesCache: Map<string, { rate: number; timestamp: Date }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {}

  // Convert currency
  async convertCurrency(dto: CurrencyConversionDto): Promise<CurrencyConversionResponseDto> {
    const rate = await this.getExchangeRate(dto.from, dto.to);
    const numAmount = parseFloat(dto.amount);

    if (isNaN(numAmount)) {
      throw new BadRequestException('Invalid amount');
    }

    const convertedAmount = numAmount * rate;
    const formattedAmount = this.formatCurrency(convertedAmount, dto.to);

    return {
      amount: dto.amount,
      from: dto.from,
      to: dto.to,
      rate,
      convertedAmount: convertedAmount.toFixed(2),
      formattedAmount,
      timestamp: new Date(),
    };
  }

  // Get exchange rate
  async getExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    if (from === to) return 1;

    const cacheKey = `${from}-${to}`;
    const cached = this.exchangeRatesCache.get(cacheKey);

    // Check cache
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      return cached.rate;
    }

    // Fetch from API
    const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY');

    try {
      const response = await firstValueFrom(
        this.http.get(
          `https://api.exchangerate-api.com/v4/latest/${from}`,
          apiKey ? { params: { apikey: apiKey } } : {},
        ),
      );

      const rate = response.data.rates[to];

      if (!rate) {
        throw new BadRequestException(`Exchange rate not found for ${from} to ${to}`);
      }

      // Cache the rate
      this.exchangeRatesCache.set(cacheKey, { rate, timestamp: new Date() });

      return rate;
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${(error as Error).message}`);
      throw new BadRequestException('Failed to fetch exchange rate');
    }
  }

  // Format currency with locale
  formatCurrency(amount: number, currency: CurrencyCode, locale?: string): string {
    const symbol = CURRENCY_SYMBOLS[currency];

    try {
      const formatter = new Intl.NumberFormat(locale || 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return formatter.format(amount);
    } catch (error) {
      // Fallback formatting
      return `${symbol}${amount.toFixed(2)}`;
    }
  }

  // Format date with locale
  formatDate(date: Date, locale: string, format?: string): string {
    try {
      const options: Intl.DateTimeFormatOptions =
        format === 'long'
          ? { year: 'numeric', month: 'long', day: 'numeric' }
          : { year: 'numeric', month: '2-digit', day: '2-digit' };

      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      return date.toLocaleDateString();
    }
  }

  // Format time with locale
  formatTime(date: Date, locale: string, format24h?: boolean): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !format24h,
      };

      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      return date.toLocaleTimeString();
    }
  }

  // Format number with locale
  formatNumber(value: number, locale: string, decimals?: number): string {
    try {
      const options: Intl.NumberFormatOptions = {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      };

      return new Intl.NumberFormat(locale, options).format(value);
    } catch (error) {
      return value.toString();
    }
  }

  // Check if language is RTL
  isRTL(language: Language): boolean {
    return RTL_LANGUAGES.includes(language);
  }

  // Get locale string from language
  getLocaleFromLanguage(language: Language): string {
    const localeMap: Record<Language, string> = {
      [Language.EN]: 'en-US',
      [Language.ES]: 'es-ES',
      [Language.FR]: 'fr-FR',
      [Language.DE]: 'de-DE',
      [Language.IT]: 'it-IT',
      [Language.PT]: 'pt-PT',
      [Language.ZH]: 'zh-CN',
      [Language.JA]: 'ja-JP',
      [Language.KO]: 'ko-KR',
      [Language.AR]: 'ar-SA',
      [Language.RU]: 'ru-RU',
      [Language.HI]: 'hi-IN',
      [Language.HE]: 'he-IL',
      [Language.FA]: 'fa-IR',
      [Language.UR]: 'ur-PK',
    };

    return localeMap[language] || 'en-US';
  }

  // Get currency for country/language
  getDefaultCurrency(language: Language): CurrencyCode {
    const currencyMap: Record<Language, CurrencyCode> = {
      [Language.EN]: CurrencyCode.USD,
      [Language.ES]: CurrencyCode.EUR,
      [Language.FR]: CurrencyCode.EUR,
      [Language.DE]: CurrencyCode.EUR,
      [Language.IT]: CurrencyCode.EUR,
      [Language.PT]: CurrencyCode.EUR,
      [Language.ZH]: CurrencyCode.CNY,
      [Language.JA]: CurrencyCode.JPY,
      [Language.KO]: CurrencyCode.USD,
      [Language.AR]: CurrencyCode.AED,
      [Language.RU]: CurrencyCode.USD,
      [Language.HI]: CurrencyCode.INR,
      [Language.HE]: CurrencyCode.USD,
      [Language.FA]: CurrencyCode.USD,
      [Language.UR]: CurrencyCode.USD,
    };

    return currencyMap[language] || CurrencyCode.USD;
  }

  // Format relative time (e.g., "2 hours ago")
  formatRelativeTime(date: Date, locale: string): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (diffDay > 0) return rtf.format(-diffDay, 'day');
      if (diffHour > 0) return rtf.format(-diffHour, 'hour');
      if (diffMin > 0) return rtf.format(-diffMin, 'minute');
      return rtf.format(-diffSec, 'second');
    } catch (error) {
      // Fallback
      if (diffDay > 0) return `${diffDay} days ago`;
      if (diffHour > 0) return `${diffHour} hours ago`;
      if (diffMin > 0) return `${diffMin} minutes ago`;
      return 'just now';
    }
  }

  // Pluralize text based on count and locale
  pluralize(count: number, singular: string, plural: string, locale?: string): string {
    try {
      const rules = new Intl.PluralRules(locale || 'en-US');
      const rule = rules.select(count);

      return rule === 'one' ? singular : plural;
    } catch (error) {
      return count === 1 ? singular : plural;
    }
  }
}
