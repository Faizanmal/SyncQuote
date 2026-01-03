import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

interface GenerateContentDto {
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
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(private prisma: PrismaService) { }

  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

  async generateContent(data: GenerateContentDto) {
    const prompt = this.buildPrompt(data.contentType, data.context);

    try {
      // Call OpenAI API
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert proposal writer who creates professional, persuasive content for business proposals. Your writing is clear, professional, and tailored to the specific industry and context provided.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      const generatedContent = response.data.choices[0].message.content;

      // Save to database
      const aiContent = await this.prisma.aIGeneratedContent.create({
        data: {
          prompt,
          generatedContent,
          contentType: data.contentType,
          model: 'gpt-4',
          userId: data.userId,
          proposalId: data.proposalId,
        },
      });

      return {
        content: generatedContent,
        id: aiContent.id,
      };
    } catch (error) {
      this.logger.error('AI generation error:', error);

      // Fallback to template-based content if API fails
      return {
        content: this.getFallbackContent(data.contentType, data.context),
        id: null,
        fallback: true,
      };
    }
  }

  private buildPrompt(contentType: string, context: GenerateContentDto['context']): string {
    const {
      industry,
      serviceType,
      clientName,
      projectDescription,
      budget,
      timeline,
      additionalNotes,
    } = context;

    const baseContext = `
Industry: ${industry || 'General'}
Service Type: ${serviceType || 'Professional Services'}
Client: ${clientName || 'Valued Client'}
${projectDescription ? `Project: ${projectDescription}` : ''}
${budget ? `Budget: $${budget}` : ''}
${timeline ? `Timeline: ${timeline}` : ''}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ''}
    `.trim();

    switch (contentType) {
      case 'introduction':
        return `Write a professional proposal introduction that:
- Warmly addresses the client
- Acknowledges their needs and challenges
- Establishes credibility and expertise
- Sets a positive tone for the proposal

Context:
${baseContext}

Keep it concise (2-3 paragraphs) and personalized.`;

      case 'scope':
        return `Write a detailed scope of work section that:
- Clearly defines deliverables
- Outlines the approach and methodology
- Specifies what is included and excluded
- Sets clear expectations

Context:
${baseContext}

Be specific and actionable. Use bullet points where appropriate.`;

      case 'terms':
        return `Write professional terms and conditions that:
- Define payment terms
- Outline revision policies
- Specify timeline and milestones
- Include cancellation terms
- Address intellectual property rights

Context:
${baseContext}

Be clear but fair. Protect both parties' interests.`;

      case 'pricing':
        return `Suggest a pricing structure with:
- Breakdown of services/deliverables
- Recommended pricing tiers or options
- Value justification for each item
- Optional add-ons

Context:
${baseContext}

Focus on value, not just cost. Include 3-5 line items.`;

      case 'conclusion':
        return `Write a compelling proposal conclusion that:
- Summarizes key benefits
- Includes a clear call to action
- Expresses enthusiasm for the partnership
- Provides next steps

Context:
${baseContext}

Keep it motivating and action-oriented (2-3 paragraphs).`;

      default:
        return `Generate professional content for a business proposal based on: ${baseContext}`;
    }
  }

  private getFallbackContent(contentType: string, context: GenerateContentDto['context']): string {
    const clientName = context.clientName || 'Valued Client';

    switch (contentType) {
      case 'introduction':
        return `Dear ${clientName},

Thank you for the opportunity to submit this proposal. We understand your needs and are excited to present our approach to delivering exceptional results for your project.

Our team has extensive experience in ${context.industry || 'this field'} and is committed to providing high-quality ${context.serviceType || 'services'} that exceed your expectations.`;

      case 'scope':
        return `## Scope of Work

We will deliver the following:

- Comprehensive ${context.serviceType || 'service'} tailored to your needs
- Regular communication and progress updates
- Quality assurance and testing
- Final delivery of all agreed-upon deliverables

This scope is based on the project requirements discussed and can be adjusted as needed.`;

      case 'terms':
        return `## Terms & Conditions

**Payment Terms:**
- 50% deposit required to begin work
- Remaining balance due upon completion
- Payment accepted via bank transfer or credit card

**Timeline:**
- Project will be completed within ${context.timeline || 'the agreed timeframe'}
- Delays due to client feedback or changes will extend the timeline accordingly

**Revisions:**
- Two rounds of revisions included
- Additional revisions billed at our standard hourly rate

**Cancellation:**
- Client may cancel with 7 days written notice
- Deposit is non-refundable
- Work completed to date will be billed`;

      case 'pricing':
        return `## Investment

**Project Deliverables:**
- Core ${context.serviceType || 'service'}: $${context.budget ? (context.budget * 0.7).toFixed(2) : '5,000'}
- Additional features: $${context.budget ? (context.budget * 0.2).toFixed(2) : '1,500'}
- Support & maintenance: $${context.budget ? (context.budget * 0.1).toFixed(2) : '500'}

**Total Investment:** $${context.budget || '7,000'}

*All prices in USD. Taxes not included.*`;

      case 'conclusion':
        return `## Next Steps

We're excited about the opportunity to work with you on this project. Our team is ready to deliver exceptional results that meet your goals and exceed your expectations.

**To move forward:**
1. Review and approve this proposal
2. Sign the agreement below
3. Submit the initial deposit
4. We'll schedule a kickoff call to begin the project

We look forward to partnering with you on this exciting project!`;

      default:
        return `Professional content for ${contentType} will be generated based on your project requirements.`;
    }
  }

  async getGenerationHistory(userId: string) {
    return this.prisma.aIGeneratedContent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async improveContent(
    originalContent: string,
    improvementType: 'professional' | 'concise' | 'persuasive',
  ) {
    const prompt = `Improve the following content to be more ${improvementType}:

${originalContent}

Rewrite it while maintaining the core message but enhancing the ${improvementType} quality.`;

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert editor who improves business writing.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('AI improvement error:', error);
      return originalContent;
    }
  }

  // Enhanced AI Copilot Methods
  async chatWithCopilot(
    userId: string,
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
    const settings = data.context?.settings || {};
    const tone = settings.tone || 'professional';
    const length = settings.length || 'moderate';
    const creativity = settings.creativity || 0.7;

    const systemPrompt = `You are an expert proposal writing assistant. Your responses should be ${tone} in tone and ${length} in length.
${data.context?.industry ? `The client's industry is ${data.context.industry}.` : ''}
${data.context?.clientName ? `The client's name is ${data.context.clientName}.` : ''}

Help users write compelling proposals, answer questions about proposal best practices, suggest improvements, and assist with any proposal-related tasks.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(data.conversationHistory || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: data.prompt },
    ];

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages,
          temperature: creativity,
          max_tokens: length === 'concise' ? 500 : length === 'detailed' ? 2000 : 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      const content = response.data.choices[0].message.content;

      // Save to database
      await this.prisma.aIGeneratedContent.create({
        data: {
          prompt: data.prompt,
          generatedContent: content,
          contentType: 'chat',
          model: 'gpt-4',
          userId,
          proposalId: data.context?.proposalId,
        },
      });

      return { content };
    } catch (error) {
      this.logger.error('AI chat error:', error);
      return { content: 'I apologize, but I encountered an error. Please try again.', error: true };
    }
  }

  async getSuggestions(
    userId: string,
    data: {
      context: string;
      type: 'follow-up' | 'objection' | 'pricing' | 'summary' | 'email';
    },
  ) {
    const prompts: Record<string, string> = {
      'follow-up': `Based on the following context, suggest 3 effective follow-up actions or messages:\n\n${data.context}`,
      objection: `Based on the following client objection or concern, provide 3 professional responses:\n\n${data.context}`,
      pricing: `Based on the following context, suggest pricing strategies and value propositions:\n\n${data.context}`,
      summary: `Summarize the following proposal content into key bullet points:\n\n${data.context}`,
      email: `Write a professional email based on the following context:\n\n${data.context}`,
    };

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert business development consultant who helps with proposal writing and client communication.',
            },
            {
              role: 'user',
              content: prompts[data.type] || prompts['summary'],
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      return { suggestions: response.data.choices[0].message.content };
    } catch (error) {
      this.logger.error('AI suggestions error:', error);
      return { suggestions: null, error: true };
    }
  }

  async generateFromTemplate(
    userId: string,
    data: {
      templateId: string;
      variables: Record<string, string>;
    },
  ) {
    const templates: Record<string, string> = {
      'executive-summary': `Write a professional executive summary for a proposal to {{clientName}}. The proposal is about {{topic}}. Focus on key value propositions and expected outcomes.`,
      'scope-of-work': `Generate a comprehensive scope of work section including deliverables, milestones, and timelines for {{project}}.`,
      'pricing-justification': `Write a persuasive pricing justification explaining the value and ROI of the proposed investment of {{amount}}.`,
      'follow-up-email': `Write a professional follow-up email to {{clientName}} regarding the proposal sent {{timeSent}}. The proposal was about {{topic}}.`,
      'objection-handler': `Help me respond to this client objection: "{{objection}}". Provide a professional and empathetic response.`,
      'case-study': `Create a brief case study showcasing similar work done for a client in the {{industry}} industry.`,
      'terms-conditions': `Generate professional terms and conditions for a {{serviceType}} engagement.`,
    };

    const template = templates[data.templateId];
    if (!template) {
      return { content: null, error: 'Template not found' };
    }

    // Replace variables
    let prompt = template;
    for (const [key, value] of Object.entries(data.variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert proposal writer who creates professional, persuasive content for business proposals.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      const content = response.data.choices[0].message.content;

      await this.prisma.aIGeneratedContent.create({
        data: {
          prompt,
          generatedContent: content,
          contentType: data.templateId,
          model: 'gpt-4',
          userId,
        },
      });

      return { content };
    } catch (error) {
      this.logger.error('AI template error:', error);
      return { content: null, error: true };
    }
  }

  async translateContent(data: { content: string; targetLanguage: string }) {
    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following content to ${data.targetLanguage} while maintaining the professional tone and meaning.`,
            },
            {
              role: 'user',
              content: data.content,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      return { translated: response.data.choices[0].message.content };
    } catch (error) {
      this.logger.error('AI translation error:', error);
      return { translated: null, error: true };
    }
  }

  async summarizeContent(data: { content: string; maxLength?: number }) {
    const maxLength = data.maxLength || 150;

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert at summarizing content. Create a concise summary in about ${maxLength} words while capturing the key points.`,
            },
            {
              role: 'user',
              content: data.content,
            },
          ],
          temperature: 0.5,
          max_tokens: maxLength * 2,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      return { summary: response.data.choices[0].message.content };
    } catch (error) {
      this.logger.error('AI summarization error:', error);
      return { summary: null, error: true };
    }
  }

  // ==================== AI PROPOSAL DRAFTER ====================

  /**
   * Smart rewrite content based on user instruction
   */
  async smartRewrite(
    userId: string,
    data: {
      content: string;
      instruction: string;
      style?: string;
      industry?: string;
      audience?: string;
    },
  ): Promise<{ rewrittenContent: string; explanation?: string; suggestions?: string[] }> {
    const styleGuide = data.style
      ? `Use a ${data.style} writing style.`
      : '';
    const industryContext = data.industry
      ? `This is for the ${data.industry} industry.`
      : '';
    const audienceContext = data.audience
      ? `The target audience is ${data.audience}.`
      : '';

    const prompt = `You are an expert proposal writer. Rewrite the following content based on this instruction: "${data.instruction}"

${styleGuide}
${industryContext}
${audienceContext}

Original Content:
${data.content}

Provide:
1. The rewritten content
2. A brief explanation of changes made
3. 2-3 suggestions for further improvement

Format your response as JSON:
{
  "rewrittenContent": "...",
  "explanation": "...",
  "suggestions": ["...", "..."]
}`;

    try {
      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert proposal writer who specializes in clear, persuasive business communication. Always respond with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      const rawContent = response.data.choices[0].message.content;

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(rawContent);

        // Save to database
        await this.prisma.aIGeneratedContent.create({
          data: {
            prompt: data.instruction,
            generatedContent: parsed.rewrittenContent,
            contentType: 'smart_rewrite',
            model: 'gpt-4',
            userId,
          },
        });

        return parsed;
      } catch {
        // If not valid JSON, return raw content
        return { rewrittenContent: rawContent };
      }
    } catch (error) {
      this.logger.error('AI smart rewrite error:', error);
      return { rewrittenContent: data.content, explanation: 'Failed to rewrite. Returning original.' };
    }
  }

  /**
   * Draft content by analyzing client's website URL
   */
  async draftFromUrl(
    userId: string,
    data: {
      url: string;
      blockType: string;
      additionalContext?: string;
      proposalId?: string;
      serviceType?: string;
    },
  ): Promise<{
    content: string;
    companyName?: string;
    detectedTone?: string;
    keyThemes?: string[];
    industry?: string;
  }> {
    try {
      // Step 1: Fetch and extract content from URL
      const webContent = await this.extractWebsiteContent(data.url);

      // Step 2: Analyze branding and generate content
      const prompt = `You are analyzing a company's website to generate personalized proposal content.

Website URL: ${data.url}
Website Content Summary:
${webContent}

${data.additionalContext ? `Additional Context: ${data.additionalContext}` : ''}
${data.serviceType ? `Service Being Offered: ${data.serviceType}` : ''}

Based on this website, generate a ${data.blockType} section for a proposal that:
1. Matches the company's tone and branding
2. References their industry and business
3. Shows understanding of their needs
4. Is highly personalized

Also extract:
- Company name
- Detected communication tone (formal, friendly, technical, etc.)
- Key themes/values from their messaging
- Industry they're in

Format response as JSON:
{
  "content": "The generated ${data.blockType} content...",
  "companyName": "...",
  "detectedTone": "...",
  "keyThemes": ["...", "..."],
  "industry": "..."
}`;

      const response = await axios.post(
        this.OPENAI_API_URL,
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing company websites and generating personalized business proposal content. Always respond with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          },
        },
      );

      const rawContent = response.data.choices[0].message.content;

      try {
        const parsed = JSON.parse(rawContent);

        // Save to database
        await this.prisma.aIGeneratedContent.create({
          data: {
            prompt: `Draft from URL: ${data.url}`,
            generatedContent: parsed.content,
            contentType: `url_draft_${data.blockType}`,
            model: 'gpt-4',
            userId,
            proposalId: data.proposalId,
          },
        });

        return parsed;
      } catch {
        return { content: rawContent };
      }
    } catch (error) {
      this.logger.error('AI draft from URL error:', error);
      return { content: 'Failed to generate content from URL. Please try again or provide more context.' };
    }
  }

  /**
   * Extract text content from a website URL
   */
  private async extractWebsiteContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SyncQuote/1.0; +https://syncquote.com)',
        },
        timeout: 10000,
      });

      const html = response.data;

      // Simple HTML to text extraction
      // Remove script and style elements
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

      // Replace HTML tags with spaces
      text = text.replace(/<[^>]+>/g, ' ');

      // Decode HTML entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Limit length for API
      return text.substring(0, 4000);
    } catch (error) {
      this.logger.error('Error fetching website:', error);
      return `Unable to fetch website content from ${url}. The AI will generate generic content.`;
    }
  }
}
