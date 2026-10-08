'use client';

import { type CurrencyCode, ratedCurrencies } from '@sarrif/core';
import { useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { StatCard } from '@/components/stat-card';
import { formatMarket } from '@/features/rates/format-market';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { currencyFlag } from '@/lib/currency-flag';

import { useDaySummary } from './queries';

/**
 * A thin strip across the top of the panel, one line, on the pink-to-indigo
 * gradient (#ff00cc → #333399, the colour fallback first), while today's
 * rates are missing: what's missing, and Set rates at the end (`onSet`
 * opens the dialog for every currency). Nothing on a past day.
 */
export function RatesBanner({ isToday, onSet }: { isToday: boolean; onSet: (currencies: CurrencyCode[]) => void }) {
  const t = useTranslations('home');
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id);
  const missing = summary.data?.missingRates ?? [];
  if (!isToday || missing.length === 0) return null;

  return (
    <div role="status" className="flex h-11 shrink-0 items-center gap-3 bg-[#ff00cc] bg-[linear-gradient(to_left,#333399,#ff00cc)] ps-4 pe-2 text-sm text-white lg:ps-6">
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{t('ratesMissingTitle')}</span>
        <span className="text-white/85"> · {t('ratesMissingBody', { currencies: missing.join(', ') })}</span>
      </p>
      <button
        type="button"
        onClick={() => onSet(ratedCurrencies(workspace))}
        className="h-7 shrink-0 rounded-full bg-white px-3.5 text-xs font-semibold text-black transition-colors outline-none hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {t('setRates')}
      </button>
    </div>
  );
}

/**
 * The day's rates that are set, one card each: buy / sell for 1 base.
 * Today, clicking a card changes just that rate (`onEdit`); a past day's are
 * read-only.
 */
export function RateCards({ date, isToday, onEdit }: { date: string | undefined; isToday: boolean; onEdit: (currencies: CurrencyCode[]) => void }) {
  const t = useTranslations('home');
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id, date);
  if (!summary.data) return null;
  const { board } = summary.data;
  const set = ratedCurrencies(workspace).filter((code) => board.rates[code]);
  if (set.length === 0) return null;

  return (
    <section aria-label={t('rates')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {set.map((code) => {
        const pair = board.rates[code]!;
        return (
          <StatCard
            key={code}
            badge={code}
            icon={<Flag code={currencyFlag(code)} className="h-3" />}
            tone="orange"
            value={
              <bdi dir="ltr">
                {formatMarket(pair.buy)}
                <span className="mx-1.5 text-base font-medium opacity-50">/</span>
                {formatMarket(pair.sell)}
              </bdi>
            }
            caption={t('rateCaption', { base: board.base })}
            action={isToday ? { label: t('editRate', { currency: code }), onClick: () => onEdit([code]) } : undefined}
          />
        );
      })}
    </section>
  );
}
