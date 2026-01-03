import { Module } from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import { ApprovalWorkflowsController } from './approval-workflows.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [ApprovalWorkflowsController],
  providers: [ApprovalWorkflowsService],
  exports: [ApprovalWorkflowsService],
})
export class ApprovalWorkflowsModule {}
