import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AbTestingController } from './ab-testing.controller';
import { AbTestingService } from './ab-testing.service';
import { StatisticalAnalysisService } from './statistical-analysis.service';
import { AbTestingScheduler } from './ab-testing.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule, ScheduleModule],
  controllers: [AbTestingController],
  providers: [AbTestingService, StatisticalAnalysisService, AbTestingScheduler],
  exports: [AbTestingService, StatisticalAnalysisService],
})
export class AbTestingModule {}
