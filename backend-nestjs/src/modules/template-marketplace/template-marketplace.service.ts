import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PublishTemplateDto,
  UpdateMarketplaceTemplateDto,
  SearchMarketplaceDto,
  CreateReviewDto,
  UpdateReviewDto,
  PurchaseTemplateDto,
  ReportTemplateDto,
  TemplateStatus,
  TemplatePriceType,
  TemplateCategory,
} from './dto';

@Injectable()
export class TemplateMarketplaceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Publish template to marketplace
   */
  async publishTemplate(userId: string, dto: PublishTemplateDto) {
    // Verify template ownership
    const template = await this.prisma.template.findFirst({
      where: { id: dto.templateId, userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Check if already published
    const existing = await this.prisma.templateMarketplace.findFirst({
      where: { templateId: dto.templateId },
    });

    if (existing) {
      throw new BadRequestException('Template already published to marketplace');
    }

    // Create marketplace listing
    const listing = await this.prisma.templateMarketplace.create({
      data: {
        templateId: dto.templateId,
        publishedBy: userId,
        sellerId: userId,
        title: dto.title,
        description: dto.description,
        category: dto.category as any,
        tags: dto.tags || [],
        price: dto.price || 0,
        published: true,
      },
    });

    return listing;
  }

  /**
   * Update marketplace listing
   */
  async updateListing(userId: string, listingId: string, dto: UpdateMarketplaceTemplateDto) {
    const listing = await this.prisma.templateMarketplace.findFirst({
      where: { id: listingId, sellerId: userId },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace listing not found');
    }
    const updated = await this.prisma.templateMarketplace.update({
      where: { id: listingId },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category as any,
        tags: dto.tags,
        price: dto.price,
        status: 'pending_review', // Re-review on update
      },
    });

    return updated;
  }

  /**
   * Search marketplace templates
   */
  async searchTemplates(dto: SearchMarketplaceDto) {
    const { query, category, priceType, minRating, tags, sortBy, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      status: TemplateStatus.APPROVED,
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ];
    }

    if (category) {
      where.category = category as any;
    }

    if (priceType) {
      where.priceType = priceType;
    }

    if (minRating) {
      where.averageRating = { gte: minRating };
    }

    if (tags?.length) {
      where.tags = { hasSome: tags };
    }

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    switch (sortBy) {
      case 'popular':
        orderBy = { downloadCount: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'rating':
        orderBy = { averageRating: 'desc' };
        break;
      case 'price_low':
        orderBy = { price: 'asc' };
        break;
      case 'price_high':
        orderBy = { price: 'desc' };
        break;
    }

    const [templates, total] = await Promise.all([
      this.prisma.templateMarketplace.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          seller: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.templateMarketplace.count({ where }),
    ]);

    return {
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single marketplace template
   */
  async getTemplate(listingId: string, userId?: string) {
    const listing = await this.prisma.templateMarketplace.findUnique({
      where: { id: listingId },
      include: {
        template: { select: { id: true, name: true, content: true, thumbnail: true } },
        seller: { select: { id: true, firstName: true, lastName: true } },
        reviews: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Template not found');
    }

    // Increment view count
    await this.prisma.templateMarketplace.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });

    // Check if user has purchased
    let hasPurchased = false;
    if (userId) {
      const purchase = await this.prisma.templatePurchase.findFirst({
        where: { marketplaceTemplateId: listingId, buyerId: userId },
      });
      hasPurchased = !!purchase;
    }

    return { ...listing, hasPurchased };
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit: number = 10) {
    const templates = await this.prisma.templateMarketplace.findMany({
      where: {
        status: TemplateStatus.APPROVED,
        isFeatured: true,
      },
      take: limit,
      orderBy: { featuredAt: 'desc' },
      include: {
        seller: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return templates;
  }

  /**
   * Get popular templates by category
   */
  async getPopularByCategory(category: string, limit: number = 10) {
    const templates = await this.prisma.templateMarketplace.findMany({
      where: {
        status: TemplateStatus.APPROVED,
        category: category as any,
      },
      take: limit,
      orderBy: { downloadCount: 'desc' },
      include: {
        seller: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return templates;
  }

  /**
   * Purchase/download template
   */
  async purchaseTemplate(userId: string, dto: PurchaseTemplateDto) {
    const listing = await this.prisma.templateMarketplace.findUnique({
      where: { id: dto.marketplaceTemplateId },
      include: { template: true },
    });

    if (!listing) {
      throw new NotFoundException('Template not found');
    }

    // Check if already purchased
    const existingPurchase = await this.prisma.templatePurchase.findFirst({
      where: { marketplaceTemplateId: dto.marketplaceTemplateId, buyerId: userId },
    });

    if (existingPurchase) {
      return { alreadyPurchased: true, purchase: existingPurchase };
    }

    // Handle payment for paid templates
    if (listing.priceType !== TemplatePriceType.FREE && listing.price > 0) {
      // In real implementation, process payment here
      // For now, we'll just create the purchase record
    }

    // Create purchase record
    const purchase = await this.prisma.templatePurchase.create({
      data: {
        marketplaceTemplateId: dto.marketplaceTemplateId,
        buyerId: userId,
        templateId: listing.templateId,
        price: listing.price,
        currency: 'USD',
      },
    });

    // Clone template to user's templates
    const clonedTemplate = await this.prisma.template.create({
      data: {
        userId,
        name: `${listing.title} (Copy)`,
        description: listing.description,
        content: listing.template.content as any,
        category: listing.category,
        sourceMarketplaceId: dto.marketplaceTemplateId,
      },
    });

    // Update download count
    await this.prisma.templateMarketplace.update({
      where: { id: dto.marketplaceTemplateId },
      data: { downloadCount: { increment: 1 } },
    });

    return {
      purchase,
      template: clonedTemplate,
    };
  }

  /**
   * Create review
   */
  async createReview(userId: string, dto: CreateReviewDto) {
    // Verify purchase
    const purchase = await this.prisma.templatePurchase.findFirst({
      where: { marketplaceTemplateId: dto.marketplaceTemplateId, buyerId: userId },
    });

    if (!purchase) {
      throw new ForbiddenException('You must purchase the template before reviewing');
    }

    // Get marketplace template to access templateId
    const marketplace = await this.prisma.templateMarketplace.findUnique({
      where: { id: dto.marketplaceTemplateId },
    });

    if (!marketplace) {
      throw new NotFoundException('Marketplace template not found');
    }

    // Check for existing review
    const existingReview = await this.prisma.templateReview.findFirst({
      where: { marketplaceTemplateId: dto.marketplaceTemplateId, userId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this template');
    }

    const review = await this.prisma.templateReview.create({
      data: {
        templateId: marketplace.templateId,
        marketplaceTemplateId: dto.marketplaceTemplateId,
        reviewerId: userId,
        userId: userId,
        rating: dto.rating,
        title: dto.title,
        text: (dto as any).text || '',
      },
    });

    // Update average rating
    await this.updateAverageRating(dto.marketplaceTemplateId);

    return review;
  }

  /**
   * Update review
   */
  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.templateReview.findFirst({
      where: { id: reviewId, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.templateReview.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
      },
    });

    // Update average rating
    await this.updateAverageRating(review.marketplaceTemplateId!);

    return updated;
  }

  /**
   * Delete review
   */
  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.templateReview.findFirst({
      where: { id: reviewId, userId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    await this.prisma.templateReview.delete({
      where: { id: reviewId },
    });

    // Update average rating
    await this.updateAverageRating(review.marketplaceTemplateId!);

    return { success: true };
  }

  /**
   * Update average rating for template
   */
  private async updateAverageRating(marketplaceTemplateId: string) {
    const result = await this.prisma.templateReview.aggregate({
      where: { marketplaceTemplateId },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.templateMarketplace.update({
      where: { id: marketplaceTemplateId },
      data: {
        rating: result._avg.rating || 0,
        averageRating: result._avg.rating || 0,
      },
    });
  }

  /**
   * Get seller's templates
   */
  async getSellerTemplates(sellerId: string) {
    const templates = await this.prisma.templateMarketplace.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });

    return templates;
  }

  /**
   * Get seller statistics
   */
  async getSellerStats(sellerId: string) {
    const [totalTemplates, totalDownloads, totalRevenue, averageRating] = await Promise.all([
      this.prisma.templateMarketplace.count({ where: { sellerId } }),
      this.prisma.templateMarketplace.aggregate({
        where: { sellerId },
        _sum: { downloadCount: true },
      }),
      this.prisma.templatePurchase.aggregate({
        where: { marketplaceTemplateId: sellerId },
        _sum: { price: true },
      }),
      this.prisma.templateMarketplace.aggregate({
        where: { sellerId },
        _avg: { averageRating: true },
      }),
    ]);

    return {
      totalTemplates,
      totalDownloads: totalDownloads._sum.downloadCount || 0,
      totalRevenue: totalRevenue._sum.price || 0,
      averageRating: averageRating._avg.averageRating || 0,
    };
  }

  /**
   * Get user's purchases
   */
  async getUserPurchases(userId: string) {
    const purchases = await this.prisma.templatePurchase.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return purchases;
  }

  /**
   * Report template
   */
  async reportTemplate(userId: string, dto: ReportTemplateDto) {
    const marketplace = await this.prisma.templateMarketplace.findUnique({
      where: { id: dto.marketplaceTemplateId },
    });

    if (!marketplace) {
      throw new NotFoundException('Marketplace template not found');
    }

    const report = await this.prisma.templateReport.create({
      data: {
        templateId: marketplace.templateId,
        reportedBy: userId,
        reason: dto.reason || '',
      },
    });

    return report;
  }

  /**
   * Admin: Review template submission
   */
  async reviewSubmission(adminId: string, listingId: string, approved: boolean, feedback?: string) {
    const listing = await this.prisma.templateMarketplace.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const updated = await this.prisma.templateMarketplace.update({
      where: { id: listingId },
      data: {
        status: approved ? TemplateStatus.APPROVED : TemplateStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        reviewFeedback: feedback,
      },
    });

    return updated;
  }
}
