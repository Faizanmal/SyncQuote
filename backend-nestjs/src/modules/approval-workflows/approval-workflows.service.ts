import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateApprovalWorkflowDto,
  UpdateApprovalWorkflowDto,
  SubmitApprovalDto,
  ApprovalActionDto,
  DelegateApprovalDto,
  EscalateApprovalDto,
  ApprovalStatus,
  ApprovalConditionType,
  EscalationAction,
} from './dto';

interface ApprovalStep {
  order: number;
  name: string;
  description?: string;
  approverIds: string[];
  requireAllApprovers?: boolean;
  requiredApprovals?: number;
  timeoutHours?: number;
  escalationAction?: EscalationAction;
  escalationToUserId?: string;
  conditions?: any[];
}

interface ApprovalRecord {
  stepId: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  timestamp: string;
  delegatedFrom?: string;
  conditions?: string[];
}

interface ProposalApproval {
  id: string;
  proposalId: string;
  workflowId: string;
  currentStepOrder: number;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt: string;
  notes?: string;
  approvalRecords: ApprovalRecord[];
  completedAt?: string;
}

@Injectable()
export class ApprovalWorkflowsService {
  private readonly logger = new Logger(ApprovalWorkflowsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  /**
   * Create a new approval workflow
   */
  async createWorkflow(userId: string, dto: CreateApprovalWorkflowDto) {
    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.approvalWorkflow.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault || false,
        steps: dto.steps as any,
        triggerConditions: dto.triggerConditions as any,
        minProposalValue: dto.minProposalValue,
        maxProposalValue: dto.maxProposalValue,
      } as any,
    });

    return workflow;
  }

  /**
   * Get all workflows for a user/team
   */
  async getWorkflows(userId: string) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return workflows;
  }

  /**
   * Get a specific workflow
   */
  async getWorkflow(userId: string, workflowId: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, userId },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(userId: string, workflowId: string, dto: UpdateApprovalWorkflowDto) {
    const workflow = await this.getWorkflow(userId, workflowId);

    // If setting as default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.approvalWorkflow.updateMany({
        where: { userId, isDefault: true, id: { not: workflowId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
        steps: dto.steps as any,
        triggerConditions: dto.triggerConditions as any,
      },
    });

    return updated;
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(userId: string, workflowId: string) {
    await this.getWorkflow(userId, workflowId);

    // Check if workflow is in use
    const activeApprovals = await this.prisma.proposalApproval.count({
      where: { workflowId, status: ApprovalStatus.PENDING },
    });

    if (activeApprovals > 0) {
      throw new ConflictException('Cannot delete workflow with pending approvals');
    }

    await this.prisma.approvalWorkflow.delete({
      where: { id: workflowId },
    });

    return { success: true };
  }

  /**
   * Submit a proposal for approval
   */
  async submitForApproval(userId: string, dto: SubmitApprovalDto) {
    // Get the proposal
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: dto.proposalId, userId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check if already pending approval
    const existingApproval = await this.prisma.proposalApproval.findFirst({
      where: { proposalId: dto.proposalId, status: ApprovalStatus.PENDING },
    });

    if (existingApproval) {
      throw new ConflictException('Proposal already pending approval');
    }

    // Get the appropriate workflow
    let workflow;
    if (dto.workflowId) {
      workflow = await this.getWorkflow(userId, dto.workflowId);
    } else {
      // Find matching workflow based on conditions or use default
      workflow = await this.findMatchingWorkflow(userId, proposal);
    }

    if (!workflow) {
      throw new BadRequestException('No approval workflow configured');
    }

    // Create the approval request
    const approval = await this.prisma.proposalApproval.create({
      data: {
        proposalId: dto.proposalId,
        workflowId: workflow.id,
        submittedBy: userId,
        notes: dto.notes,
        currentStepOrder: 1,
        status: ApprovalStatus.PENDING,
        approvalRecords: [],
      },
    });

    // Update proposal status
    await this.prisma.proposal.update({
      where: { id: dto.proposalId },
      data: { approvalRequired: true },
    });

    // Notify approvers for the first step
    const steps = workflow.steps as unknown as ApprovalStep[];
    const firstStep = steps.find((s) => s.order === 1);
    if (firstStep) {
      await this.notifyApprovers(approval.id, firstStep);
    }

    // Log the submission
    await this.logApprovalAction(approval.id, userId, 'SUBMITTED', dto.notes);

    return approval;
  }

  /**
   * Process an approval action (approve/reject)
   */
  async processApprovalAction(userId: string, approvalId: string, dto: ApprovalActionDto) {
    const approval = await this.prisma.proposalApproval.findUnique({
      where: { id: approvalId },
      include: { workflow: true },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval request is not pending');
    }

    const steps = approval.workflow.steps as unknown as ApprovalStep[];
    const currentStep = steps.find((s) => s.order === approval.currentStepOrder);

    if (!currentStep) {
      throw new BadRequestException('Invalid workflow step');
    }

    // Check if user is authorized to approve this step
    const isAuthorized = await this.isAuthorizedApprover(userId, approval, currentStep);
    if (!isAuthorized) {
      throw new ForbiddenException('Not authorized to approve this request');
    }

    // Record the approval action
    const record: ApprovalRecord = {
      stepId: `step-${currentStep.order}`,
      approverId: userId,
      status: dto.action,
      comment: dto.comment,
      timestamp: new Date().toISOString(),
      conditions: dto.conditions,
    };

    const existingRecords = (approval.approvalRecords as unknown as ApprovalRecord[]) || [];
    const updatedRecords = [...existingRecords, record];

    // Check if step requirements are met
    const stepComplete = this.isStepComplete(currentStep, updatedRecords);

    if (dto.action === ApprovalStatus.REJECTED) {
      // Rejection at any step fails the entire approval
      await this.prisma.proposalApproval.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.REJECTED,
          approvalRecords: updatedRecords as any,
          completedAt: new Date(),
        },
      });

      await this.logApprovalAction(approvalId, userId, 'REJECTED', dto.comment);
      await this.notifyRejection(approval);

      return { status: ApprovalStatus.REJECTED };
    }

    if (stepComplete) {
      // Check if there are more steps
      const nextStep = steps.find((s) => s.order === currentStep.order + 1);

      if (nextStep) {
        // Move to next step
        await this.prisma.proposalApproval.update({
          where: { id: approvalId },
          data: {
            currentStepOrder: nextStep.order,
            approvalRecords: updatedRecords as any,
          },
        });

        await this.notifyApprovers(approvalId, nextStep);
        await this.logApprovalAction(approvalId, userId, 'STEP_APPROVED', dto.comment);

        return { status: ApprovalStatus.PENDING, currentStep: nextStep.order };
      } else {
        // All steps complete - fully approved
        await this.prisma.proposalApproval.update({
          where: { id: approvalId },
          data: {
            status: ApprovalStatus.APPROVED,
            approvalRecords: updatedRecords as any,
            completedAt: new Date(),
          },
        });

        // Update proposal
        await this.prisma.proposal.update({
          where: { id: approval.proposalId },
          data: { approvedAt: new Date() },
        });

        await this.logApprovalAction(approvalId, userId, 'APPROVED', dto.comment);
        await this.notifyApprovalComplete(approval);

        return { status: ApprovalStatus.APPROVED };
      }
    } else {
      // Step not yet complete, waiting for more approvals
      await this.prisma.proposalApproval.update({
        where: { id: approvalId },
        data: { approvalRecords: updatedRecords as any },
      });

      await this.logApprovalAction(approvalId, userId, 'PARTIAL_APPROVAL', dto.comment);

      return { status: ApprovalStatus.PENDING, waitingForMoreApprovals: true };
    }
  }

  /**
   * Delegate approval to another user
   */
  async delegateApproval(userId: string, approvalId: string, dto: DelegateApprovalDto) {
    const approval = await this.prisma.proposalApproval.findUnique({
      where: { id: approvalId },
      include: { workflow: true },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval request is not pending');
    }

    // Verify user is current approver
    const steps = approval.workflow.steps as unknown as ApprovalStep[];
    const currentStep = steps.find((s) => s.order === approval.currentStepOrder);

    if (!currentStep?.approverIds.includes(userId)) {
      throw new ForbiddenException('Not authorized to delegate this approval');
    }

    // Create delegation record
    const delegation = await this.prisma.approvalDelegation.create({
      data: {
        approvalId,
        delegatedBy: userId,
        delegatedTo: dto.delegateToUserId,
        expiresAt: dto.expiresInHours
          ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
          : null,
      } as any,
    });

    await this.logApprovalAction(
      approvalId,
      userId,
      'DELEGATED',
      `Delegated to ${dto.delegateToUserId}: ${dto.reason}`,
    );

    // Notify the delegate
    await this.notifyDelegation(approval, userId, dto.delegateToUserId);

    return delegation;
  }

  /**
   * Escalate approval to a higher authority
   */
  async escalateApproval(userId: string, approvalId: string, dto: EscalateApprovalDto) {
    const approval = await this.prisma.proposalApproval.findUnique({
      where: { id: approvalId },
      include: { workflow: true },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }

    // Create escalation record
    await this.prisma.approvalEscalation.create({
      data: {
        approvalId,
        escalatedBy: userId,
        escalatedTo: dto.escalateToUserId,
        reason: dto.reason,
      },
    });

    // Update approval status
    await this.prisma.proposalApproval.update({
      where: { id: approvalId },
      data: { status: ApprovalStatus.ESCALATED },
    });

    await this.logApprovalAction(approvalId, userId, 'ESCALATED', dto.reason);

    // Notify the escalation target
    await this.notifyEscalation(approval, dto.escalateToUserId, dto.reason);

    return { success: true };
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string) {
    // Get direct assignments
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { userId },
    });

    const pendingApprovals = await this.prisma.proposalApproval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        OR: [
          { workflow: { userId } },
          { delegations: { some: { delegatedTo: userId, isActive: true } } },
        ],
      },
      include: {
        proposal: true,
        workflow: true,
        delegations: {
          where: { delegatedTo: userId, isActive: true },
        },
      } as any,
      orderBy: { submittedAt: 'desc' },
    });

    // Filter to only show approvals where user is in current step
    return pendingApprovals.filter((approval) => {
      // Cast the workflow to any to access steps property
      const workflow = approval.workflow as any;
      const steps = workflow.steps as unknown as ApprovalStep[];
      const currentStep = steps.find((s) => s.order === approval.currentStepOrder);

      if (currentStep?.approverIds.includes(userId)) return true;
      if ((approval as any).delegations.length > 0) return true;

      return false;
    });
  }

  /**
   * Get approval history for a proposal
   */
  async getApprovalHistory(proposalId: string) {
    const approvals = await this.prisma.proposalApproval.findMany({
      where: { proposalId },
      include: {
        workflow: true,
        delegations: true,
        escalations: true,
      } as any,
      orderBy: { submittedAt: 'desc' },
    });

    return approvals;
  }

  /**
   * Get detailed audit trail for an approval
   */
  async getApprovalAuditTrail(approvalId: string) {
    const logs = await this.prisma.approvalAuditLog.findMany({
      where: { approvalId },
      orderBy: { createdAt: 'asc' },
    });

    return logs;
  }

  /**
   * Process timeout escalations
   */
  async processTimeoutEscalations() {
    const pendingApprovals = await this.prisma.proposalApproval.findMany({
      where: { status: ApprovalStatus.PENDING },
      include: { workflow: true },
    });

    for (const approval of pendingApprovals) {
      const steps = approval.workflow.steps as unknown as ApprovalStep[];
      const currentStep = steps.find((s) => s.order === approval.currentStepOrder);

      if (!currentStep?.timeoutHours) continue;

      const stepStartTime = this.getStepStartTime(approval);
      const timeoutTime = new Date(
        stepStartTime.getTime() + currentStep.timeoutHours * 60 * 60 * 1000,
      );

      if (new Date() > timeoutTime) {
        await this.handleStepTimeout(approval, currentStep);
      }
    }
  }

  // Private helper methods

  private async findMatchingWorkflow(userId: string, proposal: any) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { userId, isActive: true },
      orderBy: { isDefault: 'desc' },
    });

    // Check conditions for each workflow
    for (const workflow of workflows) {
      if (this.matchesConditions(workflow, proposal)) {
        return workflow;
      }
    }

    // Return default if no conditions match
    return workflows.find((w) => w.isDefault);
  }

  private matchesConditions(workflow: any, proposal: any): boolean {
    const conditions = workflow.triggerConditions as any[];
    if (!conditions || conditions.length === 0) return true;

    // Check value-based conditions
    if (workflow.minProposalValue && proposal.estimatedValue < workflow.minProposalValue) {
      return false;
    }
    if (workflow.maxProposalValue && proposal.estimatedValue > workflow.maxProposalValue) {
      return false;
    }

    // Check other conditions
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, proposal)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: any, proposal: any): boolean {
    switch (condition.type) {
      case ApprovalConditionType.PROPOSAL_VALUE_ABOVE:
        return proposal.estimatedValue >= condition.value;
      case ApprovalConditionType.PROPOSAL_VALUE_BELOW:
        return proposal.estimatedValue <= condition.value;
      case ApprovalConditionType.PROPOSAL_VALUE_BETWEEN:
        return (
          proposal.estimatedValue >= condition.minValue &&
          proposal.estimatedValue <= condition.maxValue
        );
      default:
        return true;
    }
  }

  private async isAuthorizedApprover(
    userId: string,
    approval: any,
    step: ApprovalStep,
  ): Promise<boolean> {
    // Direct assignment
    if (step.approverIds.includes(userId)) return true;

    // Delegation
    const delegation = await this.prisma.approvalDelegation.findFirst({
      where: {
        approvalId: approval.id,
        delegatedTo: userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    return !!delegation;
  }

  private isStepComplete(step: ApprovalStep, records: ApprovalRecord[]): boolean {
    const stepRecords = records.filter(
      (r) => r.stepId === `step-${step.order}` && r.status === ApprovalStatus.APPROVED,
    );

    if (step.requireAllApprovers) {
      return stepRecords.length >= step.approverIds.length;
    }

    const requiredApprovals = step.requiredApprovals || 1;
    return stepRecords.length >= requiredApprovals;
  }

  private getStepStartTime(approval: any): Date {
    const records = approval.approvalRecords as ApprovalRecord[];
    if (!records || records.length === 0) {
      return new Date(approval.submittedAt);
    }

    const lastRecord = records[records.length - 1];
    return new Date(lastRecord.timestamp);
  }

  private async handleStepTimeout(approval: any, step: ApprovalStep) {
    switch (step.escalationAction) {
      case EscalationAction.NOTIFY:
        await this.notifyTimeout(approval, step);
        break;
      case EscalationAction.REASSIGN:
        if (step.escalationToUserId) {
          await this.escalateApproval('system', approval.id, {
            escalateToUserId: step.escalationToUserId,
            reason: 'Automatic escalation due to timeout',
          });
        }
        break;
      case EscalationAction.AUTO_APPROVE:
        await this.processApprovalAction('system', approval.id, {
          action: ApprovalStatus.APPROVED,
          comment: 'Auto-approved due to timeout',
        });
        break;
      case EscalationAction.AUTO_REJECT:
        await this.processApprovalAction('system', approval.id, {
          action: ApprovalStatus.REJECTED,
          comment: 'Auto-rejected due to timeout',
        });
        break;
    }
  }

  private async logApprovalAction(
    approvalId: string,
    userId: string,
    action: string,
    details?: string,
  ) {
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalId,
        // userId,
        action,
        details,
      } as any,
    });
  }

  private async notifyApprovers(approvalId: string, step: ApprovalStep) {
    this.logger.log(`Notifying approvers for step ${step.order}: ${step.approverIds.join(', ')}`);

    try {
      const approvers = await this.prisma.user.findMany({
        where: { id: { in: step.approverIds } },
        select: { id: true, email: true, firstName: true },
      });

      for (const approver of approvers) {
        await this.prisma.notification.create({
          data: {
            userId: approver.id,
            type: 'approval_request',
            title: 'Approval Required',
            message: `You have a proposal pending your approval (Step ${step.order}: ${step.name})`,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify approvers: ${error.message}`);
    }
  }

  private async notifyRejection(approval: any) {
    this.logger.log(`Notifying rejection for approval ${approval.id}`);

    try {
      await this.prisma.notification.create({
        data: {
          userId: approval.submittedBy,
          type: 'approval_rejected',
          title: 'Proposal Rejected',
          message: `Your proposal approval request has been rejected.`,
          proposalId: approval.proposalId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify rejection: ${error.message}`);
    }
  }

  private async notifyApprovalComplete(approval: any) {
    this.logger.log(`Notifying approval complete for ${approval.id}`);

    try {
      await this.prisma.notification.create({
        data: {
          userId: approval.submittedBy,
          type: 'approval_complete',
          title: 'Proposal Approved',
          message: `Your proposal has been fully approved!`,
          proposalId: approval.proposalId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify approval complete: ${error.message}`);
    }
  }

  private async notifyDelegation(approval: any, from: string, to: string) {
    this.logger.log(`Notifying delegation from ${from} to ${to}`);

    try {
      await this.prisma.notification.create({
        data: {
          userId: to,
          type: 'approval_delegated',
          title: 'Approval Delegated to You',
          message: `An approval request has been delegated to you.`,
          proposalId: approval.proposalId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify delegation: ${error.message}`);
    }
  }

  private async notifyEscalation(approval: any, to: string, reason: string) {
    this.logger.log(`Notifying escalation to ${to}: ${reason}`);

    try {
      await this.prisma.notification.create({
        data: {
          userId: to,
          type: 'approval_escalated',
          title: 'Approval Escalated',
          message: `An approval has been escalated to you: ${reason}`,
          proposalId: approval.proposalId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to notify escalation: ${error.message}`);
    }
  }

  private async notifyTimeout(approval: any, step: ApprovalStep) {
    this.logger.log(`Notifying timeout for approval ${approval.id} step ${step.order}`);

    try {
      const approvers = await this.prisma.user.findMany({
        where: { id: { in: step.approverIds } },
      });

      for (const approver of approvers) {
        await this.prisma.notification.create({
          data: {
            userId: approver.id,
            type: 'approval_timeout',
            title: 'Approval Timeout Warning',
            message: `The approval request for step ${step.order} has timed out.`,
            proposalId: approval.proposalId,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify timeout: ${error.message}`);
    }
  }
}
