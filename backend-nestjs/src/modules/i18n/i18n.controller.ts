import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { I18nService } from './i18n.service';
import { TranslationService } from './translation.service';
import { LocalizationService } from './localization.service';
import {
  TranslateTextDto,
  TranslateProposalDto,
  CreateTranslationDto,
  BatchTranslateDto,
  UpdateLocalizationSettingsDto,
  LocalizeProposalDto,
  LanguageDetectionDto,
  CurrencyConversionDto,
  Language,
} from './dto/i18n.dto';

@ApiTags('Internationalization')
@Controller('i18n')
export class I18nController {
  constructor(
    private readonly i18nService: I18nService,
    private readonly translationService: TranslationService,
    private readonly localizationService: LocalizationService,
  ) {}

  // Translation endpoints
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('translate/text')
  @ApiOperation({ summary: 'Translate text' })
  async translateText(@Request() req: any, @Body() dto: TranslateTextDto) {
    return this.translationService.translateText(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('translate/batch')
  @ApiOperation({ summary: 'Batch translate multiple texts' })
  async batchTranslate(@Request() req: any, @Body() dto: BatchTranslateDto) {
    return this.translationService.batchTranslate(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('translate/proposal')
  @ApiOperation({ summary: 'Translate entire proposal' })
  async translateProposal(@Request() req: any, @Body() dto: TranslateProposalDto) {
    return this.i18nService.translateProposal(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('detect-language')
  @ApiOperation({ summary: 'Detect language of text' })
  async detectLanguage(@Request() req: any, @Body() dto: LanguageDetectionDto) {
    return this.translationService.detectLanguage(dto.text);
  }

  // Translation management
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('translations')
  @ApiOperation({ summary: 'Create or update translation' })
  async createTranslation(@Request() req: any, @Body() dto: CreateTranslationDto) {
    return this.i18nService.createTranslation(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('translations/:language')
  @ApiOperation({ summary: 'Get translations for language' })
  async getTranslations(
    @Request() req: any,
    @Param('language') language: Language,
    @Query('namespace') namespace?: string,
  ) {
    return this.i18nService.getTranslations(req.user.id, language, namespace);
  }

  // Localization settings
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('settings')
  @ApiOperation({ summary: 'Get localization settings' })
  async getLocalizationSettings(@Request() req: any) {
    return this.i18nService.getLocalizationSettings(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('settings')
  @ApiOperation({ summary: 'Update localization settings' })
  async updateLocalizationSettings(
    @Request() req: any,
    @Body() dto: UpdateLocalizationSettingsDto,
  ) {
    return this.i18nService.updateLocalizationSettings(req.user.id, dto);
  }

  // Localization utilities
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('localize/proposal')
  @ApiOperation({ summary: 'Localize proposal (currency, dates, numbers)' })
  async localizeProposal(@Request() req: any, @Body() dto: LocalizeProposalDto) {
    return this.i18nService.localizeProposal(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('currency/convert')
  @ApiOperation({ summary: 'Convert currency' })
  async convertCurrency(@Request() req: any, @Body() dto: CurrencyConversionDto) {
    return this.localizationService.convertCurrency(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('currency/rates/:from/:to')
  @ApiOperation({ summary: 'Get exchange rate' })
  async getExchangeRate(@Request() req: any, @Param('from') from: string, @Param('to') to: string) {
    const rate = await this.localizationService.getExchangeRate(from as any, to as any);
    return { from, to, rate, timestamp: new Date() };
  }
}
