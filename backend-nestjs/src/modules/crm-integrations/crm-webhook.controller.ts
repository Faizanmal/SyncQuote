import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CrmSyncService } from './crm-sync.service';
import { CrmProvider, WebhookPayloadDto } from './dto/crm.dto';

@ApiTags('CRM Webhooks')
@Controller('webhooks/crm')
export class CrmWebhookController {
  private readonly logger = new Logger(CrmWebhookController.name);

  constructor(private readonly syncService: CrmSyncService) {}

  @Post('hubspot')
  @HttpCode(200)
  @ApiOperation({ summary: 'HubSpot webhook handler' })
  async handleHubspotWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hubspot-signature-v3') signature: string,
    @Body() payload: any[],
  ) {
    this.logger.log('Received HubSpot webhook');

    // Verify signature
    const rawBody = req.rawBody?.toString();
    if (!signature || !(await this.syncService.verifyHubspotSignature(rawBody!, signature))) {
      this.logger.warn('Invalid HubSpot webhook signature');
      return { received: true };
    }

    // Process each event
    for (const event of payload) {
      await this.syncService.processHubspotEvent(event);
    }

    return { received: true };
  }

  @Post('salesforce')
  @HttpCode(200)
  @ApiOperation({ summary: 'Salesforce webhook handler' })
  async handleSalesforceWebhook(
    @Headers('x-sfdc-signature') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log('Received Salesforce webhook');

    // Verify signature
    if (!(await this.syncService.verifySalesforceSignature(payload, signature))) {
      this.logger.warn('Invalid Salesforce webhook signature');
      return { received: true };
    }

    await this.syncService.processSalesforceEvent(payload);
    return { received: true };
  }

  @Post('pipedrive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pipedrive webhook handler' })
  async handlePipedriveWebhook(
    @Headers('x-pipedrive-signature') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log('Received Pipedrive webhook');

    // Verify signature
    if (!(await this.syncService.verifyPipedriveSignature(payload, signature))) {
      this.logger.warn('Invalid Pipedrive webhook signature');
      return { received: true };
    }

    await this.syncService.processPipedriveEvent(payload);
    return { received: true };
  }

  @Post('zoho')
  @HttpCode(200)
  @ApiOperation({ summary: 'Zoho CRM webhook handler' })
  async handleZohoWebhook(@Headers('x-zoho-signature') signature: string, @Body() payload: any) {
    this.logger.log('Received Zoho webhook');

    // Verify signature
    if (!(await this.syncService.verifyZohoSignature(payload, signature))) {
      this.logger.warn('Invalid Zoho webhook signature');
      return { received: true };
    }

    await this.syncService.processZohoEvent(payload);
    return { received: true };
  }
}
