import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../billing/billing.service';
import { PaymentsService } from '../payments/payments.service';
import { TemplateMarketplaceService } from '../template-marketplace/template-marketplace.service';
import { BadRequestException } from '@nestjs/common';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  const mockPrisma = {
    stripeWebhookEvent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    proposal: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    invoice: {
      updateMany: jest.fn(),
    },
    proposalPayment: {
      updateMany: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
      };
      return config[key];
    }),
  };

  const mockBillingService = {
    applyCheckoutCompleted: jest.fn(),
  };

  const mockPaymentsService = {
    handlePaymentSuccess: jest.fn(),
  };

  const mockTemplateMarketplaceService = {
    fulfillPaidPurchase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: BillingService, useValue: mockBillingService },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: TemplateMarketplaceService, useValue: mockTemplateMarketplaceService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAndParseWebhook', () => {
    it('should throw error when webhook secret not configured', async () => {
      const mockConfigWithoutSecret = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WebhooksService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: mockConfigWithoutSecret },
          { provide: BillingService, useValue: mockBillingService },
          { provide: PaymentsService, useValue: mockPaymentsService },
          { provide: TemplateMarketplaceService, useValue: mockTemplateMarketplaceService },
        ],
      }).compile();

      const serviceWithoutSecret = module.get<WebhooksService>(WebhooksService);

      await expect(
        serviceWithoutSecret.verifyAndParseWebhook(Buffer.from('test'), 'sig_123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should skip already processed events', async () => {
      const event = {
        id: 'evt_123',
        type: 'invoice.paid',
        data: { object: {} },
      };

      mockPrisma.stripeWebhookEvent.findUnique.mockResolvedValue({
        eventId: event.id,
        processed: true,
      });

      await service.handleStripeWebhook(event as any);

      expect(mockPrisma.stripeWebhookEvent.update).not.toHaveBeenCalled();
    });

    it('should process invoice.paid event', async () => {
      const event = {
        id: 'evt_123',
        type: 'invoice.paid',
        data: {
          object: {
            customer: 'cus_123',
            period_end: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      };

      mockPrisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.stripeWebhookEvent.upsert.mockResolvedValue({});
      mockPrisma.user.updateMany.mockResolvedValue({});
      mockPrisma.stripeWebhookEvent.update.mockResolvedValue({});

      await service.handleStripeWebhook(event as any);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
        data: expect.objectContaining({
          subscriptionStatus: 'ACTIVE',
        }),
      });
    });

    it('should process payment_intent.succeeded with proposalId', async () => {
      const event = {
        id: 'evt_456',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            metadata: { proposalId: 'prop_123', paymentType: 'deposit' },
          },
        },
      };

      mockPrisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.stripeWebhookEvent.upsert.mockResolvedValue({});
      mockPrisma.proposal.updateMany.mockResolvedValue({});
      mockPrisma.stripeWebhookEvent.update.mockResolvedValue({});

      await service.handleStripeWebhook(event as any);

      expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith({
        where: { id: 'prop_123' },
        data: expect.objectContaining({
          depositPaid: true,
          stripePaymentIntentId: 'pi_123',
        }),
      });
    });
  });
});
