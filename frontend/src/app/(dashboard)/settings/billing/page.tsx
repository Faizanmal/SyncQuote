'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore, type AuthState } from '@/lib/auth';
import { api } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';
import {
  CreditCard,
  Check,
  Zap,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Subscription {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan: 'free' | 'pro' | 'enterprise';
  trialEndsAt?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

const plans = [
  {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      '5 proposals per month',
      'Basic templates',
      'Email support',
      '1 user',
    ],
    priceId: null,
  },
  {
    name: 'Pro',
    price: 29,
    interval: 'month',
    features: [
      'Unlimited proposals',
      'Advanced templates',
      'Priority support',
      'Up to 5 users',
      'Custom branding',
      'Analytics dashboard',
      'Stripe Connect integration',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Unlimited users',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom integrations',
      'Advanced security',
      'SSO (SAML)',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  },
];

export default function BillingPage() {
  const user = useAuthStore((state: AuthState) => state.user);
  const [isLoading, setIsLoading] = useState(false);

  const { data: subscription } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await api.get('/billing/subscription');
      return response.data;
    },
  });

  const { data: paymentMethod } = useQuery<PaymentMethod>({
    queryKey: ['payment-method'],
    queryFn: async () => {
      const response = await api.get('/billing/payment-method');
      return response.data;
    },
  });

  const createCheckoutSession = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await api.post('/billing/create-checkout-session', {
        priceId,
        successUrl: `${window.location.origin}/settings/billing?success=true`,
        cancelUrl: `${window.location.origin}/settings/billing?canceled=true`,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      const stripe = await stripePromise;
      if (!stripe) {
        toast.error('Stripe failed to load');
        return;
      }
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });
      if (error) {
        toast.error(error.message);
      }
    },
    onError: () => {
      toast.error('Failed to start checkout');
    },
  });

  const createPortalSession = useMutation({
    mutationFn: async () => {
      const response = await api.post('/billing/create-portal-session', {
        returnUrl: `${window.location.origin}/settings/billing`,
      });
      return response.data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error('Failed to open billing portal');
    },
  });

  const handleSubscribe = (priceId: string | null) => {
    if (!priceId) return;
    setIsLoading(true);
    createCheckoutSession.mutate(priceId, {
      onSettled: () => setIsLoading(false),
    });
  };

  const handleManageBilling = () => {
    createPortalSession.mutate();
  };

  const currentPlan = subscription?.plan || 'free';
  const isTrialing = subscription?.status === 'trialing';
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.ceil(
        (new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Billing & Subscription
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Trial Alert */}
      {isTrialing && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            You have {trialDaysLeft} days left in your free trial. Subscribe to continue using Pro features.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Subscription */}
      {subscription && subscription.plan !== 'free' && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your active plan and billing details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold capitalize">{subscription.plan} Plan</p>
                  <p className="text-sm text-gray-600">
                    Status:{' '}
                    <Badge
                      variant={
                        subscription.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {subscription.status}
                    </Badge>
                  </p>
                </div>
                <Button variant="outline" onClick={handleManageBilling}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Billing
                </Button>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Current period ends</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(subscription.currentPeriodEnd), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {paymentMethod && (
                  <div>
                    <p className="text-gray-600">Payment method</p>
                    <p className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {paymentMethod.brand} ···· {paymentMethod.last4}
                    </p>
                  </div>
                )}
              </div>

              {subscription.cancelAtPeriodEnd && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Your subscription will be canceled at the end of the current period.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Choose Your Plan</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentPlan;

            return (
              <Card
                key={plan.name}
                className={`relative ${
                  plan.popular ? 'border-blue-500 border-2' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {isCurrent && <Badge variant="secondary">Current</Badge>}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600">/{plan.interval}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {!isCurrent && plan.priceId && (
                    <Button
                      onClick={() => handleSubscribe(plan.priceId!)}
                      disabled={isLoading}
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {isLoading ? (
                        'Processing...'
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Upgrade to {plan.name}
                        </>
                      )}
                    </Button>
                  )}

                  {isCurrent && (
                    <Button disabled className="w-full" variant="secondary">
                      Current Plan
                    </Button>
                  )}

                  {!isCurrent && !plan.priceId && (
                    <Button disabled className="w-full" variant="outline">
                      Current Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing History */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and download your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No invoices yet</p>
            <Button
              variant="link"
              onClick={handleManageBilling}
              className="mt-2"
            >
              View billing portal for full history
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
