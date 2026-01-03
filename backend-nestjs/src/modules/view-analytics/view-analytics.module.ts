import { Module } from '@nestjs/common';
import { ViewAnalyticsService } from './view-analytics.service';
import { ViewAnalyticsController } from './view-analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [ViewAnalyticsController],
  providers: [ViewAnalyticsService],
  exports: [ViewAnalyticsService],
})
export class ViewAnalyticsModule {}
