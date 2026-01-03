import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService } from './translation.service';
import { LocalizationService } from './localization.service';
import {
  TranslateProposalDto,
  CreateTranslationDto,
  UpdateLocalizationSettingsDto,
  LocalizeProposalDto,
  ProposalTranslationDto,
  Language,
  TranslationProvider,
} from './dto/i18n.dto';

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  constructor(
    private prisma: PrismaService,
    private translation: TranslationService,
    private localization: LocalizationService,
  ) {}

  // Translate entire proposal
  async translateProposal(
    userId: string,
    dto: TranslateProposalDto,
  ): Promise<ProposalTranslationDto> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
      include: {
        blocks: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Translate all text blocks
    const translatedSections: any[] = [];

    for (const block of proposal.blocks) {
      if (block.type === 'RICH_TEXT') {
        const content = block.content as any;
        const textToTranslate = content.text || content.html || '';

        if (textToTranslate) {
          const translated = await this.translation.translateText({
            text: textToTranslate,
            targetLanguage: dto.targetLanguage,
            provider: dto.provider,
            preserveFormatting: true,
          });

          translatedSections.push({
            sectionId: block.id,
            originalText: textToTranslate,
            translatedText: translated.translatedText,
          });
        }
      }
    }

    // Create translated proposal copy if requested
    if (dto.createCopy) {
      const translatedProposal = await this.createTranslatedProposal(
        userId,
        proposal,
        translatedSections,
        dto.targetLanguage,
      );

      return {
        proposalId: translatedProposal.id,
        originalProposalId: proposal.id,
        language: dto.targetLanguage,
        translatedAt: new Date(),
        provider: dto.provider || TranslationProvider.GOOGLE,
        sections: translatedSections,
      };
    }

    return {
      proposalId: proposal.id,
      originalProposalId: proposal.id,
      language: dto.targetLanguage,
      translatedAt: new Date(),
      provider: dto.provider || TranslationProvider.GOOGLE,
      sections: translatedSections,
    };
  }

  // Create or update translation
  async createTranslation(userId: string, dto: CreateTranslationDto) {
    return this.prisma.translation.upsert({
      where: {
        key_language_namespace: {
          key: dto.key,
          language: dto.language,
          namespace: dto.namespace || 'default',
        },
      },
      create: {
        userId,
        key: dto.key,
        language: dto.language,
        value: dto.value,
        namespace: dto.namespace || 'default',
        description: dto.description,
      },
      update: {
        value: dto.value,
        description: dto.description,
      },
    });
  }

  // Get translations
  async getTranslations(userId: string, language: Language, namespace?: string) {
    const translations = await this.prisma.translation.findMany({
      where: {
        userId,
        language,
        ...(namespace && { namespace }),
      },
    });

    // Convert to key-value map
    return translations.reduce(
      (acc, t) => {
        acc[t.key] = t.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  // Update localization settings
  async updateLocalizationSettings(userId: string, dto: UpdateLocalizationSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        localizationSettings: {
          defaultLanguage: dto.defaultLanguage,
          supportedLanguages: dto.supportedLanguages,
          defaultCurrency: dto.defaultCurrency,
          dateFormat: dto.dateFormat,
          timeFormat: dto.timeFormat,
          timezone: dto.timezone,
          autoDetectLanguage: dto.autoDetectLanguage,
          rtlEnabled: dto.rtlEnabled,
        },
      },
    });
  }

  // Get localization settings
  async getLocalizationSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { localizationSettings: true },
    });

    return (
      user?.localizationSettings || {
        defaultLanguage: Language.EN,
        supportedLanguages: [Language.EN],
        defaultCurrency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        timezone: 'UTC',
        autoDetectLanguage: false,
        rtlEnabled: false,
      }
    );
  }

  // Localize proposal (currency, dates, numbers)
  async localizeProposal(userId: string, dto: LocalizeProposalDto) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
      include: { blocks: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const locale = this.localization.getLocaleFromLanguage(dto.language);
    const localizedBlocks: any[] = [];

    for (const block of proposal.blocks) {
      const localizedBlock = { ...block };

      // Localize pricing blocks
      if (block.type === 'PRICING_TABLE' && block.content) {
        const content = block.content as any;

        if (content.items) {
          content.items = content.items.map((item: any) => ({
            ...item,
            price: this.localization.formatCurrency(parseFloat(item.price), dto.currency, locale),
          }));
        }

        if (content.total) {
          content.total = this.localization.formatCurrency(
            parseFloat(content.total),
            dto.currency,
            locale,
          );
        }

        // Localize dates in pricing content
        if (content.date || content.dueDate || content.validUntil) {
          const dateFormat = dto.dateFormat || 'long';

          if (content.date) {
            content.date = this.localization.formatDate(new Date(content.date), locale, dateFormat);
          }
          if (content.dueDate) {
            content.dueDate = this.localization.formatDate(
              new Date(content.dueDate),
              locale,
              dateFormat,
            );
          }
          if (content.validUntil) {
            content.validUntil = this.localization.formatDate(
              new Date(content.validUntil),
              locale,
              dateFormat,
            );
          }
        }

        localizedBlock.content = content;
      }

      localizedBlocks.push(localizedBlock);
    }

    return {
      proposalId: proposal.id,
      language: dto.language,
      currency: dto.currency,
      localizedBlocks,
    };
  }

  // Private helper to create translated proposal copy
  private async createTranslatedProposal(
    userId: string,
    original: any,
    translatedSections: any[],
    language: Language,
  ) {
    // Create translated proposal - copy essential data from original
    const translatedProposal = await this.prisma.proposal.create({
      data: {
        userId: userId,
        title: `${original.title} (${language.toUpperCase()})`,
        slug: `${original.slug}-${language.toLowerCase()}`,
        status: 'DRAFT' as any,
        currency: original.currency || ('USD' as any),
      },
    });

    // Create translated blocks
    for (const block of original.blocks) {
      const translatedSection = translatedSections.find((s) => s.sectionId === block.id);

      let content = block.content;
      if (translatedSection) {
        content = {
          ...content,
          text: translatedSection.translatedText,
          html: translatedSection.translatedText,
        };
      }

      await this.prisma.proposalBlock.create({
        data: {
          proposalId: translatedProposal.id,
          type: block.type,
          content,
          order: block.order,
        },
      });
    }

    return translatedProposal;
  }
}
