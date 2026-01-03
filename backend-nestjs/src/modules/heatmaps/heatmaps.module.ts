import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HeatmapsController } from './heatmaps.controller';
import { HeatmapsService } from './heatmaps.service';
import { ClickTrackingService } from './click-tracking.service';
import { ScrollTrackingService } from './scroll-tracking.service';
import { PredictiveScoringService } from './predictive-scoring.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HeatmapsController],
  providers: [
    HeatmapsService,
    ClickTrackingService,
    ScrollTrackingService,
    PredictiveScoringService,
  ],
  exports: [HeatmapsService, ClickTrackingService, ScrollTrackingService, PredictiveScoringService],
})
export class HeatmapsModule {}
