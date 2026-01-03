import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CrmIntegrationsController } from './crm-integrations.controller';
import { CrmIntegrationsService } from './crm-integrations.service';
import { HubspotService } from './providers/hubspot.service';
import { SalesforceService } from './providers/salesforce.service';
import { PipedriveService } from './providers/pipedrive.service';
import { ZohoService } from './providers/zoho.service';
import { CrmWebhookController } from './crm-webhook.controller';
import { CrmSyncService } from './crm-sync.service';
import { CrmOutboundSyncService } from './crm-outbound-sync.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
    PrismaModule,
  ],
  controllers: [CrmIntegrationsController, CrmWebhookController],
  providers: [
    CrmIntegrationsService,
    CrmSyncService,
    CrmOutboundSyncService,
    HubspotService,
    SalesforceService,
    PipedriveService,
    ZohoService,
  ],
  exports: [CrmIntegrationsService, CrmSyncService, CrmOutboundSyncService],
})
export class CrmIntegrationsModule { }

