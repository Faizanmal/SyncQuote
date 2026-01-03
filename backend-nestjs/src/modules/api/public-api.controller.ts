import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { OAuthService } from './oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus, Currency } from '@prisma/client';
import {
  CreateProposalApiDto,
  UpdateProposalApiDto,
  ListProposalsQueryDto,
  ApiKeyPermission,
} from './dto';

/**
 * Public API controller for third-party integrations
 * Authenticates via API key or OAuth token
 */
@Controller('v1')
export class PublicApiController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly oauthService: OAuthService,
    private readonly prisma: PrismaService,
  ) {}
  /**
   * Authenticate request and return user context
   */
  private async authenticate(authHeader: string, requiredPermission?: ApiKeyPermission) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Check if it's an API key
      if (token.startsWith('sq_')) {
        return this.apiKeysService.validateApiKey(token, requiredPermission);
      }

      // Otherwise treat as OAuth token
      const tokenData = await this.oauthService.validateAccessToken(token);
      if (requiredPermission && !tokenData.scopes.includes(requiredPermission)) {
        throw new ForbiddenException('Insufficient permissions');
      }
      return { userId: tokenData.userId, permissions: tokenData.scopes, rateLimit: 1000 };
    }

    throw new UnauthorizedException('Invalid Authorization header format');
  }

  // ==================== PROPOSALS API ====================

  /**
   * List proposals
   * GET /v1/proposals
   */
  @Get('proposals')
  async listProposals(
    @Headers('authorization') authHeader: string,
    @Query() query: ListProposalsQueryDto,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_READ);

    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId: auth.userId };
    if (status) where.status = status as ProposalStatus;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { recipientEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [proposals, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          status: true,
          recipientEmail: true,
          recipientName: true,
          totalAmount: true,
          currency: true,
          sentAt: true,
          viewedAt: true,
          signedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      data: proposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single proposal
   * GET /v1/proposals/:id
   */
  @Get('proposals/:id')
  async getProposal(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_READ);

    const proposal = await this.prisma.proposal.findFirst({
      where: { id, userId: auth.userId },
      include: {
        lineItems: true,
        template: { select: { id: true, name: true } },
      },
    });

    if (!proposal) {
      throw new ForbiddenException('Proposal not found or access denied');
    }

    return { data: proposal };
  }
  /**
   * Create proposal
   * POST /v1/proposals
   */
  @Post('proposals')
  async createProposal(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateProposalApiDto,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_WRITE);

    const proposal = await this.prisma.proposal.create({
      data: {
        userId: auth.userId,
        title: dto.title,
        recipientEmail: dto.recipientEmail,
        recipientName: dto.recipientName,
        templateId: dto.templateId,
        currency: (dto.currency as Currency) || Currency.USD,
        content: dto.content || {},
        metadata: dto.metadata || {},
        status: ProposalStatus.DRAFT,
      } as any,
    });

    return { data: proposal };
  }

  /**
   * Update proposal
   * PUT /v1/proposals/:id
   */
  @Put('proposals/:id')
  async updateProposal(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() dto: UpdateProposalApiDto,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_WRITE);

    // Check ownership
    const existing = await this.prisma.proposal.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      throw new ForbiddenException('Proposal not found or access denied');
    }

    const proposal = await this.prisma.proposal.update({
      where: { id },
      data: {
        title: dto.title,
        status: dto.status as ProposalStatus, // Assuming dto.status matches or validation handles it
        recipientEmail: dto.recipientEmail,
        recipientName: dto.recipientName,
        content: dto.content,
        metadata: dto.metadata,
      } as any,
    });

    return { data: proposal };
  }

  /**
   * Delete proposal
   * DELETE /v1/proposals/:id
   */
  @Delete('proposals/:id')
  async deleteProposal(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_DELETE);

    const existing = await this.prisma.proposal.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      throw new ForbiddenException('Proposal not found or access denied');
    }

    await this.prisma.proposal.delete({ where: { id } });

    return { success: true };
  }

  /**
   * Send proposal
   * POST /v1/proposals/:id/send
   */
  @Post('proposals/:id/send')
  async sendProposal(
    @Headers('authorization') authHeader: string,
    @Param('id') id: string,
    @Body() body: { message?: string },
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.PROPOSALS_WRITE);

    const proposal = await this.prisma.proposal.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!proposal) {
      throw new ForbiddenException('Proposal not found or access denied');
    }

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.SENT,
        sentAt: new Date(),
      },
    });

    return { data: updated };
  }

  // ==================== TEMPLATES API ====================

  /**
   * List templates
   * GET /v1/templates
   */
  @Get('templates')
  async listTemplates(
    @Headers('authorization') authHeader: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.TEMPLATES_READ);
    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where: {
          OR: [{ userId: auth.userId }, { isPublic: true }],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.template.count({
        where: {
          OR: [{ userId: auth.userId }, { isPublic: true }],
        },
      }),
    ]);

    return {
      data: templates,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get template
   * GET /v1/templates/:id
   */
  @Get('templates/:id')
  async getTemplate(@Headers('authorization') authHeader: string, @Param('id') id: string) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.TEMPLATES_READ);

    const template = await this.prisma.template.findFirst({
      where: {
        id,
        OR: [{ userId: auth.userId }, { isPublic: true }],
      },
    });

    if (!template) {
      throw new ForbiddenException('Template not found or access denied');
    }

    return { data: template };
  }

  // ==================== CLIENTS API ====================

  /**
   * List clients
   * GET /v1/clients
   */
  @Get('clients')
  async listClients(
    @Headers('authorization') authHeader: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.CLIENTS_READ);
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where: { userId: auth.userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        } as any,
      }),
      this.prisma.client.count({ where: { userId: auth.userId } }),
    ]);

    return {
      data: clients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================== ANALYTICS API ====================

  /**
   * Get analytics overview
   * GET /v1/analytics/overview
   */
  @Get('analytics/overview')
  async getAnalyticsOverview(
    @Headers('authorization') authHeader: string,
    @Query('days') days: number = 30,
  ) {
    const auth = await this.authenticate(authHeader, ApiKeyPermission.ANALYTICS_READ);

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalProposals, sentProposals, viewedProposals, signedProposals, totalRevenue] =
      await Promise.all([
        this.prisma.proposal.count({
          where: { userId: auth.userId, createdAt: { gte: startDate } },
        }),
        this.prisma.proposal.count({
          where: { userId: auth.userId, status: ProposalStatus.SENT, sentAt: { gte: startDate } },
        }),
        this.prisma.proposal.count({
          where: { userId: auth.userId, viewedAt: { gte: startDate } },
        }),
        this.prisma.proposal.count({
          where: {
            userId: auth.userId,
            status: ProposalStatus.SIGNED,
            signedAt: { gte: startDate },
          },
        }),
        this.prisma.proposal.aggregate({
          where: {
            userId: auth.userId,
            status: ProposalStatus.SIGNED,
            signedAt: { gte: startDate },
          },
          _sum: { totalAmount: true },
        }),
      ]);

    return {
      data: {
        period: { days, startDate, endDate: new Date() },
        proposals: {
          total: totalProposals,
          sent: sentProposals,
          viewed: viewedProposals,
          signed: signedProposals,
        },
        revenue: totalRevenue._sum.totalAmount || 0,
        rates: {
          viewRate: sentProposals > 0 ? (viewedProposals / sentProposals) * 100 : 0,
          signRate: sentProposals > 0 ? (signedProposals / sentProposals) * 100 : 0,
        },
      },
    };
  }

  // ==================== HEALTH CHECK ====================

  /**
   * API health check
   * GET /v1/health
   */
  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get API rate limit status
   * GET /v1/rate-limit
   */
  @Get('rate-limit')
  async getRateLimit(@Headers('authorization') authHeader: string) {
    const auth = await this.authenticate(authHeader);

    return {
      rateLimit: (auth as any).rateLimit || 1000,
      // In a real implementation, you'd track actual usage
      remaining: (auth as any).rateLimit || 1000,
      reset: new Date(Date.now() + 3600000).toISOString(),
    };
  }
}
