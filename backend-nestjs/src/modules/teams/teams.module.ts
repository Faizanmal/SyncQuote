import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamInvitesController } from './team-invites.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TeamsController, TeamInvitesController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
