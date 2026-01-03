import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrmIntegrationsService } from './crm-integrations.service';
import { CrmProvider, ConfigureSyncDto, ConfigureStageMappingDto } from './dto/crm.dto';

@ApiTags('CRM Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmIntegrationsController {
  constructor(private readonly crmService: CrmIntegrationsService) {}

  @Get('integrations')
  @ApiOperation({ summary: 'Get all active CRM integrations for user' })
  async getIntegrations(@Request() req: any) {
    return this.crmService.getActiveIntegrations(req.user.id);
  }

  @Get('connect/:provider')
  @ApiOperation({ summary: 'Get OAuth authorization URL for CRM' })
  async getAuthUrl(@Param('provider') provider: CrmProvider, @Request() req: any) {
    const url = await this.crmService.getAuthorizationUrl(req.user.id, provider);
    return { authorizationUrl: url };
  }

  @Get('callback/:provider')
  @ApiOperation({ summary: 'OAuth callback handler' })
  async handleCallback(
    @Param('provider') provider: CrmProvider,
    @Query('code') code: string,
    @Query('state') state: string, // Contains userId
    @Res() res: Response,
  ) {
    await this.crmService.handleOAuthCallback(provider, code, state);
    // Redirect to frontend settings page
    return res.redirect(`${process.env.FRONTEND_URL}/settings/integrations?connected=${provider}`);
  }

  @Delete('disconnect/:provider')
  @ApiOperation({ summary: 'Disconnect CRM integration' })
  async disconnect(@Param('provider') provider: CrmProvider, @Request() req: any) {
    await this.crmService.disconnect(req.user.id, provider);
    return { success: true };
  }

  @Put(':provider/sync-config')
  @ApiOperation({ summary: 'Configure sync settings for CRM' })
  async configureSyncSettings(
    @Param('provider') provider: CrmProvider,
    @Body() config: ConfigureSyncDto,
    @Request() req: any,
  ) {
    return this.crmService.configureSyncSettings(req.user.id, provider, config);
  }

  @Put(':provider/stage-mappings')
  @ApiOperation({ summary: 'Configure stage mappings between SyncQuote and CRM' })
  async configureStageMappings(
    @Param('provider') provider: CrmProvider,
    @Body() config: ConfigureStageMappingDto,
    @Request() req: any,
  ) {
    return this.crmService.configureStageMappings(req.user.id, provider, config);
  }

  @Get(':provider/stages')
  @ApiOperation({ summary: 'Get CRM deal stages for mapping' })
  async getCrmStages(@Param('provider') provider: CrmProvider, @Request() req: any) {
    return this.crmService.getCrmStages(req.user.id, provider);
  }

  @Get(':provider/contacts')
  @ApiOperation({ summary: 'Get contacts from CRM' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getContacts(
    @Param('provider') provider: CrmProvider,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Request() req: any,
  ) {
    return this.crmService.getContacts(req.user.id, provider, limit, offset);
  }

  @Post(':provider/contacts/:contactId/import')
  @ApiOperation({ summary: 'Import a contact from CRM' })
  async importContact(
    @Param('provider') provider: CrmProvider,
    @Param('contactId') contactId: string,
    @Request() req: any,
  ) {
    return this.crmService.importContact(req.user.id, provider, contactId);
  }

  @Get(':provider/deals')
  @ApiOperation({ summary: 'Get deals from CRM' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getDeals(
    @Param('provider') provider: CrmProvider,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Request() req: any,
  ) {
    return this.crmService.getDeals(req.user.id, provider, limit, offset);
  }

  @Post(':provider/deals/from-proposal/:proposalId')
  @ApiOperation({ summary: 'Create a CRM deal from a proposal' })
  async createDealFromProposal(
    @Param('provider') provider: CrmProvider,
    @Param('proposalId') proposalId: string,
    @Request() req: any,
  ) {
    return this.crmService.createDealFromProposal(req.user.id, provider, proposalId);
  }

  @Post(':provider/deals/:dealId/link/:proposalId')
  @ApiOperation({ summary: 'Link a proposal to an existing CRM deal' })
  async linkProposalToDeal(
    @Param('provider') provider: CrmProvider,
    @Param('dealId') dealId: string,
    @Param('proposalId') proposalId: string,
    @Request() req: any,
  ) {
    return this.crmService.linkProposalToDeal(req.user.id, provider, proposalId, dealId);
  }

  @Post('proposals/:proposalId/sync-status')
  @ApiOperation({ summary: 'Sync proposal status to all linked CRMs' })
  async syncProposalStatus(@Param('proposalId') proposalId: string) {
    return this.crmService.syncProposalStatusToCrm(proposalId);
  }
}
