import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import { Prisma, ProposalStatus, PricingItemType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditCertificateService } from './audit-certificate.service';
import { CrmOutboundSyncService } from '../crm-integrations/crm-outbound-sync.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ListProposalsQueryDto } from './dto/list-proposals.dto';
import { normalizePagination, paginatedResult } from '../../common/pagination';
import {
  PLAN_LIMITS,
  PlanId,
  resolveEffectivePlan,
  startOfUtcMonth,
} from '../../common/plans';

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  recipientEmail: true,
  recipientName: true,
  totalAmount: true,
  estimatedValue: true,
  currency: true,
  viewCount: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_INCLUDE = {
  blocks: {
    include: {
      pricingItems: {
        orderBy: { order: 'asc' as const },
      },
    },
    orderBy: { order: 'asc' as const },
  },
  comments: {
    orderBy: { createdAt: 'desc' as const },
  },
  user: {
    select: {
      name: true,
      companyName: true,
      companyLogo: true,
    },
  },
} as const;

type IncomingPricingItem = {
  id?: string;
  name?: string;
  description?: string;
  price?: number;
  type?: string;
  quantity?: number;
  enabled?: boolean;
};

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private auditCertificateService: AuditCertificateService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    @Optional() private crmOutboundSyncService?: CrmOutboundSyncService,
  ) {}

  async create(userId: string, data: any) {
    await this.assertWithinProposalLimit(userId);

    const slug = nanoid(12);
    const pricingItems = this.normalizeIncomingPricing(data?.pricingItems);
    const contentHtml = this.normalizeIncomingContent(data?.content);
    const writeData = this.toProposalWriteData(data);
    const status = (writeData.status as ProposalStatus) || ProposalStatus.DRAFT;

    const depositFields = this.normalizeDepositFields(writeData);

    const proposal = await this.prisma.proposal.create({
      data: {
        title: String(writeData.title || 'Untitled Proposal'),
        slug,
        userId,
        status,
        recipientName: (writeData.recipientName as string) || null,
        recipientEmail: (writeData.recipientEmail as string) || null,
        content: contentHtml,
        totalAmount: this.computeTotal(pricingItems),
        currency: (writeData.currency as any) || undefined,
        templateId: (writeData.templateId as string) || undefined,
        expiresAt: writeData.expiresAt ? new Date(String(writeData.expiresAt)) : undefined,
        ...depositFields,
        blocks:
          pricingItems.length > 0
            ? {
                create: [
                  {
                    type: 'PRICING_TABLE',
                    order: 0,
                    content: {},
                    pricingItems: {
                      create: pricingItems.map((item, index) =>
                        this.toPricingCreateInput(item, index),
                      ),
                    },
                  },
                ],
              }
            : undefined,
      },
      include: DETAIL_INCLUDE,
    });

    return this.withClientAliases(proposal);
  }

  async findAll(userId: string, query: ListProposalsQueryDto = {}) {
    const { page, limit, skip, take } = normalizePagination(query);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const where: Prisma.ProposalWhereInput = { userId };

    if (query.status) {
      where.status = query.status as ProposalStatus;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [proposals, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: LIST_SELECT,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return paginatedResult(
      proposals.map((proposal) => this.withClientAliases(proposal)),
      total,
      page,
      limit,
    );
  }

  async findOne(idOrSlug: string, userId?: string) {
    const include = DETAIL_INCLUDE;

    let proposal = await this.prisma.proposal.findUnique({
      where: { id: idOrSlug },
      include,
    });

    if (!proposal) {
      proposal = await this.prisma.proposal.findUnique({
        where: { slug: idOrSlug },
        include,
      });
    }

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (userId && proposal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.withClientAliases(proposal);
  }

  async findBySlug(slug: string, metadata?: any, track = true) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { slug },
      include: DETAIL_INCLUDE,
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Only count client views after send — skip draft previews and refetch noise.
    const trackable =
      track &&
      !proposal.locked &&
      (proposal.status === ProposalStatus.SENT || proposal.status === ProposalStatus.VIEWED);

    if (trackable) {
      await this.eventsGateway.notifyProposalViewed(proposal.id, metadata);
      return this.withClientAliases({
        ...proposal,
        viewCount: (proposal.viewCount || 0) + 1,
        status:
          proposal.status === ProposalStatus.SENT
            ? ProposalStatus.VIEWED
            : proposal.status,
        firstViewedAt: proposal.firstViewedAt || new Date(),
        lastViewedAt: new Date(),
      });
    }

    return this.withClientAliases(proposal);
  }

  async update(idOrSlug: string, userId: string, data: any) {
    const proposal = await this.findOne(idOrSlug, userId);

    if (proposal.locked) {
      throw new ForbiddenException('Cannot edit locked proposal');
    }

    const pricingItems = data?.pricingItems
      ? this.normalizeIncomingPricing(data.pricingItems)
      : null;
    const writeData = this.toProposalWriteData(data);
    const contentHtml =
      data?.content !== undefined ? this.normalizeIncomingContent(data.content) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (pricingItems) {
        const pricingBlocks = await tx.proposalBlock.findMany({
          where: { proposalId: proposal.id, type: 'PRICING_TABLE' },
          select: { id: true },
        });

        if (pricingBlocks.length > 0) {
          await tx.proposalBlock.deleteMany({
            where: { id: { in: pricingBlocks.map((b) => b.id) } },
          });
        }

        if (pricingItems.length > 0) {
          await tx.proposalBlock.create({
            data: {
              type: 'PRICING_TABLE',
              order: 0,
              content: {},
              proposalId: proposal.id,
              pricingItems: {
                create: pricingItems.map((item, index) =>
                  this.toPricingCreateInput(item, index, proposal.id),
                ),
              },
            },
          });
        }
      }

      return tx.proposal.update({
        where: { id: proposal.id },
        data: {
          ...(writeData.title !== undefined ? { title: String(writeData.title) } : {}),
          ...(writeData.recipientName !== undefined
            ? { recipientName: writeData.recipientName as string }
            : {}),
          ...(writeData.recipientEmail !== undefined
            ? { recipientEmail: writeData.recipientEmail as string }
            : {}),
          ...(writeData.status !== undefined
            ? { status: writeData.status as ProposalStatus }
            : {}),
          ...(contentHtml !== undefined ? { content: contentHtml } : {}),
          ...(pricingItems
            ? { totalAmount: this.computeTotal(pricingItems) }
            : writeData.totalAmount !== undefined
              ? { totalAmount: Number(writeData.totalAmount) }
              : {}),
          ...(writeData.currency !== undefined ? { currency: writeData.currency as any } : {}),
          ...(writeData.expiresAt !== undefined
            ? {
                expiresAt: writeData.expiresAt
                  ? new Date(String(writeData.expiresAt))
                  : null,
              }
            : {}),
          ...this.normalizeDepositFields(writeData, { partial: true }),
        },
        include: DETAIL_INCLUDE,
      });
    });

    return this.withClientAliases(updated);
  }

  async delete(idOrSlug: string, userId: string) {
    const proposal = await this.findOne(idOrSlug, userId);

    return this.prisma.proposal.delete({
      where: { id: proposal.id },
    });
  }

  /**
   * Mark proposal as SENT, set sentAt, and email the client the public link.
   */
  async send(idOrSlug: string, userId: string) {
    const proposal = await this.findOne(idOrSlug, userId);

    if (proposal.locked) {
      throw new ForbiddenException('Cannot send a locked proposal');
    }

    const recipientEmail = proposal.recipientEmail || proposal.clientEmail;
    if (!recipientEmail) {
      throw new BadRequestException('Client email is required before sending');
    }

    const contentHtml = this.normalizeIncomingContent(proposal.content);
    if (!contentHtml?.trim() && !(proposal.pricingItems?.length > 0)) {
      throw new BadRequestException('Add proposal content or pricing before sending');
    }

    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: ProposalStatus.SENT,
        sentAt: new Date(),
      },
      include: DETAIL_INCLUDE,
    });

    await this.prisma.activity.create({
      data: {
        type: 'proposal_sent',
        proposalId: proposal.id,
        userId,
        metadata: {
          recipientEmail,
          slug: proposal.slug,
        },
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const publicUrl = `${frontendUrl}/p/${proposal.slug}`;
    let emailSent = false;

    try {
      emailSent = await this.emailService.sendProposalToClient({
        to: recipientEmail,
        clientName: proposal.recipientName || proposal.clientName || 'there',
        proposalTitle: proposal.title,
        proposalUrl: publicUrl,
        senderName: proposal.user?.name || 'SyncQuote',
        companyName: proposal.user?.companyName,
      });
    } catch (error) {
      this.logger.warn(
        `Proposal ${proposal.id} marked SENT but email failed: ${(error as Error).message}`,
      );
    }

    return {
      ...this.withClientAliases(updated),
      publicUrl,
      emailSent,
    };
  }

  async approve(slug: string, signatureData: any) {
    // Do not bump view count when the client is signing.
    const proposal = await this.findBySlug(slug, undefined, false);

    if (proposal.locked) {
      throw new ForbiddenException('Proposal already signed');
    }

    const signedAt = new Date();
    const signerName =
      signatureData?.name ||
      signatureData?.signerName ||
      signatureData?.clientName ||
      proposal.recipientName ||
      proposal.clientName ||
      'Client';
    const signerEmail =
      signatureData?.email ||
      signatureData?.signerEmail ||
      signatureData?.clientEmail ||
      proposal.recipientEmail ||
      proposal.clientEmail ||
      null;
    const image =
      signatureData?.signatureData ||
      signatureData?.signatureUrl ||
      signatureData?.image ||
      null;

    const normalizedSignature = {
      name: signerName,
      email: signerEmail,
      signatureData: image,
      signatureUrl: image,
      timestamp: signedAt.toISOString(),
      signedAt: signedAt.toISOString(),
      ipAddress: signatureData?.ipAddress || null,
      userAgent: signatureData?.userAgent || null,
    };

    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: 'SIGNED',
        signedAt,
        approvedAt: signedAt,
        signatureData: normalizedSignature,
        signerName,
        signerEmail,
        locked: true,
      },
    });

    await this.prisma.activity.create({
      data: {
        type: 'proposal_signed',
        proposalId: proposal.id,
        userId: proposal.userId,
        metadata: {
          signerName,
          signerEmail,
          ipAddress: normalizedSignature.ipAddress,
          userAgent: normalizedSignature.userAgent,
          details: `Accepted by ${signerName}`,
        },
      },
    });

    await this.notificationsService.notifyProposalSigned(
      proposal.userId,
      proposal.id,
      proposal.title,
      signerName,
    );

    await this.eventsGateway.notifyProposalApproved(proposal.id, proposal.slug);
    this.generateAuditCertificate(proposal.id);

    if (this.crmOutboundSyncService) {
      this.crmOutboundSyncService.triggerSync(proposal.id, 'signed').catch((err) => {
        this.logger.error('CRM sync failed:', err);
      });
    }

    return this.withClientAliases(updated);
  }

  async addPublicComment(slug: string, data: any) {
    const proposal = await this.findBySlug(slug);

    const comment = await this.prisma.comment.create({
      data: {
        content: data.content,
        authorName: data.authorName || data.author || 'Client',
        authorEmail: data.authorEmail,
        parentId: data.parentId,
        mentions: data.mentions,
        proposalId: proposal.id,
      },
    });

    await this.eventsGateway.notifyCommentAdded(proposal.id, comment);

    await this.prisma.activity.create({
      data: {
        type: 'comment_added',
        proposalId: proposal.id,
        userId: proposal.userId,
        metadata: {
          commentId: comment.id,
          authorName: data.authorName || data.author || 'Client',
          parentId: data.parentId,
        },
      },
    });

    return comment;
  }

  async generatePublicPdf(slug: string): Promise<Buffer> {
    const proposal = await this.findBySlug(slug, undefined, false);

    try {
      return await this.auditCertificateService.generateProposalPdf(proposal.id);
    } catch (error) {
      this.logger.error('Failed to generate proposal PDF', error);
      throw new ServiceUnavailableException(
        'PDF generation is temporarily unavailable. Ensure Chromium/Puppeteer is installed and try again.',
      );
    }
  }

  async assertWithinProposalLimit(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const planId = this.resolveUserPlan(user);
    const limits = PLAN_LIMITS[planId];
    if (limits.maxProposalsPerMonth == null) {
      return { planId, limits, used: 0 };
    }

    const used = await this.prisma.proposal.count({
      where: {
        userId,
        createdAt: { gte: startOfUtcMonth() },
      },
    });

    if (used >= limits.maxProposalsPerMonth) {
      throw new ForbiddenException(
        `Free plan limit reached (${limits.maxProposalsPerMonth} proposals/month). Upgrade to Pro to continue.`,
      );
    }

    return { planId, limits, used };
  }

  private resolveUserPlan(user: {
    subscriptionStatus?: string | null;
    trialEndsAt?: Date | null;
    metadata?: unknown;
  }): PlanId {
    const metadata = (user.metadata as Record<string, unknown>) || null;
    const priceId =
      typeof metadata?.stripePriceId === 'string' ? metadata.stripePriceId : undefined;
    const pro =
      this.configService.get<string>('STRIPE_PRO_PRICE_ID') ||
      this.configService.get<string>('STRIPE_PRICE_ID');
    const enterprise = this.configService.get<string>('STRIPE_ENTERPRISE_PRICE_ID');

    let planFromStripe: PlanId | null = null;
    if (priceId && enterprise && priceId === enterprise) planFromStripe = 'enterprise';
    else if (priceId && pro && priceId === pro) planFromStripe = 'pro';

    return resolveEffectivePlan({
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      planFromStripe,
    });
  }

  private normalizeDepositFields(
    writeData: Record<string, unknown>,
    options?: { partial?: boolean },
  ) {
    const hasRequired = writeData.depositRequired !== undefined;
    const hasAmount = writeData.depositAmount !== undefined;
    const hasPercentage = writeData.depositPercentage !== undefined;

    if (options?.partial && !hasRequired && !hasAmount && !hasPercentage) {
      return {};
    }

    const depositRequired = hasRequired
      ? Boolean(writeData.depositRequired)
      : options?.partial
        ? undefined
        : false;

    const fields: {
      depositRequired?: boolean;
      depositAmount?: number | null;
      depositPercentage?: number | null;
    } = {};

    if (depositRequired !== undefined) {
      fields.depositRequired = depositRequired;
    }

    if (hasAmount) {
      const amount = writeData.depositAmount;
      fields.depositAmount =
        amount === null || amount === '' ? null : Number(amount);
    } else if (depositRequired === false) {
      fields.depositAmount = null;
    }

    if (hasPercentage) {
      const pct = writeData.depositPercentage;
      fields.depositPercentage =
        pct === null || pct === '' ? null : Number(pct);
    } else if (depositRequired === false) {
      fields.depositPercentage = null;
    }

    if (fields.depositRequired === true && !hasAmount && !hasPercentage) {
      fields.depositPercentage = 50;
    }

    return fields;
  }

  /**
   * Frontend forms send clientName/clientEmail; Prisma stores recipientName/recipientEmail.
   * Strip relation fields that must not be written directly onto Proposal.
   */
  private toProposalWriteData(data: Record<string, unknown> = {}) {
    const {
      clientName,
      clientEmail,
      pricingItems: _pricingItems,
      blocks: _blocks,
      comments: _comments,
      user: _user,
      id: _id,
      slug: _slug,
      userId: _userId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      publicUrl: _publicUrl,
      emailSent: _emailSent,
      ...rest
    } = data;

    const writeData: Record<string, unknown> = { ...rest };

    const recipientName = rest.recipientName ?? clientName;
    const recipientEmail = rest.recipientEmail ?? clientEmail;
    if (recipientName !== undefined) writeData.recipientName = recipientName;
    if (recipientEmail !== undefined) writeData.recipientEmail = recipientEmail;

    // content handled separately when syncing pricing/blocks
    delete writeData.content;
    delete writeData.pricingItems;

    return writeData;
  }

  private normalizeIncomingContent(content: unknown): string {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null && 'html' in content) {
      return String((content as { html?: unknown }).html ?? '');
    }
    try {
      return JSON.stringify(content);
    } catch {
      return '';
    }
  }

  private normalizeIncomingPricing(items: unknown): IncomingPricingItem[] {
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => item && typeof item === 'object')
      .map((item) => item as IncomingPricingItem);
  }

  private toPricingCreateInput(
    item: IncomingPricingItem,
    index: number,
    _proposalId?: string,
  ): Prisma.PricingItemCreateWithoutBlockInput {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const type = this.toPricingItemType(item.type);

    return {
      name: (item.name || 'Item').trim() || 'Item',
      description: item.description || null,
      price: Number(item.price) || 0,
      type,
      order: index,
      minQuantity: qty,
      maxQuantity: Math.max(qty, 10),
    };
  }

  private toPricingItemType(type?: string): PricingItemType {
    if (type === 'OPTIONAL' || type === 'QUANTITY' || type === 'FIXED') {
      return type;
    }
    return PricingItemType.FIXED;
  }

  private computeTotal(items: IncomingPricingItem[]): number {
    return items.reduce((sum, item) => {
      if (item.enabled === false) return sum;
      const qty = Number(item.quantity) || 1;
      return sum + (Number(item.price) || 0) * qty;
    }, 0);
  }

  private withClientAliases<
    T extends {
      recipientName?: string | null;
      recipientEmail?: string | null;
      content?: unknown;
      blocks?: Array<{
        type: string;
        pricingItems?: Array<{
          id: string;
          name: string;
          description?: string | null;
          price: number;
          type: string;
          order: number;
          minQuantity?: number;
          maxQuantity?: number;
        }>;
      }>;
      user?: { name?: string | null; companyName?: string | null; companyLogo?: string | null };
    },
  >(proposal: T) {
    const pricingFromBlocks =
      proposal.blocks?.flatMap((block) =>
        (block.pricingItems || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: item.price,
          type: item.type as 'FIXED' | 'OPTIONAL' | 'QUANTITY',
          quantity: item.minQuantity || 1,
          enabled: true,
        })),
      ) || [];

    return {
      ...proposal,
      clientName: proposal.recipientName ?? '',
      clientEmail: proposal.recipientEmail ?? '',
      content: this.normalizeIncomingContent(proposal.content),
      pricingItems: pricingFromBlocks,
      companyName: proposal.user?.companyName,
      companyLogo: proposal.user?.companyLogo,
    };
  }

  private async generateAuditCertificate(proposalId: string): Promise<void> {
    try {
      this.logger.log(`Generating audit certificate for proposal ${proposalId}`);

      const { certificateUrl } =
        await this.auditCertificateService.generateCertificate(proposalId);

      await this.prisma.proposal.update({
        where: { id: proposalId },
        data: { pdfUrl: certificateUrl },
      });

      this.logger.log(`Audit certificate generated for proposal ${proposalId}`);
    } catch (error) {
      this.logger.error(`Failed to generate audit certificate for proposal ${proposalId}`, error);
    }
  }
}
