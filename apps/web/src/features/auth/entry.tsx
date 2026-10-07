'use client';

import { Tabs } from '@heroui/react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { directionOf } from '@/i18n/routing';

import { type AuthMode, useAuthFlow } from './auth-flow';
import { LogInForm } from './log-in-form';
import { SignUpForm } from './sign-up-form';

// HeroUI tabs on our tokens: a filled track, the brand-blue indicator slides
// between the tabs. No hover colour, no border, no shadow.
const listClassName = [
  'w-full rounded-xl bg-field p-1',
  '**:data-[slot=tabs-tab]:h-9',
  '**:data-[slot=tabs-tab]:rounded-lg',
  '**:data-[slot=tabs-tab]:bg-transparent',
  '**:data-[slot=tabs-tab]:text-muted-foreground',
  '**:data-[slot=tabs-tab]:opacity-100',
  '**:data-[slot=tabs-tab]:transition-colors',
  '**:data-[slot=tabs-tab]:data-[focus-visible=true]:outline-2',
  '**:data-[slot=tabs-tab]:data-[focus-visible=true]:outline-primary/60',
  '**:data-[slot=tabs-tab]:data-[selected=true]:font-semibold',
  '**:data-[slot=tabs-tab]:data-[selected=true]:text-primary-foreground',
  '**:data-[slot=tabs-tab]:shadow-none',
  '**:data-[slot=tabs-indicator]:rounded-lg',
  '**:data-[slot=tabs-indicator]:bg-primary',
  '**:data-[slot=tabs-indicator]:shadow-none',
].join(' ');

// Both forms stay mounted so switching tabs keeps what was typed; the inactive
// panel is inert, and hidden here.
const panelClassName = 'mt-6 p-0 data-[inert=true]:hidden';

/**
 * Step 1: "Welcome to Amanat" with the Sign up / Log in tabs. The title and
 * tabs never move (the column is anchored at the top, not centred); only the
 * form below changes, sliding in from the side of the tab you picked.
 */
export function Entry() {
  const t = useTranslations();
  const { mode, setMode } = useAuthFlow();

  return (
    <div className="mx-auto w-full max-w-100 pt-[6vh] pb-10">
      {/* .hero: Luxurious Roman (one weight, so no bold) */}
      <h1 className="hero text-center text-4xl">{t('auth.welcome', { name: t('brand.name') })}</h1>
      <p className="text-muted-foreground mt-2 text-center text-sm">{t('brand.tagline')}</p>

      <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(key as AuthMode)} className="mt-8 w-full gap-0">
        <Tabs.List aria-label={t('auth.mode')} className={listClassName}>
          <Tabs.Tab id="signup">
            {t('auth.signUp')}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="login">
            {t('auth.logIn')}
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="signup" shouldForceMount className={panelClassName}>
          <FormSwap active={mode === 'signup'} from={-1}>
            <SignUpForm />
          </FormSwap>
        </Tabs.Panel>
        <Tabs.Panel id="login" shouldForceMount className={panelClassName}>
          <FormSwap active={mode === 'login'} from={1}>
            <LogInForm />
          </FormSwap>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

/** Slides a form in from its tab's side (-1 start, 1 end) as it becomes active. */
function FormSwap({ active, from, children }: { active: boolean; from: -1 | 1; children: ReactNode }) {
  const reduce = useReducedMotion();
  const rtl = directionOf(useLocale()) === 'rtl';
  const offset = reduce ? 0 : from * (rtl ? -1 : 1) * 24;
  return (
    <motion.div
      initial={false}
      animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: offset }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
    >
      {children}
    </motion.div>
  );
}
