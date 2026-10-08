'use client';

import { gooeyToast } from 'goey-toast';
import { CheckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ReactElement, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { BILLING_PERIODS, type BillingPeriod, PLANS } from './plans';

/** "$49.99", read left to right. */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * "Choose a plan": the plans side by side, a Monthly / Yearly switch at the
 * top, and Go back. `trigger` is the element that opens it (rendered as the
 * dialog's trigger).
 */
export function PlansDialog({ trigger }: { trigger: ReactElement }) {
  const t = useTranslations('plans');
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DialogTitle>{t('title')}</DialogTitle>
          {/* Monthly or yearly: the white pill slides to the one picked. */}
          <div role="tablist" aria-label={t('period')} className="bg-field flex rounded-xl p-1">
            {BILLING_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={period === value}
                onClick={() => setPeriod(value)}
                className={cn('relative h-8 rounded-lg px-4 text-sm font-medium transition-colors', period === value ? 'text-primary-foreground' : 'text-muted-foreground')}
              >
                {period === value ? (
                  <motion.span layoutId="plan-period" transition={{ type: 'spring', duration: 0.3, bounce: 0 }} className="bg-primary absolute inset-0 rounded-lg" />
                ) : null}
                <span className="relative">{t(value)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-pill -mx-1 mt-5 grid min-h-0 gap-3 overflow-y-auto px-1 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <section key={plan.id} aria-labelledby={`plan-${plan.id}`} className="border-border flex flex-col rounded-2xl border p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 id={`plan-${plan.id}`} className="text-xl font-medium">
                  {t(`names.${plan.id}`)}
                </h3>
                {plan.popular ? <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-xs font-medium">{t('popular')}</span> : null}
              </div>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    {t(`features.${feature}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <p className="text-2xl font-medium">
                  <bdi dir="ltr">{usd.format(plan.price[period])}</bdi>
                </p>
                <p className="text-muted-foreground text-xs">{t(period === 'monthly' ? 'perMonth' : 'perYear')}</p>
              </div>
              <Button
                type="button"
                className="mt-4 h-10 w-full rounded-lg"
                onClick={() => {
                  setOpen(false);
                  gooeyToast.success(t('chosen', { plan: t(`names.${plan.id}`) }), { description: t('chosenDescription') });
                }}
              >
                {t('select')}
              </Button>
            </section>
          ))}
        </div>

        <div className="mt-5 flex justify-center">
          <DialogClose render={<Button type="button" variant="outline" className="h-9 rounded-lg px-4" />}>{t('back')}</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
