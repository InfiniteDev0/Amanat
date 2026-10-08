// The paid plans, shown in the plans dialog. Prices in US dollars.
//
// PROVISIONAL: the spec has no plans yet. Names and prices are the user's:
// Pro $49.99 a month, Team $89.99; yearly is ten months' price for twelve
// (about 17% off): $499.99 and $899.99. What
// each plan includes is placeholder wording to be confirmed. There is no
// payment provider yet, so choosing a plan changes nothing.

export const BILLING_PERIODS = ['monthly', 'yearly'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export type PlanFeature =
  | 'oneShop'
  | 'unlimitedEntries'
  | 'threeMembers'
  | 'dailySummary'
  | 'excel'
  | 'pushAlerts'
  | 'manyShops'
  | 'allShops'
  | 'unlimitedMembers'
  | 'shopTransfers'
  | 'smsSummary'
  | 'prioritySupport';

export interface Plan {
  id: 'pro' | 'team';
  price: Record<BillingPeriod, number>;
  popular: boolean;
  /** Message keys under plans.features. */
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    id: 'pro',
    price: { monthly: 49.99, yearly: 499.99 },
    popular: true,
    features: ['oneShop', 'unlimitedEntries', 'threeMembers', 'dailySummary', 'excel', 'pushAlerts'],
  },
  {
    id: 'team',
    price: { monthly: 89.99, yearly: 899.99 },
    popular: false,
    features: ['manyShops', 'allShops', 'unlimitedMembers', 'shopTransfers', 'smsSummary', 'prioritySupport'],
  },
];
