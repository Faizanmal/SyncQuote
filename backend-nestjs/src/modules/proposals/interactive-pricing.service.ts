import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import Stripe from 'stripe';
import {
    UpdatePricingSelectionsDto,
    PricingCalculationResultDto,
    PricingItemSelectionDto,
} from './dto/interactive-pricing.dto';

@Injectable()
export class InteractivePricingService {
    private readonly logger = new Logger(InteractivePricingService.name);
    private stripe: Stripe;

    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
    ) {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
            this.stripe = new Stripe(stripeSecretKey);
        }
    }

    /**
     * Calculate pricing based on client selections (real-time, no persistence)
     */
    async calculatePricing(
        slug: string,
        dto: UpdatePricingSelectionsDto,
    ): Promise<PricingCalculationResultDto> {
        // Get proposal with pricing items
        const proposal = await this.prisma.proposal.findUnique({
            where: { slug },
            include: {
                blocks: {
                    where: { type: 'PRICING_TABLE' },
                    include: {
                        pricingItems: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                user: {
                    select: { stripeConnectId: true },
                },
            },
        });

        if (!proposal) {
            throw new NotFoundException('Proposal not found');
        }

        // Flatten all pricing items from all blocks
        const allPricingItems = proposal.blocks.flatMap((block) => block.pricingItems);

        // Create a map for quick lookup
        const selectionsMap = new Map(
            dto.selections.map((s) => [s.itemId, s]),
        );

        // Calculate line items
        const lineItems = allPricingItems.map((item) => {
            const selection = selectionsMap.get(item.id);
            let selected = true;
            let quantity = 1;

            if (item.type === 'OPTIONAL') {
                selected = selection?.selected ?? false;
            } else if (item.type === 'QUANTITY') {
                selected = true;
                quantity = selection?.quantity ?? item.minQuantity;
                // Clamp quantity to min/max
                quantity = Math.max(item.minQuantity, Math.min(item.maxQuantity, quantity));
            }
            // FIXED items are always selected with quantity 1

            return {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity,
                selected,
                lineTotal: selected ? item.price * quantity : 0,
            };
        });

        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const taxRate = proposal.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Calculate deposit if required
        let depositAmount: number | undefined;
        if (proposal.depositRequired) {
            if (proposal.depositAmount) {
                depositAmount = proposal.depositAmount;
            } else if (proposal.depositPercentage) {
                depositAmount = total * (proposal.depositPercentage / 100);
            }
        }

        const result: PricingCalculationResultDto = {
            subtotal,
            taxAmount,
            total,
            depositAmount,
            lineItems,
            currency: proposal.currency,
        };

        // Update Stripe Payment Intent if needed
        if (proposal.depositRequired && depositAmount && this.stripe) {
            try {
                const paymentIntentClientSecret = await this.updatePaymentIntent(
                    proposal,
                    depositAmount,
                );
                if (paymentIntentClientSecret) {
                    result.paymentIntentClientSecret = paymentIntentClientSecret;
                }
            } catch (error) {
                this.logger.error('Failed to update Payment Intent', error);
            }
        }

        // Notify proposal owner of pricing interaction
        await this.notifyPricingUpdate(proposal.userId, proposal.id, result);

        return result;
    }

    /**
     * Update Stripe Payment Intent with new amount
     */
    private async updatePaymentIntent(
        proposal: any,
        depositAmount: number,
    ): Promise<string | null> {
        if (!this.stripe) return null;

        const amountInCents = Math.round(depositAmount * 100);

        try {
            if (proposal.stripePaymentIntentId) {
                // Update existing Payment Intent
                const paymentIntent = await this.stripe.paymentIntents.update(
                    proposal.stripePaymentIntentId,
                    {
                        amount: amountInCents,
                        metadata: {
                            updatedAt: new Date().toISOString(),
                            proposalId: proposal.id,
                        },
                    },
                );
                return paymentIntent.client_secret;
            } else {
                // Create new Payment Intent
                const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
                    amount: amountInCents,
                    currency: proposal.currency?.toLowerCase() || 'usd',
                    metadata: {
                        proposalId: proposal.id,
                        proposalSlug: proposal.slug,
                        type: 'deposit',
                    },
                };

                // If user has Stripe Connect, use their account
                if (proposal.user?.stripeConnectId) {
                    paymentIntentParams.transfer_data = {
                        destination: proposal.user.stripeConnectId,
                    };
                }

                const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

                // Store the Payment Intent ID
                await this.prisma.proposal.update({
                    where: { id: proposal.id },
                    data: { stripePaymentIntentId: paymentIntent.id },
                });

                return paymentIntent.client_secret;
            }
        } catch (error) {
            this.logger.error('Stripe Payment Intent error:', error);
            throw new BadRequestException('Failed to update payment');
        }
    }

    /**
     * Notify the proposal owner about pricing updates
     */
    private async notifyPricingUpdate(
        userId: string,
        proposalId: string,
        result: PricingCalculationResultDto,
    ): Promise<void> {
        this.eventsGateway.sendToUser(userId, 'pricing_updated', {
            proposalId,
            total: result.total,
            subtotal: result.subtotal,
            depositAmount: result.depositAmount,
            timestamp: new Date(),
        });
    }

    /**
     * Get current pricing breakdown for a proposal
     */
    async getPricingBreakdown(slug: string): Promise<PricingCalculationResultDto> {
        // Return calculation with all fixed items selected, optional items unselected
        return this.calculatePricing(slug, { selections: [] });
    }
}
