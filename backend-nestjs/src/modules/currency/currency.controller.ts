import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Controller('currency')
export class CurrencyController {
  constructor(private currencyService: CurrencyService) {}

  @Post('update-rates')
  async updateRates() {
    return this.currencyService.updateRates();
  }

  @Get('rate')
  async getRate(@Query('from') from: string, @Query('to') to: string) {
    const rate = await this.currencyService.getRate(from, to);
    return { from, to, rate };
  }

  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const convertedAmount = await this.currencyService.convert(parseFloat(amount), from, to);
    return { amount: parseFloat(amount), from, to, converted: convertedAmount };
  }

  @Get('rates/:base')
  async getAllRates(@Param('base') base: string) {
    return this.currencyService.getAllRates(base);
  }

  @Get('proposal/:proposalId/convert/:currency')
  async convertProposal(
    @Param('proposalId') proposalId: string,
    @Param('currency') currency: string,
  ) {
    return this.currencyService.convertProposalPricing(proposalId, currency);
  }
}
