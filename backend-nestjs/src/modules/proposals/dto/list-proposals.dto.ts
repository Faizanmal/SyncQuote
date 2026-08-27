import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const PROPOSAL_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'viewCount',
  'totalAmount',
] as const;

export class ListProposalsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === 'all' || value === '' ? undefined : value))
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PROPOSAL_SORT_FIELDS })
  @IsOptional()
  @IsIn(PROPOSAL_SORT_FIELDS)
  sortBy?: (typeof PROPOSAL_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
