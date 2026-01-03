import { Injectable, NotFoundException, ForbiddenException, Logger, Inject, Optional } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditCertificateService } from './audit-certificate.service';
import { CrmOutboundSyncService } from '../crm-integrations/crm-outbound-sync.service';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private auditCertificateService: AuditCertificateService,
    @Optional() private crmOutboundSyncService?: CrmOutboundSyncService,
  ) { }


  async create(userId: string, data: any) {
    const slug = nanoid(12); // Generate unique slug for public URL

    return this.prisma.proposal.create({
      data: {
        ...data,
        slug,
        userId,
      },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.proposal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
          orderBy: { order: 'asc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            name: true,
            companyName: true,
            companyLogo: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check ownership if userId provided
    if (userId && proposal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return proposal;
  }

  async findBySlug(slug: string, metadata?: any) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { slug },
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
          orderBy: { order: 'asc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        user: {
          select: {
            name: true,
            companyName: true,
            companyLogo: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Track view (only if not locked/approved)
    if (!proposal.locked && proposal.status !== 'APPROVED') {
      await this.eventsGateway.notifyProposalViewed(proposal.id, metadata);
    }

    return proposal;
  }

  async update(id: string, userId: string, data: any) {
    const proposal = await this.findOne(id, userId);

    if (proposal.locked) {
      throw new ForbiddenException('Cannot edit locked proposal');
    }

    return this.prisma.proposal.update({
      where: { id },
      data,
      include: {
        blocks: {
          include: {
            pricingItems: true,
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.proposal.delete({
      where: { id },
    });
  }

  /**
   * Sign a proposal - updates status to SIGNED and generates audit certificate
   */
  async approve(slug: string, signatureData: any) {
    const proposal = await this.findBySlug(slug);

    if (proposal.locked) {
      throw new ForbiddenException('Proposal already signed');
    }

    // Update proposal to SIGNED status
    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        approvedAt: new Date(),
        signatureData,
        signerName: signatureData.name || signatureData.signerName,
        signerEmail: signatureData.email || signatureData.signerEmail,
        locked: true,
      },
    });

    // Notify owner
    await this.eventsGateway.notifyProposalApproved(proposal.id);

    // Generate audit trail certificate asynchronously
    this.generateAuditCertificate(proposal.id);

    // Trigger CRM outbound sync if service is available
    if (this.crmOutboundSyncService) {
      this.crmOutboundSyncService.triggerSync(proposal.id, 'signed').catch((err) => {
        this.logger.error('CRM sync failed:', err);
      });
    }

    return updated;
  }

  /**
   * Generate audit certificate in the background
   */
  private async generateAuditCertificate(proposalId: string): Promise<void> {
    try {
      this.logger.log(`Generating audit certificate for proposal ${proposalId}`);

      const { certificateUrl, pdfBuffer } = await this.auditCertificateService.generateCertificate(proposalId);

      // Update proposal with certificate URL
      // In production, you would upload pdfBuffer to S3/R2 and use that URL
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

