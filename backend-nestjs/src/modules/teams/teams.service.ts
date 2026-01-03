import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface CreateTeamDto {
  name: string;
}

export interface InviteMemberDto {
  email: string;
  role?: TeamRole;
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
  constructor(private prisma: PrismaService) {}

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
      orderBy: { joinedAt: 'asc' },
    });
  }

  async inviteMember(teamId: string, inviterId: string, data: InviteMemberDto) {
    await this.verifyPermission(teamId, inviterId, 'canManageTeam');

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // In production, you'd send an invitation email
      throw new NotFoundException('User not found. Please ask them to sign up first.');
    }

    // Check if already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId: user.id },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this team');
    }

    const role = data.role || TeamRole.MEMBER;

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role,
        permissions: this.getDefaultPermissions(role),
      },
    });
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
