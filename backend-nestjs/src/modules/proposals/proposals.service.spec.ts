import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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

    const mockStorage = {
        uploadFile: jest.fn(),
        deleteFile: jest.fn(),
        getSignedUrl: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProposalsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: StorageService, useValue: mockStorage },
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
        it('should return array of proposals for user', async () => {
            const userId = 'user-123';
            const mockProposals = [
                { id: 'p1', title: 'Proposal 1', userId },
                { id: 'p2', title: 'Proposal 2', userId },
            ];

            mockPrisma.proposal.findMany.mockResolvedValue(mockProposals);

            const result = await service.findAll(userId);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
        });

        it('should filter by status when provided', async () => {
            const userId = 'user-123';
            mockPrisma.proposal.findMany.mockResolvedValue([]);

            await service.findAll(userId);

            expect(mockPrisma.proposal.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
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

            await expect(service.findOne(userId, 'non-existent')).rejects.toThrow(
                NotFoundException,
            );
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
