import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty()
  @IsString()
  priceId: string;

  @ApiProperty()
  @IsString()
  successUrl: string;

  @ApiProperty()
  @IsString()
  cancelUrl: string;
}

export class CreatePortalSessionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  returnUrl?: string;
}
