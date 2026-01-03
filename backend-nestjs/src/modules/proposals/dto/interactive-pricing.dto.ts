import { IsString, IsBoolean, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PricingItemSelectionDto {
    @ApiProperty({ description: 'The pricing item ID' })
    @IsString()
    itemId: string;

    @ApiProperty({ description: 'Whether the optional item is selected' })
    @IsBoolean()
    selected: boolean;

    @ApiPropertyOptional({ description: 'Quantity for quantity-based items' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    quantity?: number;
}

export class UpdatePricingSelectionsDto {
    @ApiProperty({ type: [PricingItemSelectionDto], description: 'Array of pricing selections' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PricingItemSelectionDto)
    selections: PricingItemSelectionDto[];
}

export class PricingCalculationResultDto {
    @ApiProperty({ description: 'Subtotal before tax' })
    subtotal: number;

    @ApiProperty({ description: 'Tax amount' })
    taxAmount: number;

    @ApiProperty({ description: 'Total including tax' })
    total: number;

    @ApiPropertyOptional({ description: 'Deposit amount if required' })
    depositAmount?: number;

    @ApiProperty({ description: 'Line items breakdown' })
    lineItems: {
        id: string;
        name: string;
        price: number;
        quantity: number;
        selected: boolean;
        lineTotal: number;
    }[];

    @ApiPropertyOptional({ description: 'Currency code' })
    currency?: string;

    @ApiPropertyOptional({ description: 'Updated Stripe Payment Intent client secret' })
    paymentIntentClientSecret?: string;
}
