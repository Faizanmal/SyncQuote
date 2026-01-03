import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationScheduler } from './automation.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, EmailModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationScheduler],
  exports: [AutomationService],
})
export class AutomationModule {}
