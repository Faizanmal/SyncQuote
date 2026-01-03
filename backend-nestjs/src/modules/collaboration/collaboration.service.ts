import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import {
  AddCollaboratorDto,
  UpdateCollaboratorDto,
  CreateReviewCycleDto,
  SubmitReviewDto,
  CreateCommentDto,
  UpdateCommentDto,
  ResolveCommentDto,
  CreateSuggestionDto,
  RespondToSuggestionDto,
  SetTrackingModeDto,
  AcceptRejectChangesDto,
  CollaboratorRole,
  ReviewCycleStatus,
  SuggestionStatus,
  ChangeTrackingMode,
} from './dto';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  // ==================== COLLABORATORS ====================

  /**
   * Add collaborator to proposal
   */
  async addCollaborator(ownerId: string, dto: AddCollaboratorDto) {
    // Verify ownership
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId: ownerId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // If user doesn't exist, create invitation
    if (!user) {
      const token = this.generateToken(); // Generate a unique token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expires in 7 days

      const invitation = await this.prisma.collaborationInvitation.create({
        data: {
          proposalId: dto.proposalId,
          email: dto.email,
          role: dto.role,
          message: dto.message,
          invitedById: ownerId,
          token,
          expiresAt,
        },
      });

      // Send invitation email
      await this.sendCollaboratorInvitationEmail(
        dto.email,
        ownerId,
        proposal.title,
        token,
        dto.message,
      );

      return { type: 'invitation', data: invitation };
    }

    // Check if already a collaborator
    const existing = await this.prisma.proposalCollaborator.findFirst({
      where: { proposalId: dto.proposalId, userId: user.id },
    });

    if (existing) {
      throw new BadRequestException('User is already a collaborator');
    }

    // Add collaborator
    const collaborator = await this.prisma.proposalCollaborator.create({
      data: {
        proposalId: dto.proposalId,
        userId: user.id,
        role: dto.role,
        sectionPermissions: dto.sectionPermissions || [],
        invitedById: ownerId,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return { type: 'collaborator', data: collaborator };
  }

  /**
   * Update collaborator permissions
   */
  async updateCollaborator(ownerId: string, collaboratorId: string, dto: UpdateCollaboratorDto) {
    const collaborator = await this.prisma.proposalCollaborator.findUnique({
      where: { id: collaboratorId },
      include: { proposal: true },
    });

    if (!collaborator || collaborator.proposal.userId !== ownerId) {
      throw new NotFoundException('Collaborator not found');
    }

    const updated = await this.prisma.proposalCollaborator.update({
      where: { id: collaboratorId },
      data: {
        role: dto.role,
        sectionPermissions: dto.sectionPermissions,
      },
    });

    return updated;
  }

  /**
   * Remove collaborator
   */
  async removeCollaborator(ownerId: string, collaboratorId: string) {
    const collaborator = await this.prisma.proposalCollaborator.findUnique({
      where: { id: collaboratorId },
      include: { proposal: true },
    });

    if (!collaborator || collaborator.proposal.userId !== ownerId) {
      throw new NotFoundException('Collaborator not found');
    }

    await this.prisma.proposalCollaborator.delete({
      where: { id: collaboratorId },
    });

    return { success: true };
  }

  /**
   * Get collaborators for proposal
   */
  async getCollaborators(userId: string, proposalId: string) {
    // Verify access
    await this.verifyAccess(userId, proposalId, CollaboratorRole.VIEWER);

    const collaborators = await this.prisma.proposalCollaborator.findMany({
      where: { proposalId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return collaborators;
  }

  // ==================== REVIEW CYCLES ====================

  /**
   * Create review cycle
   */
  async createReviewCycle(userId: string, dto: CreateReviewCycleDto) {
    await this.verifyAccess(userId, dto.proposalId, CollaboratorRole.EDITOR);

    const dueDate = dto.dueInDays
      ? new Date(Date.now() + dto.dueInDays * 24 * 60 * 60 * 1000)
      : null;

    const reviewCycle = await this.prisma.reviewCycle.create({
      data: {
        proposalId: dto.proposalId,
        name: dto.name,
        description: dto.description,
        dueDate,
        requireAllApprovals: dto.requireAllApprovals ?? true,
        status: ReviewCycleStatus.PENDING,
        reviewers: {
          create: dto.reviewers.map((r) => ({
            userId: r.userId,
            order: r.order || 1,
            required: r.required ?? true,
          })),
        },
      } as any, // Cast to any to bypass type checking
      include: {
        reviewers: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return reviewCycle;
  }

  /**
   * Submit review decision
   */
  async submitReview(userId: string, dto: SubmitReviewDto) {
    const reviewer = await this.prisma.reviewCycleReviewer.findFirst({
      where: { reviewCycleId: dto.reviewCycleId, userId },
      include: { reviewCycle: true },
    });

    if (!reviewer) {
      throw new ForbiddenException('You are not a reviewer for this cycle');
    }

    if (reviewer.decision) {
      throw new BadRequestException('You have already submitted your review');
    }

    // Update reviewer decision
    await this.prisma.reviewCycleReviewer.update({
      where: { id: reviewer.id },
      data: {
        decision: dto.decision,
        feedback: dto.feedback,
        reviewedAt: new Date(),
      },
    });

    // Check if cycle should be completed
    await this.checkReviewCycleCompletion(dto.reviewCycleId);

    return { success: true };
  }

  /**
   * Check and update review cycle status
   */
  private async checkReviewCycleCompletion(reviewCycleId: string) {
    const cycle = await this.prisma.reviewCycle.findUnique({
      where: { id: reviewCycleId },
      include: { reviewers: true },
    });

    if (!cycle) return;

    const allReviewed = cycle.reviewers.every((r) => r.decision !== null);
    if (!allReviewed) return;

    const allApproved = cycle.reviewers
      .filter((r: any) => r.required)
      .every((r: any) => r.decision === ReviewCycleStatus.APPROVED);

    const anyChangesRequested = cycle.reviewers.some(
      (r: any) => r.decision === ReviewCycleStatus.CHANGES_REQUESTED,
    );

    let newStatus: ReviewCycleStatus;
    if (cycle.requireAllApprovals && !allApproved) {
      newStatus = ReviewCycleStatus.CHANGES_REQUESTED;
    } else if (anyChangesRequested) {
      newStatus = ReviewCycleStatus.CHANGES_REQUESTED;
    } else {
      newStatus = ReviewCycleStatus.APPROVED;
    }

    await this.prisma.reviewCycle.update({
      where: { id: reviewCycleId },
      data: {
        status: newStatus,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Get review cycles for proposal
   */
  async getReviewCycles(userId: string, proposalId: string) {
    await this.verifyAccess(userId, proposalId, CollaboratorRole.VIEWER);

    const cycles = await this.prisma.reviewCycle.findMany({
      where: { proposalId },
      include: {
        reviewers: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cycles;
  }

  // ==================== COMMENTS ====================

  /**
   * Create comment
   */
  async createComment(userId: string, dto: CreateCommentDto) {
    await this.verifyAccess(userId, dto.proposalId, CollaboratorRole.COMMENTER);

    const comment = await this.prisma.proposalComment.create({
      data: {
        proposalId: dto.proposalId,
        userId,
        content: dto.content,
        sectionId: dto.sectionId,
        parentId: dto.parentId,
        mentions: dto.mentions || [],
        position: dto.position as any,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    // Notify mentioned users
    if (dto.mentions?.length) {
      await this.notifyMentionedUsers(dto.mentions, userId, dto.proposalId, dto.content);
    }

    return comment;
  }

  /**
   * Update comment
   */
  async updateComment(userId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.proposalComment.findFirst({
      where: { id: commentId, userId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const updated = await this.prisma.proposalComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        mentions: dto.mentions,
        editedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Delete comment
   */
  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.proposalComment.findFirst({
      where: { id: commentId, userId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.proposalComment.delete({
      where: { id: commentId },
    });

    return { success: true };
  }

  /**
   * Resolve/unresolve comment
   */
  async resolveComment(userId: string, commentId: string, dto: ResolveCommentDto) {
    const comment = await this.prisma.proposalComment.findUnique({
      where: { id: commentId },
      include: { proposal: true },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.verifyAccess(userId, comment.proposalId, CollaboratorRole.EDITOR);

    const updated = await this.prisma.proposalComment.update({
      where: { id: commentId },
      data: {
        resolved: dto.resolved,
        resolvedById: dto.resolved ? userId : null,
        resolvedAt: dto.resolved ? new Date() : null,
        resolution: dto.resolution,
      },
    });

    return updated;
  }

  /**
   * Get comments for proposal
   */
  async getComments(userId: string, proposalId: string, sectionId?: string) {
    await this.verifyAccess(userId, proposalId, CollaboratorRole.VIEWER);

    const where: any = { proposalId, parentId: null };
    if (sectionId) where.sectionId = sectionId;

    const comments = await this.prisma.proposalComment.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        replies: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments;
  }

  // ==================== SUGGESTIONS ====================

  /**
   * Create suggestion
   */
  async createSuggestion(userId: string, dto: CreateSuggestionDto) {
    await this.verifyAccess(userId, dto.proposalId, CollaboratorRole.EDITOR);

    const suggestion = await this.prisma.proposalSuggestion.create({
      data: {
        proposalId: dto.proposalId,
        sectionId: dto.sectionId,
        userId,
        originalContent: dto.originalContent,
        suggestedContent: dto.suggestedContent,
        explanation: dto.explanation,
        status: SuggestionStatus.PENDING,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return suggestion;
  }

  /**
   * Respond to suggestion
   */
  async respondToSuggestion(userId: string, suggestionId: string, dto: RespondToSuggestionDto) {
    const suggestion = await this.prisma.proposalSuggestion.findUnique({
      where: { id: suggestionId },
      include: { proposal: true },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    // Only owner or admin can accept/reject
    await this.verifyAccess(userId, suggestion.proposalId, CollaboratorRole.ADMIN);

    const updated = await this.prisma.proposalSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: dto.status,
        respondedById: userId,
        respondedAt: new Date(),
        response: dto.response,
      },
    });

    // If accepted, apply the change
    if (dto.status === SuggestionStatus.ACCEPTED) {
      await this.applySuggestion(suggestion);
    }

    return updated;
  }

  /**
   * Apply accepted suggestion to proposal content
   */
  private async applySuggestion(suggestion: any) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: suggestion.proposalId },
    });

    if (!proposal) return;

    const content = (proposal.content as any) || {};
    if (content.sections && content.sections[suggestion.sectionId]) {
      content.sections[suggestion.sectionId].content = suggestion.suggestedContent;

      await this.prisma.proposal.update({
        where: { id: suggestion.proposalId },
        data: { content },
      });
    }
  }

  /**
   * Get suggestions for proposal
   */
  async getSuggestions(userId: string, proposalId: string, status?: SuggestionStatus) {
    await this.verifyAccess(userId, proposalId, CollaboratorRole.VIEWER);

    const where: any = { proposalId };
    if (status) where.status = status;

    const suggestions = await this.prisma.proposalSuggestion.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        respondedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return suggestions;
  }

  // ==================== CHANGE TRACKING ====================

  /**
   * Set change tracking mode
   */
  async setTrackingMode(userId: string, dto: SetTrackingModeDto) {
    await this.verifyAccess(userId, dto.proposalId, CollaboratorRole.ADMIN);

    await this.prisma.proposal.update({
      where: { id: dto.proposalId },
      data: {
        trackingMode: dto.mode,
      },
    });

    return { success: true, mode: dto.mode };
  }

  /**
   * Get tracked changes
   */
  async getTrackedChanges(userId: string, proposalId: string) {
    await this.verifyAccess(userId, proposalId, CollaboratorRole.VIEWER);

    const changes = await this.prisma.proposalChange.findMany({
      where: { proposalId, status: 'pending' },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return changes;
  }

  /**
   * Accept or reject tracked changes
   */
  async handleTrackedChanges(userId: string, dto: AcceptRejectChangesDto) {
    await this.verifyAccess(userId, dto.proposalId, CollaboratorRole.ADMIN);

    const changes = await this.prisma.proposalChange.findMany({
      where: { id: { in: dto.changeIds }, proposalId: dto.proposalId },
    });

    for (const change of changes) {
      if (dto.accept) {
        // Apply change to content
        // Implementation depends on content structure
      }

      await this.prisma.proposalChange.update({
        where: { id: change.id },
        data: {
          status: dto.accept ? 'accepted' : 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });
    }

    return { success: true, processed: changes.length };
  }

  // ==================== HELPERS ====================

  /**
   * Verify user has access to proposal with required role
   */
  private async verifyAccess(userId: string, proposalId: string, requiredRole: CollaboratorRole) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Owner has full access
    if (proposal.userId === userId) return;

    // Check collaborator role
    const collaborator = await this.prisma.proposalCollaborator.findFirst({
      where: { proposalId, userId },
    });

    if (!collaborator) {
      throw new ForbiddenException('Access denied');
    }

    const roleHierarchy = {
      [CollaboratorRole.VIEWER]: 1,
      [CollaboratorRole.COMMENTER]: 2,
      [CollaboratorRole.EDITOR]: 3,
      [CollaboratorRole.ADMIN]: 4,
    };

    if (roleHierarchy[collaborator.role as CollaboratorRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  // Helper method to generate a unique token
  private generateToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Send collaboration invitation email
   */
  private async sendCollaboratorInvitationEmail(
    email: string,
    inviterId: string,
    proposalTitle: string,
    token: string,
    message?: string,
  ): Promise<void> {
    try {
      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        select: { firstName: true, lastName: true, email: true },
      });

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

      const inviterName = inviter
        ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
        : 'A SyncQuote user';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited to collaborate on a proposal</h2>
          <p><strong>${inviterName}</strong> has invited you to collaborate on the proposal: <strong>"${proposalTitle}"</strong></p>
          ${message ? `<p>Message: "${message}"</p>` : ''}
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Accept Invitation
          </a>
          <p>Or copy and paste this link: ${inviteUrl}</p>
          <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days.</p>
        </div>
      `;

      await this.emailService.send({
        to: email,
        subject: `${inviterName} invited you to collaborate on "${proposalTitle}"`,
        html,
      });

      this.logger.log(`Collaboration invitation sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send collaboration invitation: ${(error as Error).message}`);
      // Don't throw - invitation was created, email is just a notification
    }
  }

  /**
   * Notify mentioned users in comments
   */
  private async notifyMentionedUsers(
    mentionedUserIds: string[],
    commenterId: string,
    proposalId: string,
    content: string,
  ): Promise<void> {
    try {
      const commenter = await this.prisma.user.findUnique({
        where: { id: commenterId },
        select: { firstName: true, lastName: true, email: true },
      });

      const proposal = await this.prisma.proposal.findUnique({
        where: { id: proposalId },
        select: { title: true, slug: true },
      });

      if (!commenter || !proposal) return;

      const mentionedUsers = await this.prisma.user.findMany({
        where: { id: { in: mentionedUserIds } },
        select: { id: true, email: true, firstName: true },
      });

      const commenterName = `${commenter.firstName || ''} ${commenter.lastName || ''}`.trim() || commenter.email;
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      const proposalUrl = `${frontendUrl}/proposals/${proposalId}`;

      // Truncate content for preview
      const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;

      for (const user of mentionedUsers) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${commenterName} mentioned you in a comment</h2>
            <p>On proposal: <strong>"${proposal.title}"</strong></p>
            <blockquote style="border-left: 3px solid #4F46E5; padding-left: 16px; margin: 16px 0; color: #374151;">
              ${contentPreview}
            </blockquote>
            <a href="${proposalUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              View Comment
            </a>
          </div>
        `;

        await this.emailService.send({
          to: user.email,
          subject: `${commenterName} mentioned you in "${proposal.title}"`,
          html,
        });

        // Also create in-app notification
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'mention',
            title: `${commenterName} mentioned you`,
            message: contentPreview,
            proposalId,
          },
        });
      }

      this.logger.log(`Sent mention notifications to ${mentionedUsers.length} users`);
    } catch (error) {
      this.logger.error(`Failed to send mention notifications: ${(error as Error).message}`);
      // Don't throw - notifications are not critical
    }
  }
}
