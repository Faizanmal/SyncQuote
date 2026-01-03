import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SubmitFeedbackDto {
  rating?: number;
  comment?: string;
  clientName: string;
  clientEmail: string;
}

@Injectable()
export class ClientPortalService {
  constructor(private prisma: PrismaService) {}

  async getClientProposals(email: string) {
    return this.prisma.proposal.findMany({
      where: {
        recipientEmail: email,
      },
      include: {
        user: {
          select: {
            name: true,
            companyName: true,
            companyLogo: true,
            brandColor: true,
            brandColorSecondary: true,
          },
        },
        blocks: {
          include: {
            pricingItems: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getProposalBySlug(slug: string, email?: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            name: true,
            companyName: true,
            companyLogo: true,
            brandColor: true,
            brandColorSecondary: true,
            email: true,
          },
        },
        blocks: {
          include: {
            pricingItems: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        comments: {
          where: {
            parentId: null,
          },
          include: {
            replies: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    // Track view
    if (proposal.status === 'SENT' || proposal.status === 'DRAFT') {
      await this.prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          status: 'VIEWED',
          viewCount: { increment: 1 },
          firstViewedAt: proposal.firstViewedAt || new Date(),
          lastViewedAt: new Date(),
        },
      });

      // Create notification for owner
      await this.prisma.notification.create({
        data: {
          userId: proposal.userId,
          type: 'proposal_viewed',
          title: 'Proposal Viewed',
          message: `Your proposal "${proposal.title}" was viewed`,
          proposalId: proposal.id,
        },
      });
    }

    return proposal;
  }

  async submitFeedback(proposalId: string, feedbackData: SubmitFeedbackDto) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const feedback = await this.prisma.clientFeedback.create({
      data: {
        proposalId,
        rating: feedbackData.rating,
        comment: feedbackData.comment,
        clientName: feedbackData.clientName,
        clientEmail: feedbackData.clientEmail,
      },
    });

    // Notify proposal owner
    await this.prisma.notification.create({
      data: {
        userId: proposal.userId,
        type: 'feedback_received',
        title: 'New Feedback Received',
        message: `${feedbackData.clientName} left feedback on "${proposal.title}"`,
        proposalId: proposal.id,
        metadata: {
          rating: feedbackData.rating,
        },
      },
    });

    return feedback;
  }

  async getProposalFeedback(proposalId: string) {
    return this.prisma.clientFeedback.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async signProposal(
    proposalId: string,
    signatureData: {
      signatureUrl: string;
      signerName: string;
      signerEmail: string;
      ipAddress?: string;
    },
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.locked) {
      throw new Error('Proposal is locked and cannot be signed');
    }

    const updatedProposal = await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: signatureData.signerName,
        signerEmail: signatureData.signerEmail,
        signatureData: {
          ...signatureData,
          timestamp: new Date().toISOString(),
        },
        locked: true,
      },
    });

    // Create notification
    await this.prisma.notification.create({
      data: {
        userId: proposal.userId,
        type: 'proposal_signed',
        title: 'Proposal Signed! 🎉',
        message: `${signatureData.signerName} signed "${proposal.title}"`,
        proposalId: proposal.id,
      },
    });

    // Log in audit trail
    await this.prisma.auditLog.create({
      data: {
        action: 'sign',
        entityType: 'proposal',
        entityId: proposalId,
        userEmail: signatureData.signerEmail,
        ipAddress: signatureData.ipAddress,
        metadata: {
          signerName: signatureData.signerName,
        },
      },
    });

    return updatedProposal;
  }
}
