import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Currency } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Exchange rates API (using exchangerate-api.com - free tier)
  private readonly API_URL = 'https://api.exchangerate-api.com/v4/latest';

  async updateRates() {
    try {
      const currencies: Currency[] = [
        Currency.USD,
        Currency.EUR,
        Currency.GBP,
        Currency.CAD,
        Currency.AUD,
        Currency.JPY,
        Currency.CHF,
        Currency.CNY,
        Currency.INR,
      ];

      // Fetch rates from USD base
      const response = await axios.get(`${ this.API_URL }/USD`);
const rates = response.data.rates;

// Update all currency pairs in database
for (const target of currencies) {
  if (target !== Currency.USD) {
    await this.prisma.currencyRate.upsert({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: Currency.USD,
          targetCurrency: target,
        },
      },
      create: {
        baseCurrency: Currency.USD,
        targetCurrency: target,
        rate: rates[target],
      },
      update: {
        rate: rates[target],
      },
    });
  }
}

return { success: true, updatedAt: new Date() };
    } catch (error) {
  this.logger.error('Failed to update currency rates:', error);
  throw error;
}
  }

  async getRate(from: string, to: string): Promise < number > {
  if(from === to) return 1;

// Try direct rate
const directRate = await this.prisma.currencyRate.findUnique({
  where: {
    baseCurrency_targetCurrency: {
      baseCurrency: from as any,
      targetCurrency: to as any,
    },
  },
});

if (directRate) {
  return directRate.rate;
}

// Try inverse rate
const inverseRate = await this.prisma.currencyRate.findUnique({
  where: {
    baseCurrency_targetCurrency: {
      baseCurrency: to as any,
      targetCurrency: from as any,
    },
  },
});

if (inverseRate) {
  return 1 / inverseRate.rate;
}

// If no rate found, update rates and try again
await this.updateRates();
return this.getRate(from, to);
  }

  async convert(amount: number, from: string, to: string): Promise < number > {
  const rate = await this.getRate(from, to);
  return amount * rate;
}

  async getAllRates(baseCurrency: string = 'USD') {
  const rates = await this.prisma.currencyRate.findMany({
    where: { baseCurrency: baseCurrency as any },
  });

  return rates.reduce(
    (acc, rate) => {
      acc[rate.targetCurrency] = rate.rate;
      return acc;
    },
    {} as Record<string, number>,
  );
}

  async convertProposalPricing(proposalId: string, targetCurrency: string) {
  const proposal = await this.prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      blocks: {
        include: {
          pricingItems: true,
        },
      },
    },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  const rate = await this.getRate(proposal.currency, targetCurrency);

  // Convert all pricing items
  const convertedBlocks = await Promise.all(
    proposal.blocks.map(async (block) => {
      if (block.type === 'PRICING_TABLE' && block.pricingItems.length > 0) {
        const convertedItems = block.pricingItems.map((item) => ({
          ...item,
          price: item.price * rate,
          originalPrice: item.price,
          originalCurrency: proposal.currency,
        }));
        return { ...block, pricingItems: convertedItems };
      }
      return block;
    }),
  );

  return {
    ...proposal,
    currency: targetCurrency,
    exchangeRate: rate,
    blocks: convertedBlocks,
  };
}
}
