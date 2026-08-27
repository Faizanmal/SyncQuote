import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditCertificateService } from './audit-certificate.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProposalsService', () => {
  let service: ProposalsService;
  let prisma: PrismaService;

  const mockPrisma = {
    proposal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    template: {
      findFirst: jest.fn(),
    },
    proposalCollaborator: {
      findFirst: jest.fn(),
    },
  };

  const mockEventsGateway = {
    notifyProposalViewed: jest.fn(),
    notifyProposalApproved: jest.fn(),
    notifyCommentAdded: jest.fn(),
    notifyUser: jest.fn(),
  };

  const mockAuditCertificate = {
    generateCertificate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: AuditCertificateService, useValue: mockAuditCertificate },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      title: 'Test Proposal',
      clientName: 'Test Client',
      clientEmail: 'client@test.com',
    };

    it('should create a new proposal', async () => {
      const userId = 'user-123';
      const mockProposal = {
        id: 'proposal-123',
        ...createDto,
        userId,
        slug: 'test-proposal',
        status: 'DRAFT',
        createdAt: new Date(),
      };

      mockPrisma.proposal.create.mockResolvedValue(mockProposal);
      mockPrisma.activity.create.mockResolvedValue({});

      const result = await service.create(userId, createDto);

      expect(result).toHaveProperty('id');
      expect(result.title).toBe(createDto.title);
      expect(mockPrisma.proposal.create).toHaveBeenCalled();
    });

    it('should create proposal from template when templateId provided', async () => {
      const userId = 'user-123';
      const template = {
        id: 'template-123',
        name: 'Test Template',
        content: { blocks: [] },
        pricingItems: [{ name: 'Item 1', price: 100 }],
      };
      const dtoWithTemplate = { ...createDto, templateId: 'template-123' };

      mockPrisma.template.findFirst.mockResolvedValue(template);
      mockPrisma.proposal.create.mockResolvedValue({
        id: 'proposal-123',
        ...dtoWithTemplate,
        userId,
      });
      mockPrisma.activity.create.mockResolvedValue({});

      const result = await service.create(userId, dtoWithTemplate);

      expect(mockPrisma.template.findFirst).toHaveBeenCalledWith({
        where: { id: 'template-123', userId },
      });
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
      expect(mockPrisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          where: { userId },
        }),
      );
    });

    it('should filter by status when provided', async () => {
      const userId = 'user-123';
      mockPrisma.proposal.findMany.mockResolvedValue([]);
      mockPrisma.proposal.count.mockResolvedValue(0);

      await service.findAll(userId, { status: 'DRAFT' });

      expect(mockPrisma.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: 'DRAFT',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a proposal if user is owner', async () => {
      const userId = 'user-123';
      const proposalId = 'proposal-123';
      const mockProposal = {
        id: proposalId,
        userId,
        title: 'Test Proposal',
      };

      mockPrisma.proposal.findFirst.mockResolvedValue(mockProposal);

      const result = await service.findOne(userId, proposalId);

      expect(result.id).toBe(proposalId);
    });

    it('should throw NotFoundException if proposal not found', async () => {
      const userId = 'user-123';
      mockPrisma.proposal.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update proposal if user is owner', async () => {
      const userId = 'user-123';
      const proposalId = 'proposal-123';
      const mockProposal = {
        id: proposalId,
        userId,
        title: 'Old Title',
      };

      mockPrisma.proposal.findFirst.mockResolvedValue(mockProposal);
      mockPrisma.proposal.update.mockResolvedValue({
        ...mockProposal,
        title: 'New Title',
      });
      mockPrisma.activity.create.mockResolvedValue({});

      const result = await service.update(userId, proposalId, {
        title: 'New Title',
      });

      expect(result.title).toBe('New Title');
    });
  });

  describe('remove', () => {
    it('should delete proposal if user is owner', async () => {
      const userId = 'user-123';
      const proposalId = 'proposal-123';
      const mockProposal = { id: proposalId, userId };

      mockPrisma.proposal.findFirst.mockResolvedValue(mockProposal);
      mockPrisma.proposal.delete.mockResolvedValue(mockProposal);

      const result = await service.delete(userId, proposalId);

      expect(result).toHaveProperty('id', proposalId);
      expect(mockPrisma.proposal.delete).toHaveBeenCalledWith({
        where: { id: proposalId },
      });
    });
  });
});
