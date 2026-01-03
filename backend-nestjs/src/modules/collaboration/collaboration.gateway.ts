import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';

interface UserPresence {
  odeName: string;
  firstName: string;
  lastName: string;
  currentSection?: string;
  cursor?: { position: number; selection?: { start: number; end: number } };
  color: string;
  lastActive: Date;
}

interface RoomUsers {
  [odeName: string]: UserPresence;
}

@WebSocketGateway({
  namespace: 'collaboration',
  cors: { origin: '*' },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private rooms: Map<string, RoomUsers> = new Map();
  private userSockets: Map<string, string> = new Map(); // odeName -> socketId

  private readonly colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
    '#84CC16',
    '#6366F1',
  ];

  async handleConnection(client: Socket) {
    // Authentication would be handled here
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    // Remove user from all rooms
    const odeName = this.getSocketUserId(client.id);
    if (odeName) {
      this.rooms.forEach((users, roomId) => {
        if (users[odeName]) {
          delete users[odeName];
          this.server.to(roomId).emit('user:left', { odeName });
        }
      });
      this.userSockets.delete(odeName);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:proposal')
  handleJoinProposal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { proposalId: string; user: { id: string; firstName: string; lastName: string } },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.join(roomId);

    // Initialize room if needed
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {});
    }

    const roomUsers = this.rooms.get(roomId)!;
    const colorIndex = Object.keys(roomUsers).length % this.colors.length;

    // Add user to room
    roomUsers[data.user.id] = {
      odeName: data.user.id,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      color: this.colors[colorIndex],
      lastActive: new Date(),
    };

    this.userSockets.set(data.user.id, client.id);

    // Notify others
    client.to(roomId).emit('user:joined', {
      user: roomUsers[data.user.id],
    });

    // Send current users to joining user
    client.emit('users:list', {
      users: Object.values(roomUsers),
    });

    return { success: true, roomId };
  }

  @SubscribeMessage('leave:proposal')
  handleLeaveProposal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; odeName: string },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.leave(roomId);

    const roomUsers = this.rooms.get(roomId);
    if (roomUsers && roomUsers[data.odeName]) {
      delete roomUsers[data.odeName];
      this.server.to(roomId).emit('user:left', { odeName: data.odeName });
    }

    return { success: true };
  }

  @SubscribeMessage('presence:update')
  handlePresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { proposalId: string; odeName: string; currentSection?: string; cursor?: any },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    const roomUsers = this.rooms.get(roomId);

    if (roomUsers && roomUsers[data.odeName]) {
      roomUsers[data.odeName].currentSection = data.currentSection;
      roomUsers[data.odeName].cursor = data.cursor;
      roomUsers[data.odeName].lastActive = new Date();

      client.to(roomId).emit('presence:updated', {
        odeName: data.odeName,
        currentSection: data.currentSection,
        cursor: data.cursor,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('content:change')
  handleContentChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      proposalId: string;
      odeName: string;
      sectionId: string;
      changes: any; // Delta or operational transform
      version: number;
    },
  ) {
    const roomId = `proposal:${data.proposalId}`;

    // Broadcast change to other users in room
    client.to(roomId).emit('content:changed', {
      odeName: data.odeName,
      sectionId: data.sectionId,
      changes: data.changes,
      version: data.version,
    });

    return { success: true, version: data.version };
  }

  @SubscribeMessage('comment:created')
  handleCommentCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; comment: any },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('comment:new', data.comment);
    return { success: true };
  }

  @SubscribeMessage('comment:resolved')
  handleCommentResolved(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; commentId: string; resolved: boolean },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('comment:resolution', {
      commentId: data.commentId,
      resolved: data.resolved,
    });
    return { success: true };
  }

  @SubscribeMessage('suggestion:created')
  handleSuggestionCreated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; suggestion: any },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('suggestion:new', data.suggestion);
    return { success: true };
  }

  @SubscribeMessage('suggestion:responded')
  handleSuggestionResponded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; suggestionId: string; status: string },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('suggestion:response', {
      suggestionId: data.suggestionId,
      status: data.status,
    });
    return { success: true };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; odeName: string; sectionId: string },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('user:typing', {
      odeName: data.odeName,
      sectionId: data.sectionId,
      isTyping: true,
    });
    return { success: true };
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { proposalId: string; odeName: string; sectionId: string },
  ) {
    const roomId = `proposal:${data.proposalId}`;
    client.to(roomId).emit('user:typing', {
      odeName: data.odeName,
      sectionId: data.sectionId,
      isTyping: false,
    });
    return { success: true };
  }

  private getSocketUserId(socketId: string): string | undefined {
    for (const [odeName, sid] of this.userSockets.entries()) {
      if (sid === socketId) return odeName;
    }
    return undefined;
  }

  // Utility to broadcast to specific proposal
  broadcastToProposal(proposalId: string, event: string, data: any) {
    this.server.to(`proposal:${proposalId}`).emit(event, data);
  }
}
