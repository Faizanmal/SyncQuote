import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('team-invites')
export class TeamInvitesController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get(':token')
  previewInvitation(@Param('token') token: string) {
    return this.teamsService.previewInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvitation(@Req() req: any, @Param('token') token: string) {
    return this.teamsService.acceptInvitationByToken(token, req.user.sub);
  }
}
