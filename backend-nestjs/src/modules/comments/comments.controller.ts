import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CommentsService } from './comments.service';

@ApiTags('comments')
@Controller('proposals/:proposalId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comments for a proposal' })
  findAll(@Param('proposalId') proposalId: string) {
    return this.commentsService.findAll(proposalId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment to a proposal (public)' })
  create(@Param('proposalId') proposalId: string, @Body() data: any) {
    return this.commentsService.create(proposalId, data);
  }
}
