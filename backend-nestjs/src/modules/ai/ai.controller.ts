import { Controller, Post, Get, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
export class AIController {
  constructor(private aiService: AIService) { }

  @Post('generate')
  async generateContent(
    @Body()
    data: {
      contentType: 'scope' | 'terms' | 'pricing' | 'introduction' | 'conclusion';
      context: {
        industry?: string;
        serviceType?: string;
        clientName?: string;
        projectDescription?: string;
        budget?: number;
        timeline?: string;
        additionalNotes?: string;
      };
      userId?: string;
      proposalId?: string;
    },
  ) {
    return this.aiService.generateContent(data);
  }

  @Post('improve')
  async improveContent(
    @Body()
    data: {
      content: string;
      improvementType: 'professional' | 'concise' | 'persuasive';
    },
  ) {
    const improved = await this.aiService.improveContent(data.content, data.improvementType);
    return { improved };
  }

  @Get('history')
  async getHistory(@Query('userId') userId: string) {
    return this.aiService.getGenerationHistory(userId);
  }

  // Enhanced AI Copilot Endpoints
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chatWithCopilot(
    @Req() req: any,
    @Body()
    data: {
      prompt: string;
      context?: {
        proposalId?: string;
        clientName?: string;
        industry?: string;
        proposalContent?: string;
        settings?: {
          tone?: 'professional' | 'friendly' | 'persuasive' | 'formal';
          length?: 'concise' | 'moderate' | 'detailed';
          creativity?: number;
        };
      };
      conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ) {
    return this.aiService.chatWithCopilot(req.user.sub, data);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  async getSuggestions(
    @Req() req: any,
    @Body()
    data: {
      context: string;
      type: 'follow-up' | 'objection' | 'pricing' | 'summary' | 'email';
    },
  ) {
    return this.aiService.getSuggestions(req.user.sub, data);
  }

  @Post('template')
  @UseGuards(JwtAuthGuard)
  async generateFromTemplate(
    @Req() req: any,
    @Body()
    data: {
      templateId: string;
      variables: Record<string, string>;
    },
  ) {
    return this.aiService.generateFromTemplate(req.user.sub, data);
  }

  @Post('translate')
  async translateContent(
    @Body()
    data: {
      content: string;
      targetLanguage: string;
    },
  ) {
    return this.aiService.translateContent(data);
  }

  @Post('summarize')
  async summarizeContent(
    @Body()
    data: {
      content: string;
      maxLength?: number;
    },
  ) {
    return this.aiService.summarizeContent(data);
  }

  // ==================== AI PROPOSAL DRAFTER ====================

  /**
   * Smart rewrite content based on instruction
   * POST /ai/smart-rewrite
   */
  @Post('smart-rewrite')
  @UseGuards(JwtAuthGuard)
  async smartRewrite(
    @Req() req: any,
    @Body()
    data: {
      content: string;
      instruction: string;
      style?: 'persuasive' | 'concise' | 'professional' | 'friendly' | 'formal' | 'simplified';
      industry?: string;
      audience?: string;
    },
  ) {
    return this.aiService.smartRewrite(req.user.sub, data);
  }

  /**
   * Generate content by analyzing client's website URL
   * POST /ai/draft-from-url
   */
  @Post('draft-from-url')
  @UseGuards(JwtAuthGuard)
  async draftFromUrl(
    @Req() req: any,
    @Body()
    data: {
      url: string;
      blockType: 'introduction' | 'scope' | 'terms' | 'pricing' | 'conclusion' | 'custom';
      additionalContext?: string;
      proposalId?: string;
      serviceType?: string;
    },
  ) {
    return this.aiService.draftFromUrl(req.user.sub, data);
  }
}
