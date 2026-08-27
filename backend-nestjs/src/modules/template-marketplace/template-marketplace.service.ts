import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
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
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-06-20',
    });
  }

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
        title: dto.title || dto.name || template.name,
        description: dto.description || template.description,
        category: this.mapCategory(dto.category),
        tags: dto.tags || [],
        price: dto.price || 0,
        priceType: this.resolvePriceType(dto.priceType, dto.price),
        published: true,
        status: 'published',
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
        category: dto.category ? this.mapCategory(dto.category) : undefined,
        tags: dto.tags,
        price: dto.price,
        priceType:
          dto.price !== undefined ? this.resolvePriceType(undefined, dto.price) : undefined,
      },
    });

    return updated;
  }

  /**
   * Search marketplace templates
   */
  async searchTemplates(dto: SearchMarketplaceDto) {
    const query = dto.query || dto.search;
    const { category, priceType, minRating, tags, sortBy, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        {
          OR: [{ status: { in: ['approved', 'published'] } }, { published: true }],
        },
      ],
    };

    if (query) {
      where.AND.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (category && category !== 'all') {
      where.AND.push({ category: this.mapCategory(category) });
    }

    if (priceType && priceType !== 'all') {
      if (priceType === 'free') {
        where.AND.push({ OR: [{ priceType: TemplatePriceType.FREE }, { price: 0 }] });
      } else {
        where.AND.push({ price: { gt: 0 } });
      }
    }

    if (minRating) {
      where.AND.push({ averageRating: { gte: Number(minRating) } });
    }

    if (tags?.length) {
      where.AND.push({ tags: { hasSome: tags } });
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
          seller: { select: { id: true, name: true, firstName: true, lastName: true } },
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.templateMarketplace.count({ where }),
    ]);

    return {
      data: templates.map((listing) => this.serializeListing(listing)),
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
        seller: { select: { id: true, name: true, firstName: true, lastName: true } },
        reviews: {
          include: {
            user: { select: { id: true, name: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!listing) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.templateMarketplace.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });

    let hasPurchased = false;
    if (userId) {
      const purchase = await this.prisma.templatePurchase.findFirst({
        where: { marketplaceTemplateId: listingId, buyerId: userId, status: 'completed' },
      });
      hasPurchased = !!purchase;
    }

    return {
      ...this.serializeListing(listing),
      hasPurchased,
      reviews: listing.reviews.map((review) => ({
        id: review.id,
        templateId: listing.id,
        userId: review.userId || review.reviewerId,
        userName: this.sellerDisplayName(review.user),
        rating: review.rating,
        comment: review.content || review.text || '',
        createdAt: review.createdAt,
      })),
    };
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit: number = 10) {
    const featured = await this.prisma.templateMarketplace.findMany({
      where: {
        ...this.publicListingWhere(),
        isFeatured: true,
      },
      take: limit,
      orderBy: { featuredAt: 'desc' },
      include: {
        seller: { select: { id: true, name: true, firstName: true, lastName: true } },
        _count: { select: { reviews: true } },
      },
    });

    if (featured.length > 0) {
      return featured.map((listing) => this.serializeListing(listing));
    }

    const popular = await this.prisma.templateMarketplace.findMany({
      where: this.publicListingWhere(),
      take: limit,
      orderBy: { downloadCount: 'desc' },
      include: {
        seller: { select: { id: true, name: true, firstName: true, lastName: true } },
        _count: { select: { reviews: true } },
      },
    });

    return popular.map((listing) => this.serializeListing(listing));
  }

  /**
   * Get popular templates by category
   */
  async getPopularByCategory(category: string, limit: number = 10) {
    const templates = await this.prisma.templateMarketplace.findMany({
      where: {
        ...this.publicListingWhere(),
        category: this.mapCategory(category),
      },
      take: limit,
      orderBy: { downloadCount: 'desc' },
      include: {
        seller: { select: { id: true, name: true, firstName: true, lastName: true } },
        _count: { select: { reviews: true } },
      },
    });

    return templates.map((listing) => this.serializeListing(listing));
  }

  /**
   * Purchase/download template
   */
  async purchaseTemplate(userId: string, dto: PurchaseTemplateDto) {
    const listingId = dto.marketplaceTemplateId || dto.templateId;
    if (!listingId) {
      throw new BadRequestException('Template id is required');
    }

    const listing = await this.prisma.templateMarketplace.findUnique({
      where: { id: listingId },
      include: { template: true },
    });

    if (!listing) {
      throw new NotFoundException('Template not found');
    }

    if (listing.sellerId === userId || listing.publishedBy === userId) {
      throw new BadRequestException('You cannot purchase your own template');
    }

    const completedPurchase = await this.prisma.templatePurchase.findFirst({
      where: { marketplaceTemplateId: listingId, buyerId: userId, status: 'completed' },
    });

    if (completedPurchase) {
      return { alreadyPurchased: true, purchase: completedPurchase };
    }

    const isPaid =
      listing.price > 0 &&
      this.resolvePriceType(listing.priceType, listing.price) !== TemplatePriceType.FREE;

    if (!isPaid) {
      return this.fulfillFreeOrPaidPurchase(userId, listing);
    }

    if (!this.configService.get<string>('STRIPE_SECRET_KEY')) {
      throw new BadRequestException('Payments are not configured');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const successUrl =
      dto.successUrl || `${frontendUrl}/documents?tab=marketplace&purchase=success`;
    const cancelUrl =
      dto.cancelUrl || `${frontendUrl}/documents?tab=marketplace&purchase=cancelled`;

    let purchase = await this.prisma.templatePurchase.findFirst({
      where: { marketplaceTemplateId: listingId, buyerId: userId, status: 'pending' },
    });

    if (!purchase) {
      purchase = await this.prisma.templatePurchase.create({
        data: {
          marketplaceTemplateId: listingId,
          buyerId: userId,
          templateId: listing.templateId,
          price: listing.price,
          currency: 'USD',
          status: 'pending',
        },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: listing.title || listing.template.name },
            unit_amount: Math.round(listing.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'template_purchase',
        purchaseId: purchase.id,
        marketplaceTemplateId: listingId,
        buyerId: userId,
      },
    });

    await this.prisma.templatePurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return {
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
      purchaseId: purchase.id,
    };
  }

  async fulfillPaidPurchase(session: Stripe.Checkout.Session) {
    const purchaseId = session.metadata?.purchaseId;
    const sessionPurchase = purchaseId
      ? await this.prisma.templatePurchase.findUnique({ where: { id: purchaseId } })
      : await this.prisma.templatePurchase.findFirst({
          where: { stripeCheckoutSessionId: session.id },
        });

    if (!sessionPurchase) {
      return null;
    }

    if (sessionPurchase.status === 'completed') {
      return sessionPurchase;
    }

    const listingId = sessionPurchase.marketplaceTemplateId;
    if (!listingId) {
      throw new NotFoundException('Marketplace template not found');
    }

    const listing = await this.prisma.templateMarketplace.findUnique({
      where: { id: listingId },
      include: { template: true },
    });

    if (!listing) {
      throw new NotFoundException('Marketplace template not found');
    }

    return this.completePurchase(sessionPurchase.buyerId, listing, sessionPurchase.id, session.id);
  }

  /**
   * Create review
   */
  async createReview(userId: string, dto: CreateReviewDto) {
    // Verify purchase
    const purchase = await this.prisma.templatePurchase.findFirst({
      where: {
        marketplaceTemplateId: dto.marketplaceTemplateId,
        buyerId: userId,
        status: 'completed',
      },
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
    const listings = await this.prisma.templateMarketplace.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { reviews: true } } },
    });
    const listingIds = listings.map((listing) => listing.id);

    const [totalDownloads, totalRevenue, averageRating] = await Promise.all([
      this.prisma.templateMarketplace.aggregate({
        where: { sellerId },
        _sum: { downloadCount: true },
      }),
      listingIds.length
        ? this.prisma.templatePurchase.aggregate({
            where: { marketplaceTemplateId: { in: listingIds }, status: 'completed' },
            _sum: { price: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { price: 0 }, _count: 0 }),
      this.prisma.templateMarketplace.aggregate({
        where: { sellerId },
        _avg: { averageRating: true },
      }),
    ]);

    const avgRating = averageRating._avg.averageRating || 0;
    const salesCount = typeof totalRevenue._count === 'number' ? totalRevenue._count : 0;

    return {
      totalTemplates: listings.length,
      publishedTemplates: listings.length,
      totalDownloads: totalDownloads._sum.downloadCount || 0,
      totalSales: salesCount,
      totalRevenue: totalRevenue._sum.price || 0,
      averageRating: avgRating,
      avgRating,
      templates: listings.map((listing) => ({
        ...this.serializeListing(listing),
        status: listing.status,
        downloads: listing.downloadCount || listing.downloads || 0,
      })),
    };
  }

  /**
   * Get user's purchases
   */
  async getUserPurchases(userId: string) {
    const purchases = await this.prisma.templatePurchase.findMany({
      where: { buyerId: userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    const listingIds = purchases
      .map((purchase) => purchase.marketplaceTemplateId)
      .filter((id): id is string => !!id);

    const listings = listingIds.length
      ? await this.prisma.templateMarketplace.findMany({
          where: { id: { in: listingIds } },
        })
      : [];
    const listingById = new Map(listings.map((listing) => [listing.id, listing]));

    return purchases.map((purchase) => {
      const listing = listingById.get(purchase.marketplaceTemplateId || '');
      return {
        ...purchase,
        template: {
          name: listing?.title || 'Template',
          description: listing?.description || '',
        },
      };
    });
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

  private publicListingWhere() {
    return {
      OR: [{ status: { in: ['approved', 'published'] } }, { published: true }],
    };
  }

  private resolvePriceType(priceType?: string | null, price?: number) {
    const paidLabel =
      priceType === 'one_time' ||
      priceType === TemplatePriceType.PAID ||
      priceType === TemplatePriceType.PREMIUM;
    if ((price && price > 0) || (paidLabel && (price || 0) > 0)) {
      return TemplatePriceType.PAID;
    }
    return TemplatePriceType.FREE;
  }

  private mapCategory(category?: string) {
    if (!category) {
      return TemplateCategory.OTHER;
    }

    const key = category
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    const aliases: Record<string, TemplateCategory> = {
      BUSINESS: TemplateCategory.BUSINESS,
      BUSINESS_PROPOSAL: TemplateCategory.BUSINESS,
      SALES: TemplateCategory.SALES,
      SALES_PROPOSAL: TemplateCategory.SALES,
      MARKETING: TemplateCategory.MARKETING,
      CONSULTING: TemplateCategory.CONSULTING,
      WEB_DEVELOPMENT: TemplateCategory.TECHNOLOGY,
      TECHNOLOGY: TemplateCategory.TECHNOLOGY,
      DESIGN: TemplateCategory.CREATIVE,
      CREATIVE: TemplateCategory.CREATIVE,
      LEGAL: TemplateCategory.LEGAL,
      REAL_ESTATE: TemplateCategory.REAL_ESTATE,
      FINANCIAL: TemplateCategory.FINANCE,
      FINANCE: TemplateCategory.FINANCE,
      HEALTHCARE: TemplateCategory.HEALTHCARE,
      EDUCATION: TemplateCategory.EDUCATION,
      OTHER: TemplateCategory.OTHER,
    };

    return aliases[key] || TemplateCategory.OTHER;
  }

  private sellerDisplayName(
    seller?: { name?: string | null; firstName?: string | null; lastName?: string | null } | null,
  ) {
    if (!seller) {
      return 'Seller';
    }
    const fullName = [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim();
    return seller.name || fullName || 'Seller';
  }

  private serializeListing(listing: any) {
    const price = listing.price || 0;
    const priceType = this.resolvePriceType(listing.priceType, price);

    return {
      id: listing.id,
      name: listing.title || listing.template?.name || 'Untitled template',
      title: listing.title,
      description: listing.description || '',
      category: listing.category,
      price,
      priceType: priceType === TemplatePriceType.FREE ? 'free' : 'one_time',
      previewImage: listing.template?.thumbnail,
      rating: Number(listing.averageRating || listing.rating || 0),
      reviewCount: listing._count?.reviews || 0,
      downloads: listing.downloadCount || listing.downloads || 0,
      sellerId: listing.sellerId,
      sellerName: this.sellerDisplayName(listing.seller),
      isFeatured: listing.isFeatured,
      tags: listing.tags || [],
      createdAt: listing.createdAt,
    };
  }

  private async fulfillFreeOrPaidPurchase(userId: string, listing: any) {
    const purchase = await this.prisma.templatePurchase.create({
      data: {
        marketplaceTemplateId: listing.id,
        buyerId: userId,
        templateId: listing.templateId,
        price: listing.price || 0,
        currency: 'USD',
        status: 'pending',
      },
    });

    return this.completePurchase(userId, listing, purchase.id);
  }

  private async completePurchase(
    userId: string,
    listing: any,
    purchaseId: string,
    stripeCheckoutSessionId?: string,
  ) {
    const clonedTemplate = await this.prisma.template.create({
      data: {
        userId,
        name: `${listing.title || listing.template?.name || 'Template'} (Copy)`,
        description: listing.description,
        content: listing.template.content as any,
        category: listing.category,
        sourceMarketplaceId: listing.id,
      },
    });

    await this.prisma.templateMarketplace.update({
      where: { id: listing.id },
      data: {
        downloadCount: { increment: 1 },
        downloads: { increment: 1 },
      },
    });

    const purchase = await this.prisma.templatePurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'completed',
        ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
      },
    });

    return {
      purchase,
      template: clonedTemplate,
    };
  }
}
