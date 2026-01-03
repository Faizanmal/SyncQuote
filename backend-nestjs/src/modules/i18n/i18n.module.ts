import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { I18nController } from './i18n.controller';
import { I18nService } from './i18n.service';
import { TranslationService } from './translation.service';
import { LocalizationService } from './localization.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  controllers: [I18nController],
  providers: [I18nService, TranslationService, LocalizationService],
  exports: [I18nService, TranslationService, LocalizationService],
})
export class I18nModule {}
