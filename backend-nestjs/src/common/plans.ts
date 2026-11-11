export type PlanId = 'free' | 'pro' | 'enterprise';

export type PlanLimits = {
  id: PlanId;
  name: string;
  /** null = unlimited */
  maxProposalsPerMonth: number | null;
  maxTeamMembers: number | null;
  customBranding: boolean;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    id: 'free',
    name: 'Free',
    maxProposalsPerMonth: 5,
    maxTeamMembers: 1,
    customBranding: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxProposalsPerMonth: null,
    maxTeamMembers: 5,
    customBranding: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    maxProposalsPerMonth: null,
    maxTeamMembers: null,
    customBranding: true,
  },
};

export function resolveEffectivePlan(input: {
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
  planFromStripe?: PlanId | null;
}): PlanId {
  const status = input.subscriptionStatus || 'TRIAL';
  const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
  const trialActive = status === 'TRIAL' && !!trialEndsAt && trialEndsAt > new Date();

  // Active trial gets Pro limits so design partners can evaluate fully.
  if (trialActive) {
    return 'pro';
  }

  if (status === 'ACTIVE' || status === 'PAST_DUE') {
    return input.planFromStripe || 'pro';
  }

  return 'free';
}

export function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
