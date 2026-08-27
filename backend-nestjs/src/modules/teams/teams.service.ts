import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { nanoid } from 'nanoid';

export { TeamRole };

export interface CreateTeamDto {
  name: string;
}

export interface InviteMemberDto {
  email: string;
  role?: TeamRole;
  message?: string;
}

export interface UpdateMemberRoleDto {
  role: TeamRole;
}

export interface TeamPermissions {
  canCreateProposals: boolean;
  canEditProposals: boolean;
  canDeleteProposals: boolean;
  canSendProposals: boolean;
  canViewAnalytics: boolean;
  canManageTemplates: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  [key: string]: boolean; // Index signature for Prisma JSON compatibility
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Get default permissions for a role
  getDefaultPermissions(role: TeamRole): TeamPermissions {
    switch (role) {
      case TeamRole.OWNER:
        return {
          canCreateProposals: true,
          canEditProposals: true,
          canDeleteProposals: true,
          canSendProposals: true,
          canViewAnalytics: true,
          canManageTemplates: true,
          canManageTeam: true,
          canManageBilling: true,
        };
      case TeamRole.ADMIN:
        return {
          canCreateProposals: true,
          canEditProposals: true,
          canDeleteProposals: true,
          canSendProposals: true,
          canViewAnalytics: true,
          canManageTemplates: true,
          canManageTeam: true,
          canManageBilling: false,
        };
      case TeamRole.MEMBER:
        return {
          canCreateProposals: true,
          canEditProposals: true,
          canDeleteProposals: false,
          canSendProposals: true,
          canViewAnalytics: true,
          canManageTemplates: false,
          canManageTeam: false,
          canManageBilling: false,
        };
      case TeamRole.VIEWER:
        return {
          canCreateProposals: false,
          canEditProposals: false,
          canDeleteProposals: false,
          canSendProposals: false,
          canViewAnalytics: true,
          canManageTemplates: false,
          canManageTeam: false,
          canManageBilling: false,
        };
    }
  }

  async createTeam(ownerId: string, data: CreateTeamDto) {
    const slug = nanoid(10).toLowerCase();

    const team = await this.prisma.team.create({
      data: {
        name: data.name,
        slug,
        ownerId,
        settings: {},
      },
    });

    // Add owner as a member
    await this.prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: ownerId,
        role: TeamRole.OWNER,
        permissions: this.getDefaultPermissions(TeamRole.OWNER),
      },
    });

    return team;
  }

  async getTeams(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: {
                // Note: We'd need to add a user relation to TeamMember
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.team,
      role: m.role,
      permissions: m.permissions,
    }));
  }

  async getTeam(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this team');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return {
      ...team,
      currentUserRole: membership.role,
      currentUserPermissions: membership.permissions,
    };
  }

  async updateTeam(teamId: string, userId: string, data: { name?: string; settings?: any }) {
    await this.verifyPermission(teamId, userId, 'canManageTeam');

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.settings && { settings: data.settings }),
      },
    });
  }

  async deleteTeam(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete the team');
    }

    // Delete all members first
    await this.prisma.teamMember.deleteMany({ where: { teamId } });

    return this.prisma.team.delete({ where: { id: teamId } });
  }

  async getMembers(teamId: string, userId: string) {
    await this.verifyMembership(teamId, userId);

    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            companyLogo: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async inviteMember(teamId: string, inviterId: string, data: InviteMemberDto) {
    await this.verifyPermission(teamId, inviterId, 'canManageTeam');

    const email = data.email.trim().toLowerCase();
    const role = data.role || TeamRole.MEMBER;

    if (role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot invite someone as owner');
    }

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } });
    const inviterName = inviter?.name || inviter?.email || 'A teammate';

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const existingMember = await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId, userId: user.id },
        },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this team');
      }

      const member = await this.prisma.teamMember.create({
        data: {
          teamId,
          userId: user.id,
          role,
          permissions: this.getDefaultPermissions(role),
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, companyLogo: true, lastLoginAt: true },
          },
        },
      });

      await this.prisma.teamInvitation.updateMany({
        where: { teamId, email, status: 'pending' },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      try {
        await this.emailService.sendTeamAddedEmail(email, team.name, inviterName);
      } catch (error) {
        this.logger.error(`Failed to send team-added email: ${(error as Error).message}`);
      }

      return { type: 'member' as const, member };
    }

    const invitation = await this.upsertPendingInvitation(
      teamId,
      inviterId,
      email,
      role,
      data.message,
    );

    try {
      await this.emailService.sendTeamInvitationEmail(
        email,
        team.name,
        inviterName,
        invitation.token,
        data.message,
      );
    } catch (error) {
      this.logger.error(`Failed to send team invitation email: ${(error as Error).message}`);
    }

    return {
      type: 'invitation' as const,
      invitation: this.serializeInvitation(invitation, inviterName),
    };
  }

  async getInvitations(teamId: string, userId: string) {
    await this.verifyMembership(teamId, userId);

    const invitations = await this.prisma.teamInvitation.findMany({
      where: { teamId, status: { in: ['pending', 'expired'] } },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((invite) => {
      const expired = invite.expiresAt < new Date();
      return this.serializeInvitation(
        expired && invite.status === 'pending' ? { ...invite, status: 'expired' } : invite,
        invite.invitedBy.name || invite.invitedBy.email,
      );
    });
  }

  async cancelInvitation(teamId: string, invitationId: string, userId: string) {
    await this.verifyPermission(teamId, userId, 'canManageTeam');

    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, teamId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
    });
  }

  async resendInvitation(teamId: string, invitationId: string, userId: string) {
    await this.verifyPermission(teamId, userId, 'canManageTeam');

    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, teamId },
      include: {
        team: true,
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation || invitation.status === 'accepted') {
      throw new NotFoundException('Invitation not found');
    }

    const updated = await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: {
        token: nanoid(32),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const inviterName = invitation.invitedBy.name || invitation.invitedBy.email;
    try {
      await this.emailService.sendTeamInvitationEmail(
        invitation.email,
        invitation.team.name,
        inviterName,
        updated.token,
        invitation.message || undefined,
      );
    } catch (error) {
      this.logger.error(`Failed to resend invitation email: ${(error as Error).message}`);
    }

    return this.serializeInvitation(updated, inviterName);
  }

  async previewInvitation(token: string) {
    const invitation = await this.findUsableInvitation(token);

    return {
      teamName: invitation.team.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviterName: invitation.invitedBy.name || invitation.invitedBy.email,
    };
  }

  async acceptInvitationByToken(token: string, userId: string) {
    const invitation = await this.findUsableInvitation(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    return this.acceptInvitationRecord(invitation, user.id);
  }

  async acceptPendingInvitationsForEmail(email: string, userId: string) {
    const invitations = await this.prisma.teamInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
    });

    const accepted = [];
    for (const invitation of invitations) {
      try {
        accepted.push(await this.acceptInvitationRecord(invitation, userId));
      } catch (error) {
        this.logger.warn(`Skipped pending invite ${invitation.id}: ${(error as Error).message}`);
      }
    }
    return accepted;
  }

  private async findUsableInvitation(token: string) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { token },
      include: {
        team: true,
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation || invitation.status === 'cancelled') {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === 'accepted') {
      throw new BadRequestException('Invitation already accepted');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }

  private async acceptInvitationRecord(
    invitation: { id: string; teamId: string; role: TeamRole; email: string },
    userId: string,
  ) {
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: invitation.teamId, userId },
      },
    });

    const member =
      existingMember ||
      (await this.prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          role: invitation.role,
          permissions: this.getDefaultPermissions(invitation.role),
        },
      }));

    await this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    return member;
  }

  private async upsertPendingInvitation(
    teamId: string,
    invitedById: string,
    email: string,
    role: TeamRole,
    message?: string,
  ) {
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.teamInvitation.upsert({
      where: { teamId_email: { teamId, email } },
      create: {
        teamId,
        email,
        role,
        message,
        token,
        invitedById,
        status: 'pending',
        expiresAt,
      },
      update: {
        role,
        message,
        token,
        invitedById,
        status: 'pending',
        expiresAt,
        acceptedAt: null,
      },
    });
  }

  private serializeInvitation(
    invitation: {
      id: string;
      email: string;
      role: TeamRole;
      status: string;
      token: string;
      expiresAt: Date;
      createdAt: Date;
    },
    invitedBy: string,
  ) {
    const expired = invitation.expiresAt < new Date();
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role.toLowerCase(),
      status: expired ? 'expired' : invitation.status,
      invitedBy,
      invitedAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      token: invitation.token,
    };
  }

  async updateMemberRole(
    teamId: string,
    memberId: string,
    updaterId: string,
    data: UpdateMemberRoleDto,
  ) {
    await this.verifyPermission(teamId, updaterId, 'canManageTeam');

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Member not found');
    }

    // Can't change owner's role
    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot change owner role');
    }

    // Can't promote to owner
    if (data.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot promote to owner');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        role: data.role,
        permissions: this.getDefaultPermissions(data.role),
      },
    });
  }

  async updateMemberPermissions(
    teamId: string,
    memberId: string,
    updaterId: string,
    permissions: Partial<TeamPermissions>,
  ) {
    await this.verifyPermission(teamId, updaterId, 'canManageTeam');

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Member not found');
    }

    const currentPermissions = member.permissions as unknown as TeamPermissions;

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        permissions: {
          ...currentPermissions,
          ...permissions,
        },
      },
    });
  }

  async removeMember(teamId: string, memberId: string, removerId: string) {
    await this.verifyPermission(teamId, removerId, 'canManageTeam');

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.teamId !== teamId) {
      throw new NotFoundException('Member not found');
    }

    // Can't remove owner
    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException('Cannot remove the owner');
    }

    return this.prisma.teamMember.delete({ where: { id: memberId } });
  }

  async leaveTeam(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new NotFoundException('Not a member of this team');
    }

    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException('Owner cannot leave the team. Transfer ownership first.');
    }

    return this.prisma.teamMember.delete({ where: { id: member.id } });
  }

  async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team || team.ownerId !== currentOwnerId) {
      throw new ForbiddenException('Only the owner can transfer ownership');
    }

    const newOwnerMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: newOwnerId },
      },
    });

    if (!newOwnerMember) {
      throw new NotFoundException('New owner must be a team member');
    }

    // Update team owner
    await this.prisma.team.update({
      where: { id: teamId },
      data: { ownerId: newOwnerId },
    });

    // Update member roles
    await this.prisma.teamMember.update({
      where: { id: newOwnerMember.id },
      data: {
        role: TeamRole.OWNER,
        permissions: this.getDefaultPermissions(TeamRole.OWNER),
      },
    });

    const currentOwnerMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: currentOwnerId },
      },
    });

    if (currentOwnerMember) {
      await this.prisma.teamMember.update({
        where: { id: currentOwnerMember.id },
        data: {
          role: TeamRole.ADMIN,
          permissions: this.getDefaultPermissions(TeamRole.ADMIN),
        },
      });
    }

    return { success: true };
  }

  // Helper methods
  private async verifyMembership(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this team');
    }

    return member;
  }

  private async verifyPermission(
    teamId: string,
    userId: string,
    permission: keyof TeamPermissions,
  ) {
    const member = await this.verifyMembership(teamId, userId);
    const permissions = member.permissions as unknown as TeamPermissions;

    if (!permissions || !permissions[permission]) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }

    return member;
  }

  async checkPermission(
    teamId: string,
    userId: string,
    permission: keyof TeamPermissions,
  ): Promise<boolean> {
    try {
      await this.verifyPermission(teamId, userId, permission);
      return true;
    } catch {
      return false;
    }
  }

  // Get team stats for dashboard
  async getTeamStats(teamId: string, userId: string) {
    await this.verifyMembership(teamId, userId);

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
    });

    const totalProposalsSent = members.reduce((sum, m) => sum + m.proposalsSent, 0);
    const totalProposalsWon = members.reduce((sum, m) => sum + m.proposalsWon, 0);
    const totalRevenue = members.reduce((sum, m) => sum + m.totalRevenue, 0);

    return {
      memberCount: members.length,
      totalProposalsSent,
      totalProposalsWon,
      totalRevenue,
      avgWinRate: totalProposalsSent > 0 ? (totalProposalsWon / totalProposalsSent) * 100 : 0,
    };
  }
}
