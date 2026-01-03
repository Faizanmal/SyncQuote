import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class PresenceUpdateDto {
    proposalId: string;

    @IsNumber()
    @Min(0)
    @Max(100)
    scrollDepth: number;

    @IsOptional()
    @IsNumber()
    scrollPosition?: number;

    @IsOptional()
    @IsString()
    activeSection?: string;

    @IsOptional()
    @IsString()
    activeSectionId?: string;

    @IsOptional()
    cursorPosition?: {
        x: number;
        y: number;
    };

    @IsOptional()
    @IsString()
    viewerName?: string;

    @IsOptional()
    @IsString()
    viewerEmail?: string;
}

export class CursorMoveDto {
    proposalId: string;
    x: number;
    y: number;
}

export class SectionLingerDto {
    proposalId: string;
    sectionId: string;
    sectionName: string;
    timeSpentMs: number;
}
