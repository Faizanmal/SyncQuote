import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  TranslateTextDto,
  BatchTranslateDto,
  TranslationResponseDto,
  LanguageDetectionResponseDto,
  Language,
  TranslationProvider,
} from './dto/i18n.dto';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {}

  // Translate single text
  async translateText(dto: TranslateTextDto): Promise<TranslationResponseDto> {
    const provider = dto.provider || TranslationProvider.GOOGLE;

    try {
      switch (provider) {
        case TranslationProvider.GOOGLE:
          return await this.translateWithGoogle(dto);

        case TranslationProvider.DEEPL:
          return await this.translateWithDeepL(dto);

        case TranslationProvider.AZURE:
          return await this.translateWithAzure(dto);

        case TranslationProvider.OPENAI:
          return await this.translateWithOpenAI(dto);

        default:
          throw new BadRequestException(`Unsupported translation provider: ${provider}`);
      }
    } catch (error) {
      this.logger.error(`Translation failed: ${error.message}`);
      throw error;
    }
  }

  // Batch translate
  async batchTranslate(dto: BatchTranslateDto): Promise<TranslationResponseDto[]> {
    const provider = dto.provider || TranslationProvider.GOOGLE;

    // For large batches, process in chunks
    const chunkSize = 100;
    const results: TranslationResponseDto[] = [];

    for (let i = 0; i < dto.texts.length; i += chunkSize) {
      const chunk = dto.texts.slice(i, i + chunkSize);

      const chunkResults = await Promise.all(
        chunk.map((text) =>
          this.translateText({
            text,
            targetLanguage: dto.targetLanguage,
            sourceLanguage: dto.sourceLanguage,
            provider,
          }),
        ),
      );

      results.push(...chunkResults);
    }

    return results;
  }

  // Detect language
  async detectLanguage(text: string): Promise<LanguageDetectionResponseDto> {
    const apiKey = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Google Translate API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://translation.googleapis.com/language/translate/v2/detect',
          {
            q: text,
          },
          {
            params: { key: apiKey },
          },
        ),
      );

      const detection = response.data.data.detections[0][0];

      return {
        detectedLanguage: detection.language as Language,
        confidence: detection.confidence,
        alternativeLanguages: response.data.data.detections[0].slice(1, 3).map((d: any) => ({
          language: d.language as Language,
          confidence: d.confidence,
        })),
      };
    } catch (error) {
      this.logger.error(`Language detection failed: ${error.message}`);
      throw new BadRequestException('Failed to detect language');
    }
  }

  // Provider-specific implementations
  private async translateWithGoogle(dto: TranslateTextDto): Promise<TranslationResponseDto> {
    const apiKey = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('Google Translate API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://translation.googleapis.com/language/translate/v2',
          {
            q: dto.text,
            target: dto.targetLanguage,
            ...(dto.sourceLanguage && { source: dto.sourceLanguage }),
            format: dto.preserveFormatting ? 'html' : 'text',
          },
          {
            params: { key: apiKey },
          },
        ),
      );

      const translation = response.data.data.translations[0];

      return {
        originalText: dto.text,
        translatedText: translation.translatedText,
        sourceLanguage: dto.sourceLanguage || (translation.detectedSourceLanguage as Language),
        targetLanguage: dto.targetLanguage,
        provider: TranslationProvider.GOOGLE,
        detectedLanguage: translation.detectedSourceLanguage as Language,
      };
    } catch (error) {
      this.logger.error(`Google translation failed: ${error.message}`);
      throw new BadRequestException('Google translation failed');
    }
  }

  private async translateWithDeepL(dto: TranslateTextDto): Promise<TranslationResponseDto> {
    const apiKey = this.config.get<string>('DEEPL_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.http.post('https://api-free.deepl.com/v2/translate', null, {
          params: {
            auth_key: apiKey,
            text: dto.text,
            target_lang: dto.targetLanguage.toUpperCase(),
            ...(dto.sourceLanguage && { source_lang: dto.sourceLanguage.toUpperCase() }),
            preserve_formatting: dto.preserveFormatting ? '1' : '0',
          },
        }),
      );

      const translation = response.data.translations[0];

      return {
        originalText: dto.text,
        translatedText: translation.text,
        sourceLanguage:
          dto.sourceLanguage || (translation.detected_source_language.toLowerCase() as Language),
        targetLanguage: dto.targetLanguage,
        provider: TranslationProvider.DEEPL,
        detectedLanguage: translation.detected_source_language.toLowerCase() as Language,
      };
    } catch (error) {
      this.logger.error(`DeepL translation failed: ${error.message}`);
      throw new BadRequestException('DeepL translation failed');
    }
  }

  private async translateWithAzure(dto: TranslateTextDto): Promise<TranslationResponseDto> {
    const apiKey = this.config.get<string>('AZURE_TRANSLATOR_KEY');
    const region = this.config.get<string>('AZURE_TRANSLATOR_REGION');

    if (!apiKey || !region) {
      throw new BadRequestException('Azure Translator credentials not configured');
    }

    try {
      const response = await firstValueFrom(
        this.http.post(
          `https://api.cognitive.microsofttranslator.com/translate`,
          [{ text: dto.text }],
          {
            params: {
              'api-version': '3.0',
              to: dto.targetLanguage,
              ...(dto.sourceLanguage && { from: dto.sourceLanguage }),
            },
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'Ocp-Apim-Subscription-Region': region,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const translation = response.data[0].translations[0];
      const detectedLang = response.data[0].detectedLanguage?.language;

      return {
        originalText: dto.text,
        translatedText: translation.text,
        sourceLanguage: dto.sourceLanguage || (detectedLang as Language),
        targetLanguage: dto.targetLanguage,
        provider: TranslationProvider.AZURE,
        confidence: response.data[0].detectedLanguage?.score,
        detectedLanguage: detectedLang as Language,
      };
    } catch (error) {
      this.logger.error(`Azure translation failed: ${error.message}`);
      throw new BadRequestException('Azure translation failed');
    }
  }

  private async translateWithOpenAI(dto: TranslateTextDto): Promise<TranslationResponseDto> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new BadRequestException('OpenAI API key not configured');
    }

    const prompt = `Translate the following text from ${dto.sourceLanguage || 'auto-detect'} to ${dto.targetLanguage}. ${dto.preserveFormatting ? 'Preserve all formatting, HTML tags, and structure.' : ''}\n\nText:\n${dto.text}\n\nTranslation:`;

    try {
      const response = await firstValueFrom(
        this.http.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content:
                  'You are a professional translator. Provide only the translation without any additional text or explanations.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const translatedText = response.data.choices[0].message.content.trim();

      return {
        originalText: dto.text,
        translatedText,
        sourceLanguage: dto.sourceLanguage || Language.EN,
        targetLanguage: dto.targetLanguage,
        provider: TranslationProvider.OPENAI,
      };
    } catch (error) {
      this.logger.error(`OpenAI translation failed: ${error.message}`);
      throw new BadRequestException('OpenAI translation failed');
    }
  }
}
