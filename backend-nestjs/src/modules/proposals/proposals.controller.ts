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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProposalsService } from './proposals.service';
import { GetUser } from '../auth/decorators/get-user.decorator';

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
  @ApiOperation({ summary: 'Get all proposals for current user' })
  findAll(@GetUser('sub') userId: string) {
    return this.proposalsService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get proposal by ID' })
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

  // Public endpoints (no auth required)
  @Get('public/:slug')
  @ApiOperation({ summary: 'Get proposal by slug (public)' })
  findBySlug(@Param('slug') slug: string, @Query('ip') ip?: string) {
    return this.proposalsService.findBySlug(slug, { ip });
  }

  @Post('public/:slug/approve')
  @ApiOperation({ summary: 'Approve and sign proposal (public)' })
  approve(@Param('slug') slug: string, @Body() signatureData: any) {
    return this.proposalsService.approve(slug, signatureData);
  }
}
