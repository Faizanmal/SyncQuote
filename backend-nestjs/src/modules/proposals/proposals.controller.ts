import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Res,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ProposalsService } from './proposals.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ListProposalsQueryDto } from './dto/list-proposals.dto';

@ApiTags('proposals')
@Controller('proposals')
export class ProposalsController {
  constructor(private proposalsService: ProposalsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new proposal' })
  create(@GetUser('sub') userId: string, @Body() data: any) {
    return this.proposalsService.create(userId, data);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List proposals for the current user (paginated)' })
  findAll(@GetUser('sub') userId: string, @Query() query: ListProposalsQueryDto) {
    return this.proposalsService.findAll(userId, query);
  }

  @Get('public/:slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get proposal by slug (public)' })
  findBySlug(
    @Param('slug') slug: string,
    @Query('ip') ip?: string,
    @Query('track') track?: string,
  ) {
    const shouldTrack = track !== '0' && track !== 'false';
    return this.proposalsService.findBySlug(slug, { ip }, shouldTrack);
  }

  @Post('public/:slug/approve')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Approve and sign proposal (public)' })
  approve(@Param('slug') slug: string, @Body() signatureData: any, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.proposalsService.approve(slug, {
      ...signatureData,
      ipAddress: signatureData?.ipAddress || ipAddress,
      userAgent: signatureData?.userAgent || userAgent,
    });
  }

  @Post('public/:slug/comments')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Add a comment to proposal by slug (public)' })
  addPublicComment(@Param('slug') slug: string, @Body() data: any) {
    return this.proposalsService.addPublicComment(slug, data);
  }

  @Get('public/:slug/pdf')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Download proposal PDF by slug (public)' })
  async getPublicPdf(@Param('slug') slug: string, @Res() res: any) {
    const pdfBuffer = await this.proposalsService.generatePublicPdf(slug);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}-proposal.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post(':id/send')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send proposal to client email with public link' })
  send(@Param('id') id: string, @GetUser('sub') userId: string) {
    return this.proposalsService.send(id, userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get proposal by ID or slug' })
  findOne(@Param('id') id: string, @GetUser('sub') userId: string) {
    return this.proposalsService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update proposal' })
  update(@Param('id') id: string, @GetUser('sub') userId: string, @Body() data: any) {
    return this.proposalsService.update(id, userId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete proposal' })
  delete(@Param('id') id: string, @GetUser('sub') userId: string) {
    return this.proposalsService.delete(id, userId);
  }
}
