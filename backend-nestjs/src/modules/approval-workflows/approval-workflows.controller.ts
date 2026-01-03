import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApprovalWorkflowsService } from './approval-workflows.service';
import {
  CreateApprovalWorkflowDto,
  UpdateApprovalWorkflowDto,
  SubmitApprovalDto,
  ApprovalActionDto,
  DelegateApprovalDto,
  EscalateApprovalDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('approval-workflows')
@UseGuards(JwtAuthGuard)
export class ApprovalWorkflowsController {
  constructor(private readonly approvalWorkflowsService: ApprovalWorkflowsService) {}

  /**
   * Create a new approval workflow
   */
  @Post()
  async createWorkflow(@Request() req: any, @Body() dto: CreateApprovalWorkflowDto) {
    return this.approvalWorkflowsService.createWorkflow(req.user.id, dto);
  }

  /**
   * Get all workflows
   */
  @Get()
  async getWorkflows(@Request() req: any) {
    return this.approvalWorkflowsService.getWorkflows(req.user.id);
  }

  /**
   * Get a specific workflow
   */
  @Get(':id')
  async getWorkflow(@Request() req: any, @Param('id') id: string) {
    return this.approvalWorkflowsService.getWorkflow(req.user.id, id);
  }

  /**
   * Update a workflow
   */
  @Put(':id')
  async updateWorkflow(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalWorkflowDto,
  ) {
    return this.approvalWorkflowsService.updateWorkflow(req.user.id, id, dto);
  }

  /**
   * Delete a workflow
   */
  @Delete(':id')
  async deleteWorkflow(@Request() req: any, @Param('id') id: string) {
    return this.approvalWorkflowsService.deleteWorkflow(req.user.id, id);
  }

  /**
   * Submit a proposal for approval
   */
  @Post('submit')
  async submitForApproval(@Request() req: any, @Body() dto: SubmitApprovalDto) {
    return this.approvalWorkflowsService.submitForApproval(req.user.id, dto);
  }

  /**
   * Process approval action (approve/reject)
   */
  @Post('approvals/:id/action')
  async processApprovalAction(
    @Request() req: any,
    @Param('id') approvalId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.approvalWorkflowsService.processApprovalAction(req.user.id, approvalId, dto);
  }

  /**
   * Delegate approval to another user
   */
  @Post('approvals/:id/delegate')
  async delegateApproval(
    @Request() req: any,
    @Param('id') approvalId: string,
    @Body() dto: DelegateApprovalDto,
  ) {
    return this.approvalWorkflowsService.delegateApproval(req.user.id, approvalId, dto);
  }

  /**
   * Escalate approval
   */
  @Post('approvals/:id/escalate')
  async escalateApproval(
    @Request() req: any,
    @Param('id') approvalId: string,
    @Body() dto: EscalateApprovalDto,
  ) {
    return this.approvalWorkflowsService.escalateApproval(req.user.id, approvalId, dto);
  }

  /**
   * Get pending approvals for current user
   */
  @Get('approvals/pending')
  async getPendingApprovals(@Request() req: any) {
    return this.approvalWorkflowsService.getPendingApprovals(req.user.id);
  }

  /**
   * Get approval history for a proposal
   */
  @Get('proposals/:proposalId/history')
  async getApprovalHistory(@Param('proposalId') proposalId: string) {
    return this.approvalWorkflowsService.getApprovalHistory(proposalId);
  }

  /**
   * Get audit trail for an approval
   */
  @Get('approvals/:id/audit-trail')
  async getApprovalAuditTrail(@Param('id') approvalId: string) {
    return this.approvalWorkflowsService.getApprovalAuditTrail(approvalId);
  }
}
