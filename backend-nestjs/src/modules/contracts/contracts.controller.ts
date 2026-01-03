import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContractManagementService } from './services/contract-management.service';

@ApiTags('Contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractService: ContractManagementService) {}

  @Get('templates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get available contract templates' })
  async getTemplates(@Req() req: any) {
    return this.contractService.getContractTemplates(req.user.id);
  }

  @Post('from-proposal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create contract from proposal' })
  async createFromProposal(
    @Req() req: any,
    @Body() body: {
      proposalId: string;
      templateId?: string;
      customContent?: string;
      variables?: Record<string, string>;
      expiresAt?: string;
      signerInfo?: {
        name: string;
        email: string;
        title?: string;
        company?: string;
      };
    },
  ) {
    return this.contractService.createContractFromProposal(req.user.id, {
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Post(':proposalId/send')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send contract for signature' })
  async sendContract(
    @Req() req: any,
    @Param('proposalId') proposalId: string,
    @Body() body: { recipientEmail: string },
  ) {
    await this.contractService.sendContract(req.user.id, proposalId, body.recipientEmail);
    return { success: true };
  }

  @Post(':proposalId/sign')
  @ApiOperation({ summary: 'Sign contract (public endpoint)' })
  async signContract(
    @Param('proposalId') proposalId: string,
    @Body() body: {
      signatureUrl: string;
      signerName: string;
      signerEmail: string;
      signerIp?: string;
    },
  ) {
    return this.contractService.signContract(proposalId, body);
  }

  @Get(':proposalId')
  @ApiOperation({ summary: 'Get contract by proposal ID (public for viewing)' })
  async getContract(@Param('proposalId') proposalId: string) {
    return this.contractService.getContract(proposalId);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all contracts for user' })
  async getContracts(@Req() req: any) {
    return this.contractService.getContractsByUser(req.user.id);
  }

  @Post(':proposalId/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel contract' })
  async cancelContract(@Req() req: any, @Param('proposalId') proposalId: string) {
    await this.contractService.cancelContract(req.user.id, proposalId);
    return { success: true };
  }
}
