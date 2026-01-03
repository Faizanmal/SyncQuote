import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }


  /**
   * Join a proposal room for real-time updates
   */
  @SubscribeMessage('join_proposal')
  async handleJoinProposal(client: Socket, data: { proposalId: string }) {
    client.join(`proposal:${data.proposalId}`);
    this.logger.log(`Client ${client.id} joined proposal ${data.proposalId}`);
  }

  /**
   * Leave a proposal room
   */
  @SubscribeMessage('leave_proposal')
  async handleLeaveProposal(client: Socket, data: { proposalId: string }) {
    client.leave(`proposal:${data.proposalId}`);
    this.logger.log(`Client ${client.id} left proposal ${data.proposalId}`);
  }

  /**
   * Join user's personal room for notifications
   */
  @SubscribeMessage('join_user')
  async handleJoinUser(client: Socket, data: { userId: string }) {
    client.join(`user:${data.userId}`);
    this.logger.log(`Client ${client.id} joined user room ${data.userId}`);
  }

  /**
   * Send notification to specific user
   */
  async notifyUser(userId: string, data: any) {
    this.server.to(`user:${userId}`).emit('notification', data);
    this.logger.log(`Notification sent to user ${userId}`);
  }

  /**
   * Send a specific event to a user's room
   */
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.log(`Event '${event}' sent to user ${userId}`);
  }

  /**
   * Notify when proposal is viewed
   */
  async notifyProposalViewed(proposalId: string, metadata: any) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: true },
    });

    if (!proposal) return;

    // Update proposal
    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: proposal.status === 'SENT' ? 'VIEWED' : proposal.status,
        viewCount: { increment: 1 },
        firstViewedAt: proposal.firstViewedAt || new Date(),
        lastViewedAt: new Date(),
      },
    });

    // Create activity
    await this.prisma.activity.create({
      data: {
        type: 'proposal_viewed',
        proposalId,
        userId: proposal.userId,
        metadata,
      },
    });

    // Emit real-time event to owner
    this.server.to(`user:${proposal.userId}`).emit('proposal_viewed', {
      proposalId,
      timestamp: new Date(),
    });

    // Send email notification
    if (proposal.user.email) {
      const proposalUrl = `${process.env.FRONTEND_URL}/dashboard`;
      await this.emailService.sendProposalViewedNotification(
        proposal.user.email,
        proposal.title,
        proposalUrl,
      );
    }

    this.logger.log(`Proposal ${proposalId} viewed`);
  }

  /**
   * Notify when comment is added
   */
  async notifyCommentAdded(proposalId: string, comment: any) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: true },
    });

    if (!proposal) return;

    // Emit to proposal room
    this.server.to(`proposal:${proposalId}`).emit('comment_added', comment);

    // Emit to owner
    this.server.to(`user:${proposal.userId}`).emit('new_comment', {
      proposalId,
      comment,
    });

    this.logger.log(`Comment added to proposal ${proposalId}`);
  }

  /**
   * Notify when proposal is approved
   */
  async notifyProposalApproved(proposalId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: true },
    });

    if (!proposal) return;

    // Emit to owner
    this.server.to(`user:${proposal.userId}`).emit('proposal_approved', {
      proposalId,
      timestamp: new Date(),
    });

    // Send email notification
    if (proposal.user.email) {
      const proposalUrl = `${process.env.FRONTEND_URL}/proposals/${proposalId}`;
      await this.emailService.sendProposalApprovedNotification(
        proposal.user.email,
        proposal.title,
        proposalUrl,
      );
    }

    this.logger.log(`Proposal ${proposalId} approved`);
  }

  // ==================== CO-BROWSING PRESENCE ====================

  // Track active viewers per proposal in memory
  private activeViewers: Map<string, Map<string, {
    socketId: string;
    viewerName?: string;
    viewerEmail?: string;
    scrollDepth: number;
    activeSection?: string;
    lastActivity: Date;
  }>> = new Map();

  // Lingering threshold in milliseconds (e.g., 10 seconds on a section)
  private readonly LINGER_THRESHOLD_MS = 10000;
  private sectionTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Handle viewer presence updates (scroll position, active section)
   */
  @SubscribeMessage('presence_update')
  async handlePresenceUpdate(
    client: Socket,
    data: {
      proposalId: string;
      scrollDepth: number;
      scrollPosition?: number;
      activeSection?: string;
      activeSectionId?: string;
      viewerName?: string;
      viewerEmail?: string;
    },
  ) {
    const { proposalId, scrollDepth, activeSection, activeSectionId, viewerName, viewerEmail } = data;

    // Get proposal to find owner
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { userId: true, id: true },
    });

    if (!proposal) return;

    // Update active viewers map
    if (!this.activeViewers.has(proposalId)) {
      this.activeViewers.set(proposalId, new Map());
    }
    const proposalViewers = this.activeViewers.get(proposalId)!;
    proposalViewers.set(client.id, {
      socketId: client.id,
      viewerName,
      viewerEmail,
      scrollDepth,
      activeSection,
      lastActivity: new Date(),
    });

    // Broadcast presence to proposal owner
    this.server.to(`user:${proposal.userId}`).emit('viewer_presence', {
      proposalId,
      viewers: Array.from(proposalViewers.values()),
      activeViewer: {
        socketId: client.id,
        viewerName,
        viewerEmail,
        scrollDepth,
        activeSection,
        activeSectionId,
        timestamp: new Date(),
      },
    });

    // Check for section lingering
    if (activeSectionId) {
      this.trackSectionLingering(client.id, proposalId, proposal.userId, activeSectionId, activeSection || 'Unknown Section');
    }

    this.logger.debug(`Presence update for proposal ${proposalId}: ${scrollDepth}% scroll, section: ${activeSection}`);
  }

  /**
   * Handle cursor movement for co-browsing
   */
  @SubscribeMessage('cursor_move')
  async handleCursorMove(
    client: Socket,
    data: { proposalId: string; x: number; y: number },
  ) {
    const { proposalId, x, y } = data;

    // Get proposal to find owner
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { userId: true },
    });

    if (!proposal) return;

    // Broadcast cursor position to owner
    this.server.to(`user:${proposal.userId}`).emit('viewer_cursor', {
      proposalId,
      socketId: client.id,
      x,
      y,
      timestamp: new Date(),
    });
  }

  /**
   * Track when viewer lingers on a section and notify owner
   */
  private trackSectionLingering(
    socketId: string,
    proposalId: string,
    ownerId: string,
    sectionId: string,
    sectionName: string,
  ) {
    const timerKey = `${socketId}:${proposalId}:${sectionId}`;

    // Clear existing timer for this section
    if (this.sectionTimers.has(timerKey)) {
      clearTimeout(this.sectionTimers.get(timerKey)!);
    }

    // Set new timer for linger notification
    const timer = setTimeout(() => {
      // Notify owner that viewer is lingering on this section
      this.server.to(`user:${ownerId}`).emit('section_linger', {
        proposalId,
        socketId,
        sectionId,
        sectionName,
        lingerDurationMs: this.LINGER_THRESHOLD_MS,
        message: `A viewer is spending extra time on the "${sectionName}" section`,
        timestamp: new Date(),
      });

      // Create notification in database
      this.prisma.notification.create({
        data: {
          userId: ownerId,
          type: 'section_linger',
          title: 'Client Interest Detected',
          message: `A viewer is spending extra time on the "${sectionName}" section`,
          proposalId,
          metadata: { sectionId, sectionName },
        },
      }).catch(err => this.logger.error('Failed to create linger notification', err));

      this.sectionTimers.delete(timerKey);
    }, this.LINGER_THRESHOLD_MS);

    this.sectionTimers.set(timerKey, timer);
  }

  /**
   * Clean up when client disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up active viewers
    for (const [proposalId, viewers] of this.activeViewers.entries()) {
      if (viewers.has(client.id)) {
        viewers.delete(client.id);

        // Notify owner of viewer departure
        this.prisma.proposal.findUnique({
          where: { id: proposalId },
          select: { userId: true },
        }).then(proposal => {
          if (proposal) {
            this.server.to(`user:${proposal.userId}`).emit('viewer_left', {
              proposalId,
              socketId: client.id,
              timestamp: new Date(),
            });
          }
        });
      }
    }

    // Clean up section timers
    for (const [key, timer] of this.sectionTimers.entries()) {
      if (key.startsWith(client.id)) {
        clearTimeout(timer);
        this.sectionTimers.delete(key);
      }
    }
  }
}
