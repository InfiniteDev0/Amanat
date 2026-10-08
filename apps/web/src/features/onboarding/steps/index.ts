import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

import type { OnboardingDraft } from '../draft';
import {
  type StepProblem,
  validateAccounts,
  validateCurrencies,
  validateProfile,
  validateRates,
  validateShop,
} from '../validate';

/** What every step component gets from the wizard. */
export interface StepProps {
  draft: OnboardingDraft;
  update: (change: (draft: OnboardingDraft) => OnboardingDraft) => void;
  /** The one problem to show (already translated), or null. */
  problem: { field: string; text: string } | null;
  /** Jump to another step by id (the review's Edit links). */
  goTo: (stepId: string) => void;
}

export interface Step {
  id: string;
  /** Checked when Continue is pressed; the first problem stops the step. */
  validate?: (draft: OnboardingDraft) => StepProblem | null;
  skippable?: boolean;
  /** What Skip leaves behind (skipping the rates clears any half-typed ones). */
  onSkip?: (draft: OnboardingDraft) => OnboardingDraft;
  /** The step's code, fetched only when the step is reached (or about to be). */
  load: () => Promise<{ default: ComponentType<StepProps> }>;
  Component: LazyExoticComponent<ComponentType<StepProps>>;
}

function step(definition: Omit<Step, 'Component'>): Step {
  return { ...definition, Component: lazy(definition.load) };
}

/**
 * The spec's first-time owner flow, in order: who you are, the shop, what it
 * trades, its accounts and opening balances, today's rates, then a look at
 * all of it before it's saved. Every answer shows up in the app.
 */
export const STEPS: Step[] = [
  step({ id: 'welcome', load: () => import('./welcome-step') }),
  step({ id: 'profile', validate: validateProfile, load: () => import('./profile-step') }),
  step({ id: 'shop', validate: validateShop, load: () => import('./shop-step') }),
  step({ id: 'currencies', validate: validateCurrencies, load: () => import('./currencies-step') }),
  step({ id: 'accounts', validate: validateAccounts, load: () => import('./accounts-step') }),
  // Skippable: Home then says "Rates not set → Set now" in the morning.
  step({
    id: 'rates',
    validate: validateRates,
    skippable: true,
    onSkip: (draft) => ({ ...draft, rates: {} }),
    load: () => import('./rates-step'),
  }),
  step({ id: 'review', load: () => import('./review-step') }),
];
