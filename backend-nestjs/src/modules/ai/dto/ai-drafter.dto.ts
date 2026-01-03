import { IsString, IsOptional, IsEnum, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RewriteStyle {
    PERSUASIVE = 'persuasive',
    CONCISE = 'concise',
    PROFESSIONAL = 'professional',
    FRIENDLY = 'friendly',
    FORMAL = 'formal',
    SIMPLIFIED = 'simplified',
}

export class SmartRewriteDto {
    @ApiProperty({ description: 'Original content to rewrite' })
    @IsString()
    content: string;

    @ApiProperty({ description: 'Rewrite instruction (e.g., "Make it more persuasive")' })
    @IsString()
    instruction: string;

    @ApiPropertyOptional({ enum: RewriteStyle, description: 'Predefined rewrite style' })
    @IsOptional()
    @IsEnum(RewriteStyle)
    style?: RewriteStyle;

    @ApiPropertyOptional({ description: 'Industry context for better rewriting' })
    @IsOptional()
    @IsString()
    industry?: string;

    @ApiPropertyOptional({ description: 'Target audience' })
    @IsOptional()
    @IsString()
    audience?: string;
}

export class DraftFromUrlDto {
    @ApiProperty({ description: 'Client website URL to analyze' })
    @IsUrl()
    url: string;

    @ApiProperty({ description: 'Type of block to generate' })
    @IsString()
    blockType: 'introduction' | 'scope' | 'terms' | 'pricing' | 'conclusion' | 'custom';

    @ApiPropertyOptional({ description: 'Additional context or requirements' })
    @IsOptional()
    @IsString()
    additionalContext?: string;

    @ApiPropertyOptional({ description: 'Proposal ID to associate with' })
    @IsOptional()
    @IsString()
    proposalId?: string;

    @ApiPropertyOptional({ description: 'Service type being offered' })
    @IsOptional()
    @IsString()
    serviceType?: string;
}

export class SmartRewriteResultDto {
    @ApiProperty({ description: 'Rewritten content' })
    rewrittenContent: string;

    @ApiPropertyOptional({ description: 'AI explanation of changes made' })
    explanation?: string;

    @ApiPropertyOptional({ description: 'Suggestions for further improvement' })
    suggestions?: string[];
}

export class DraftFromUrlResultDto {
    @ApiProperty({ description: 'Generated content block' })
    content: string;

    @ApiPropertyOptional({ description: 'Extracted company name' })
    companyName?: string;

    @ApiPropertyOptional({ description: 'Detected tone from website' })
    detectedTone?: string;

    @ApiPropertyOptional({ description: 'Key messaging themes found' })
    keyThemes?: string[];

    @ApiPropertyOptional({ description: 'Industry detected' })
    industry?: string;
}
