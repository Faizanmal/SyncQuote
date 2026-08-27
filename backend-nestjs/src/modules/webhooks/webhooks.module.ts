import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { UsersModule } from '../users/users.module';
import { BillingModule } from '../billing/billing.module';
import { PaymentsModule } from '../payments/payments.module';
import { TemplateMarketplaceModule } from '../template-marketplace/template-marketplace.module';

@Module({
  imports: [UsersModule, BillingModule, PaymentsModule, TemplateMarketplaceModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
