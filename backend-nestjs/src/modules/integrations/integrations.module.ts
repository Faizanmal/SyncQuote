import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarIntegrationService } from './services/calendar-integration.service';
import { DocumentManagementService } from './services/document-management.service';
import { CommunicationToolsService } from './services/communication-tools.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsCatalogService } from './services/integrations-catalog.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [
    CalendarIntegrationService,
    DocumentManagementService,
    CommunicationToolsService,
    IntegrationsCatalogService,
  ],
  exports: [CalendarIntegrationService, DocumentManagementService, CommunicationToolsService],
})
export class IntegrationsModule {}
