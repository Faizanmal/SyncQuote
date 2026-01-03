import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import {
  TeamsService,
  CreateTeamDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  TeamPermissions,
} from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(@Req() req: any, @Body() data: CreateTeamDto) {
    return this.teamsService.createTeam(req.user.sub, data);
  }

  @Get()
  async getTeams(@Req() req: any) {
    return this.teamsService.getTeams(req.user.sub);
  }

  @Get(':teamId')
  async getTeam(@Req() req: any, @Param('teamId') teamId: string) {
    return this.teamsService.getTeam(teamId, req.user.sub);
  }

  @Put(':teamId')
  async updateTeam(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Body() data: { name?: string; settings?: any },
  ) {
    return this.teamsService.updateTeam(teamId, req.user.sub, data);
  }

  @Delete(':teamId')
  async deleteTeam(@Req() req: any, @Param('teamId') teamId: string) {
    return this.teamsService.deleteTeam(teamId, req.user.sub);
  }

  @Get(':teamId/members')
  async getMembers(@Req() req: any, @Param('teamId') teamId: string) {
    return this.teamsService.getMembers(teamId, req.user.sub);
  }

  @Post(':teamId/members')
  async inviteMember(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Body() data: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(teamId, req.user.sub, data);
  }

  @Put(':teamId/members/:memberId/role')
  async updateMemberRole(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() data: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(teamId, memberId, req.user.sub, data);
  }

  @Put(':teamId/members/:memberId/permissions')
  async updateMemberPermissions(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body() permissions: Partial<TeamPermissions>,
  ) {
    return this.teamsService.updateMemberPermissions(teamId, memberId, req.user.sub, permissions);
  }

  @Delete(':teamId/members/:memberId')
  async removeMember(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.removeMember(teamId, memberId, req.user.sub);
  }

  @Post(':teamId/leave')
  async leaveTeam(@Req() req: any, @Param('teamId') teamId: string) {
    return this.teamsService.leaveTeam(teamId, req.user.sub);
  }

  @Post(':teamId/transfer-ownership')
  async transferOwnership(
    @Req() req: any,
    @Param('teamId') teamId: string,
    @Body() data: { newOwnerId: string },
  ) {
    return this.teamsService.transferOwnership(teamId, req.user.sub, data.newOwnerId);
  }

  @Get(':teamId/stats')
  async getTeamStats(@Req() req: any, @Param('teamId') teamId: string) {
    return this.teamsService.getTeamStats(teamId, req.user.sub);
  }
}
