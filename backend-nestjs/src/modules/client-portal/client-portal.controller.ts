import { Controller, Get, Post, Param, Body, Query, Ip } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';

@Controller('client-portal')
export class ClientPortalController {
  constructor(private clientPortalService: ClientPortalService) {}

  @Get('proposals')
  async getClientProposals(@Query('email') email: string) {
    return this.clientPortalService.getClientProposals(email);
  }

  @Get('proposal/:slug')
  async getProposal(@Param('slug') slug: string, @Query('email') email?: string) {
    return this.clientPortalService.getProposalBySlug(slug, email);
  }

  @Post('proposal/:proposalId/feedback')
  async submitFeedback(
    @Param('proposalId') proposalId: string,
    @Body()
    feedbackData: {
      rating?: number;
      comment?: string;
      clientName: string;
      clientEmail: string;
    },
  ) {
    return this.clientPortalService.submitFeedback(proposalId, feedbackData);
  }

  @Get('proposal/:proposalId/feedback')
  async getFeedback(@Param('proposalId') proposalId: string) {
    return this.clientPortalService.getProposalFeedback(proposalId);
  }

  @Post('proposal/:proposalId/sign')
  async signProposal(
    @Param('proposalId') proposalId: string,
    @Body()
    signatureData: {
      signatureUrl: string;
      signerName: string;
      signerEmail: string;
    },
    @Ip() ipAddress: string,
  ) {
    return this.clientPortalService.signProposal(proposalId, {
      ...signatureData,
      ipAddress,
    });
  }
}
