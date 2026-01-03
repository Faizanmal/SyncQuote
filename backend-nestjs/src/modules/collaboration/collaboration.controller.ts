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
import { CollaborationService } from './collaboration.service';
import {
  AddCollaboratorDto,
  UpdateCollaboratorDto,
  CreateReviewCycleDto,
  SubmitReviewDto,
  CreateCommentDto,
  UpdateCommentDto,
  ResolveCommentDto,
  CreateSuggestionDto,
  RespondToSuggestionDto,
  SetTrackingModeDto,
  AcceptRejectChangesDto,
  SuggestionStatus,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('collaboration')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  // ==================== COLLABORATORS ====================

  @Post('collaborators')
  async addCollaborator(@Request() req: any, @Body() dto: AddCollaboratorDto) {
    return this.collaborationService.addCollaborator(req.user.id, dto);
  }

  @Put('collaborators/:id')
  async updateCollaborator(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    return this.collaborationService.updateCollaborator(req.user.id, id, dto);
  }

  @Delete('collaborators/:id')
  async removeCollaborator(@Request() req: any, @Param('id') id: string) {
    return this.collaborationService.removeCollaborator(req.user.id, id);
  }

  @Get('proposals/:proposalId/collaborators')
  async getCollaborators(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.collaborationService.getCollaborators(req.user.id, proposalId);
  }

  // ==================== REVIEW CYCLES ====================

  @Post('review-cycles')
  async createReviewCycle(@Request() req: any, @Body() dto: CreateReviewCycleDto) {
    return this.collaborationService.createReviewCycle(req.user.id, dto);
  }

  @Post('review-cycles/submit')
  async submitReview(@Request() req: any, @Body() dto: SubmitReviewDto) {
    return this.collaborationService.submitReview(req.user.id, dto);
  }

  @Get('proposals/:proposalId/review-cycles')
  async getReviewCycles(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.collaborationService.getReviewCycles(req.user.id, proposalId);
  }

  // ==================== COMMENTS ====================

  @Post('comments')
  async createComment(@Request() req: any, @Body() dto: CreateCommentDto) {
    return this.collaborationService.createComment(req.user.id, dto);
  }

  @Put('comments/:id')
  async updateComment(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.collaborationService.updateComment(req.user.id, id, dto);
  }

  @Delete('comments/:id')
  async deleteComment(@Request() req: any, @Param('id') id: string) {
    return this.collaborationService.deleteComment(req.user.id, id);
  }

  @Post('comments/:id/resolve')
  async resolveComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveCommentDto,
  ) {
    return this.collaborationService.resolveComment(req.user.id, id, dto);
  }

  @Get('proposals/:proposalId/comments')
  async getComments(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.collaborationService.getComments(req.user.id, proposalId, sectionId);
  }

  // ==================== SUGGESTIONS ====================

  @Post('suggestions')
  async createSuggestion(@Request() req: any, @Body() dto: CreateSuggestionDto) {
    return this.collaborationService.createSuggestion(req.user.id, dto);
  }

  @Post('suggestions/:id/respond')
  async respondToSuggestion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RespondToSuggestionDto,
  ) {
    return this.collaborationService.respondToSuggestion(req.user.id, id, dto);
  }

  @Get('proposals/:proposalId/suggestions')
  async getSuggestions(
    @Request() req: any,
    @Param('proposalId') proposalId: string,
    @Query('status') status?: SuggestionStatus,
  ) {
    return this.collaborationService.getSuggestions(req.user.id, proposalId, status);
  }

  // ==================== CHANGE TRACKING ====================

  @Post('tracking-mode')
  async setTrackingMode(@Request() req: any, @Body() dto: SetTrackingModeDto) {
    return this.collaborationService.setTrackingMode(req.user.id, dto);
  }

  @Get('proposals/:proposalId/changes')
  async getTrackedChanges(@Request() req: any, @Param('proposalId') proposalId: string) {
    return this.collaborationService.getTrackedChanges(req.user.id, proposalId);
  }

  @Post('changes/handle')
  async handleTrackedChanges(@Request() req: any, @Body() dto: AcceptRejectChangesDto) {
    return this.collaborationService.handleTrackedChanges(req.user.id, dto);
  }
}
