import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsHubService } from './payments-hub.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AutomationModule } from '../automation/automation.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AutomationModule, InvoicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsHubService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
