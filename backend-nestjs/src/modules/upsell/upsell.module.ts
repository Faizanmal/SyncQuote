import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UpsellController } from './upsell.controller';
import { UpsellService } from './upsell.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { DynamicPricingService } from './dynamic-pricing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [UpsellController],
  providers: [UpsellService, RecommendationEngineService, DynamicPricingService],
  exports: [UpsellService, RecommendationEngineService, DynamicPricingService],
})
export class UpsellModule {}
