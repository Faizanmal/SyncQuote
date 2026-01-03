import { Module, forwardRef } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { InteractivePricingService } from './interactive-pricing.service';
import { AuditCertificateService } from './audit-certificate.service';
import { PublicPricingController } from './public-pricing.controller';
import { EventsModule } from '../events/events.module';
import { CrmIntegrationsModule } from '../crm-integrations/crm-integrations.module';

@Module({
  imports: [EventsModule, forwardRef(() => CrmIntegrationsModule)],
  controllers: [ProposalsController, PublicPricingController],
  providers: [ProposalsService, InteractivePricingService, AuditCertificateService],
  exports: [ProposalsService, InteractivePricingService, AuditCertificateService],
})
export class ProposalsModule { }

