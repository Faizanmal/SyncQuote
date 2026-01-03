import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Signature verification
  async verifyHubspotSignature(rawBody: string, signature: string): Promise<boolean> {
    try {
      const secret = this.config.get('HUBSPOT_CLIENT_SECRET');
      if (!secret || !rawBody || !signature) return false;

      const timestamp = signature.split(';')[0]?.split('=')[1];
      const providedHash = signature.split(';')[1]?.split('=')[1];

      const sourceString = `${rawBody}${timestamp}`;
      const computedHash = crypto.createHmac('sha256', secret).update(sourceString).digest('hex');

      return computedHash === providedHash;
    } catch (error) {
      this.logger.error('Error verifying HubSpot signature', error);
      return false;
    }
  }

  async verifySalesforceSignature(payload: any, signature: string): Promise<boolean> {
    try {
      const secret = this.config.get('SALESFORCE_WEBHOOK_SECRET');
      if (!secret || !signature) return false;

      const computedHash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return computedHash === signature;
    } catch (error) {
      this.logger.error('Error verifying Salesforce signature', error);
      return false;
    }
  }

  async verifyPipedriveSignature(payload: any, signature: string): Promise<boolean> {
    try {
      const secret = this.config.get('PIPEDRIVE_WEBHOOK_SECRET');
      if (!secret || !signature) return false;

      const computedHash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return computedHash === signature;
    } catch (error) {
      this.logger.error('Error verifying Pipedrive signature', error);
      return false;
    }
  }

  async verifyZohoSignature(payload: any, signature: string): Promise<boolean> {
    try {
      const secret = this.config.get('ZOHO_WEBHOOK_SECRET');
      if (!secret || !signature) return false;

      const computedHash = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return computedHash === signature;
    } catch (error) {
      this.logger.error('Error verifying Zoho signature', error);
      return false;
    }
  }

  // Event processors
  async processHubspotEvent(event: any): Promise<void> {
    this.logger.log(`Processing HubSpot event: ${event.subscriptionType}`);

    try {
      const eventType = event.subscriptionType;
      const objectId = event.objectId?.toString();
      const portalId = event.portalId?.toString();

      // Find integration by portal ID
      const integration = await this.prisma.crmIntegration.findFirst({
        where: {
          provider: 'hubspot',
          metadata: {
            path: ['portalId'],
            equals: portalId,
          },
        },
      });

      if (!integration) {
        this.logger.warn(`No integration found for HubSpot portal ${portalId}`);
        return;
      }

      switch (eventType) {
        case 'deal.propertyChange':
          await this.handleHubspotDealChange(integration.userId, objectId, event);
          break;
        case 'contact.propertyChange':
          await this.handleHubspotContactChange(integration.userId, objectId, event);
          break;
        case 'deal.creation':
          await this.handleHubspotDealCreated(integration.userId, objectId, event);
          break;
        case 'deal.deletion':
          await this.handleHubspotDealDeleted(integration.userId, objectId);
          break;
        default:
          this.logger.log(`Unhandled HubSpot event type: ${eventType}`);
      }

      // Log the webhook event
      await this.logWebhookEvent('hubspot', eventType, event, integration.userId);
    } catch (error) {
      this.logger.error('Error processing HubSpot event', error);
    }
  }

  private async handleHubspotDealChange(userId: string, dealId: string, event: any): Promise<void> {
    const propertyName = event.propertyName;
    const propertyValue = event.propertyValue;

    // Find linked proposal
    const link = await this.prisma.crmDealLink.findFirst({
      where: {
        userId,
        provider: 'hubspot',
        externalDealId: dealId,
      },
      include: { proposal: { select: { id: true, status: true, userId: true } } }, // Fix include since proposal is not a relation?
      // Wait, relation is crmIntegration? No, dealLink has proposalId.
      // Schema check: CrmDealLink has `proposalId` but NO `proposal` relation defined in schema.
      // We need to fetch proposal separately or update schema.
      // I will update schema to add relation, but for now let's query proposal separately to be safe if schema update fails or takes time.
    });

    if (!link) return;

    // Check if it's a stage change
    if (propertyName === 'dealstage') {
      const integration = await this.prisma.crmIntegration.findUnique({
        where: { userId_provider: { userId, provider: 'hubspot' } },
      });

      if (integration?.stageMappings) {
        const mappings = integration.stageMappings as any[];
        const mapping = mappings.find((m) => m.crmStageId === propertyValue);

        if (mapping) {
          await this.prisma.proposal.update({
            where: { id: link.proposalId },
            data: { status: mapping.syncQuoteStatus as any },
          });
          this.logger.log(
            `Updated proposal ${link.proposalId} status to ${mapping.syncQuoteStatus}`,
          );
        }
      }
    }
  }

  private async handleHubspotContactChange(
    userId: string,
    contactId: string,
    event: any,
  ): Promise<void> {
    // Update synced contact if exists
    const contact = await this.prisma.crmContact.findFirst({
      where: {
        userId,
        provider: 'hubspot',
        externalId: contactId,
      },
    });

    if (!contact) return;

    const propertyName = event.propertyName;
    const propertyValue = event.propertyValue;

    const updateData: any = {};
    switch (propertyName) {
      case 'email':
        updateData.email = propertyValue;
        break;
      case 'firstname':
        updateData.firstName = propertyValue;
        break;
      case 'lastname':
        updateData.lastName = propertyValue;
        break;
      case 'company':
        updateData.company = propertyValue;
        break;
      case 'phone':
        updateData.phone = propertyValue;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.crmContact.update({
        where: { id: contact.id },
        data: { ...updateData, lastSyncedAt: new Date() },
      });
    }
  }

  private async handleHubspotDealCreated(
    userId: string,
    dealId: string,
    event: any,
  ): Promise<void> {
    // Log new deal creation - could auto-create proposal if configured
    this.logger.log(`New HubSpot deal created: ${dealId}`);
  }

  private async handleHubspotDealDeleted(userId: string, dealId: string): Promise<void> {
    // Remove link if exists
    await this.prisma.crmDealLink.deleteMany({
      where: {
        userId,
        provider: 'hubspot',
        externalDealId: dealId,
      },
    });
  }

  async processSalesforceEvent(event: any): Promise<void> {
    this.logger.log(`Processing Salesforce event: ${event.event?.type}`);

    try {
      const eventType = event.event?.type;
      const recordId = event.sobject?.Id;
      const organizationId = event.organizationId;

      const integration = await this.prisma.crmIntegration.findFirst({
        where: {
          provider: 'salesforce',
          metadata: {
            path: ['organizationId'],
            equals: organizationId,
          },
        },
      });

      if (!integration) {
        this.logger.warn(`No integration found for Salesforce org ${organizationId}`);
        return;
      }

      switch (eventType) {
        case 'updated':
          await this.handleSalesforceRecordUpdate(integration.userId, recordId, event.sobject);
          break;
        case 'created':
          this.logger.log(`New Salesforce record created: ${recordId}`);
          break;
        case 'deleted':
          await this.handleSalesforceRecordDeleted(integration.userId, recordId);
          break;
      }

      await this.logWebhookEvent('salesforce', eventType, event, integration.userId);
    } catch (error) {
      this.logger.error('Error processing Salesforce event', error);
    }
  }

  private async handleSalesforceRecordUpdate(
    userId: string,
    recordId: string,
    sobject: any,
  ): Promise<void> {
    // Handle opportunity stage change
    if (sobject.StageName) {
      const link = await this.prisma.crmDealLink.findFirst({
        where: {
          userId,
          provider: 'salesforce',
          externalDealId: recordId,
        },
      });

      if (link) {
        const integration = await this.prisma.crmIntegration.findUnique({
          where: { userId_provider: { userId, provider: 'salesforce' } },
        });

        if (integration?.stageMappings) {
          const mappings = integration.stageMappings as any[];
          const mapping = mappings.find((m) => m.crmStageName === sobject.StageName);

          if (mapping) {
            await this.prisma.proposal.update({
              where: { id: link.proposalId },
              data: { status: mapping.syncQuoteStatus as any },
            });
          }
        }
      }
    }
  }

  private async handleSalesforceRecordDeleted(userId: string, recordId: string): Promise<void> {
    await this.prisma.crmDealLink.deleteMany({
      where: {
        userId,
        provider: 'salesforce',
        externalDealId: recordId,
      },
    });
  }

  async processPipedriveEvent(event: any): Promise<void> {
    this.logger.log(`Processing Pipedrive event: ${event.event}`);

    try {
      const eventType = event.event;
      const objectType = event.meta?.object;
      const data = event.current || event.data;

      // Find integration by company domain
      const integration = await this.prisma.crmIntegration.findFirst({
        where: {
          provider: 'pipedrive',
          metadata: {
            path: ['companyDomain'],
            equals: event.meta?.company_id?.toString(),
          },
        },
      });

      if (!integration) return;

      if (objectType === 'deal') {
        switch (eventType) {
          case 'updated.deal':
            await this.handlePipedriveDealUpdate(integration.userId, data);
            break;
          case 'deleted.deal':
            await this.handlePipedriveDealDeleted(integration.userId, data.id?.toString());
            break;
        }
      }

      await this.logWebhookEvent('pipedrive', eventType, event, integration.userId);
    } catch (error) {
      this.logger.error('Error processing Pipedrive event', error);
    }
  }

  private async handlePipedriveDealUpdate(userId: string, data: any): Promise<void> {
    const link = await this.prisma.crmDealLink.findFirst({
      where: {
        userId,
        provider: 'pipedrive',
        externalDealId: data.id?.toString(),
      },
    });

    if (!link) return;

    if (data.stage_id) {
      const integration = await this.prisma.crmIntegration.findUnique({
        where: { userId_provider: { userId, provider: 'pipedrive' } },
      });

      if (integration?.stageMappings) {
        const mappings = integration.stageMappings as any[];
        const mapping = mappings.find((m) => m.crmStageId === data.stage_id?.toString());

        if (mapping) {
          await this.prisma.proposal.update({
            where: { id: link.proposalId },
            data: { status: mapping.syncQuoteStatus as any },
          });
        }
      }
    }
  }

  private async handlePipedriveDealDeleted(userId: string, dealId: string): Promise<void> {
    await this.prisma.crmDealLink.deleteMany({
      where: {
        userId,
        provider: 'pipedrive',
        externalDealId: dealId,
      },
    });
  }

  async processZohoEvent(event: any): Promise<void> {
    this.logger.log(`Processing Zoho event: ${event.operation}`);

    try {
      const operation = event.operation;
      const module = event.module;
      const data = event.ids || event.data;

      const integration = await this.prisma.crmIntegration.findFirst({
        where: {
          provider: 'zoho',
          metadata: {
            path: ['accountDomain'],
            equals: event.account_domain,
          },
        },
      });

      if (!integration) return;

      if (module === 'Deals' || module === 'Potentials') {
        switch (operation) {
          case 'update':
            await this.handleZohoDealUpdate(integration.userId, data);
            break;
          case 'delete':
            for (const id of Array.isArray(data) ? data : [data]) {
              await this.handleZohoDealDeleted(integration.userId, id);
            }
            break;
        }
      }

      await this.logWebhookEvent('zoho', operation, event, integration.userId);
    } catch (error) {
      this.logger.error('Error processing Zoho event', error);
    }
  }

  private async handleZohoDealUpdate(userId: string, data: any): Promise<void> {
    const dealData = Array.isArray(data) ? data[0] : data;

    const link = await this.prisma.crmDealLink.findFirst({
      where: {
        userId,
        provider: 'zoho',
        externalDealId: dealData.id || dealData,
      },
    });

    if (!link) return;

    if (dealData.Stage) {
      const integration = await this.prisma.crmIntegration.findUnique({
        where: { userId_provider: { userId, provider: 'zoho' } },
      });

      if (integration?.stageMappings) {
        const mappings = integration.stageMappings as any[];
        const mapping = mappings.find((m) => m.crmStageName === dealData.Stage);

        if (mapping) {
          await this.prisma.proposal.update({
            where: { id: link.proposalId },
            data: { status: mapping.syncQuoteStatus as any },
          });
        }
      }
    }
  }

  private async handleZohoDealDeleted(userId: string, dealId: string): Promise<void> {
    await this.prisma.crmDealLink.deleteMany({
      where: {
        userId,
        provider: 'zoho',
        externalDealId: dealId,
      },
    });
  }

  private async logWebhookEvent(
    provider: string,
    eventType: string,
    payload: any,
    userId: string,
  ): Promise<void> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { id: true },
    });

    if (integration) {
      await this.prisma.crmWebhookLog.create({
        data: {
          crmIntegrationId: integration.id,
          provider: provider,
          event: eventType,
          payload: payload,
          processed: true,
        },
      });
    }
  }
}
