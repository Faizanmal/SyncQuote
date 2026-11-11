import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditCertificateService } from './audit-certificate.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProposalsService', () => {
  let service: ProposalsService;

  const mockPrisma = {
    proposal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-123',
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: null,
        metadata: { stripePriceId: 'price_pro' },
      }),
    },
    proposalBlock: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrisma)),
  };

  const mockEventsGateway = {
    notifyProposalViewed: jest.fn(),
    notifyProposalApproved: jest.fn(),
    notifyCommentAdded: jest.fn(),
    notifyUser: jest.fn(),
  };

  const mockAuditCertificate = {
    generateCertificate: jest.fn(),
    generateProposalPdf: jest.fn(),
  };

  const mockEmailService = {
    sendProposalToClient: jest.fn().mockResolvedValue(true),
  };

  const mockNotificationsService = {
    notifyProposalSigned: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'STRIPE_PRO_PRICE_ID') return 'price_pro';
      if (key === 'STRIPE_ENTERPRISE_PRICE_ID') return 'price_ent';
      return fallback;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: AuditCertificateService, useValue: mockAuditCertificate },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a proposal with content and pricing items', async () => {
      const userId = 'user-123';
      const createDto = {
        title: 'Test Proposal',
        clientName: 'Test Client',
        clientEmail: 'client@test.com',
        content: '<p>Hello</p>',
        pricingItems: [{ name: 'Design', price: 500, type: 'FIXED', quantity: 1 }],
      };

      const mockProposal = {
        id: 'proposal-123',
        title: createDto.title,
        recipientName: createDto.clientName,
        recipientEmail: createDto.clientEmail,
        content: createDto.content,
        userId,
        slug: 'abc123',
        status: 'DRAFT',
        blocks: [
          {
            type: 'PRICING_TABLE',
            pricingItems: [
              {
                id: 'pi-1',
                name: 'Design',
                description: null,
                price: 500,
                type: 'FIXED',
                order: 0,
                minQuantity: 1,
              },
            ],
          },
        ],
      };

      mockPrisma.proposal.create.mockResolvedValue(mockProposal);

      const result = await service.create(userId, createDto);

      expect(result.title).toBe(createDto.title);
      expect(result.clientName).toBe(createDto.clientName);
      expect(result.content).toBe('<p>Hello</p>');
      expect(result.pricingItems).toHaveLength(1);
      expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: '<p>Hello</p>',
            recipientEmail: 'client@test.com',
            blocks: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of proposals for the user', async () => {
      const userId = 'user-123';
      const mockProposals = [
        { id: 'p1', title: 'Proposal 1', userId, recipientName: 'A', recipientEmail: 'a@test.com' },
        { id: 'p2', title: 'Proposal 2', userId, recipientName: 'B', recipientEmail: 'b@test.com' },
      ];

      mockPrisma.proposal.findMany.mockResolvedValue(mockProposals);
      mockPrisma.proposal.count.mockResolvedValue(2);

      const result = await service.findAll(userId);

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasMore: false,
      });
    });
  });

  describe('findOne', () => {
    it('should return a proposal by id', async () => {
      const userId = 'user-123';
      const proposalId = 'proposal-123';
      const mockProposal = {
        id: proposalId,
        userId,
        title: 'Test Proposal',
        recipientName: 'Client',
        recipientEmail: 'c@test.com',
        content: '<p>x</p>',
        blocks: [],
      };

      mockPrisma.proposal.findUnique.mockResolvedValueOnce(mockProposal);

      const result = await service.findOne(proposalId, userId);

      expect(result.id).toBe(proposalId);
      expect(result.clientEmail).toBe('c@test.com');
    });

    it('should fall back to slug lookup', async () => {
      const userId = 'user-123';
      const mockProposal = {
        id: 'proposal-123',
        slug: 'abc123slug12',
        userId,
        title: 'By Slug',
        blocks: [],
      };

      mockPrisma.proposal.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockProposal);

      const result = await service.findOne('abc123slug12', userId);

      expect(result.slug).toBe('abc123slug12');
    });

    it('should throw NotFoundException if proposal not found', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('send', () => {
    it('should mark proposal SENT and email the client', async () => {
      const userId = 'user-123';
      const mockProposal = {
        id: 'proposal-123',
        slug: 'pubslug1234',
        userId,
        title: 'Send Me',
        recipientName: 'Client',
        recipientEmail: 'client@test.com',
        content: '<p>Body</p>',
        locked: false,
        blocks: [],
        user: { name: 'Seller', companyName: 'Acme' },
      };

      mockPrisma.proposal.findUnique.mockResolvedValue(mockProposal);
      mockPrisma.proposal.update.mockResolvedValue({
        ...mockProposal,
        status: 'SENT',
        sentAt: new Date(),
      });
      mockPrisma.activity.create.mockResolvedValue({});

      const result = await service.send('proposal-123', userId);

      expect(result.status).toBe('SENT');
      expect(result.publicUrl).toContain('/p/pubslug1234');
      expect(result.emailSent).toBe(true);
      expect(mockEmailService.sendProposalToClient).toHaveBeenCalled();
    });

    it('should reject send without client email', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        id: 'proposal-123',
        userId: 'user-123',
        title: 'No Email',
        recipientEmail: null,
        content: '<p>x</p>',
        locked: false,
        blocks: [],
      });

      await expect(service.send('proposal-123', 'user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('plan limits', () => {
    it('should block create when free monthly limit is reached', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        subscriptionStatus: 'CANCELED',
        trialEndsAt: null,
        metadata: {},
      });
      mockPrisma.proposal.count.mockResolvedValue(5);

      await expect(
        service.create('user-123', {
          title: 'Over limit',
          clientName: 'A',
          clientEmail: 'a@test.com',
        }),
      ).rejects.toThrow(/limit/i);
    });
  });

  describe('delete', () => {
    it('should delete proposal if user is owner', async () => {
      const userId = 'user-123';
      const proposalId = 'proposal-123';
      const mockProposal = {
        id: proposalId,
        userId,
        title: 'Delete Me',
        blocks: [],
      };

      mockPrisma.proposal.findUnique.mockResolvedValue(mockProposal);
      mockPrisma.proposal.delete.mockResolvedValue(mockProposal);

      const result = await service.delete(proposalId, userId);

      expect(result.id).toBe(proposalId);
      expect(mockPrisma.proposal.delete).toHaveBeenCalledWith({
        where: { id: proposalId },
      });
    });
  });
});
