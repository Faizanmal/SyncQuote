import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(
    proposalId: string,
    data: {
      content: string;
      authorName: string;
      authorEmail?: string;
      parentId?: string;
      mentions?: string[];
    },
  ) {
    // Verify proposal exists
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: data.content,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        parentId: data.parentId,
        mentions: data.mentions,
        proposalId,
      },
    });

    // Notify in real-time
    await this.eventsGateway.notifyCommentAdded(proposalId, comment);

    // Create activity
    await this.prisma.activity.create({
      data: {
        type: 'comment_added',
        proposalId,
        userId: proposal.userId,
        metadata: {
          commentId: comment.id,
          authorName: data.authorName,
          parentId: data.parentId,
        },
      },
    });

    return comment;
  }

  async resolve(commentId: string) {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  async findAll(proposalId: string) {
    return this.prisma.comment.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
