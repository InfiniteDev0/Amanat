// The paid plans, shown in the plans dialog. Prices in whole US dollars.
//
// PROVISIONAL: the spec has no plans yet. Names and prices are the user's
// (Pro $30 a month or $250 a year, Team $40 a month or $300 a year); what
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
    price: { monthly: 30, yearly: 250 },
    popular: true,
    features: ['oneShop', 'unlimitedEntries', 'threeMembers', 'dailySummary', 'excel', 'pushAlerts'],
  },
  {
    id: 'team',
    price: { monthly: 40, yearly: 300 },
    popular: false,
    features: ['manyShops', 'allShops', 'unlimitedMembers', 'shopTransfers', 'smsSummary', 'prioritySupport'],
  },
];
