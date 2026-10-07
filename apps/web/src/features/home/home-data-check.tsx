'use client';

import type { Money } from '@sarrif/core';
import { useTranslations } from 'next-intl';

import { MoneyText } from '@/components/money-text';
import { useBook } from '@/features/book/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';

import { useDaySummary } from './queries';

// PLACEHOLDER for Home. It is not the design: it proves the plumbing end to
// end (mock backend → shared ledger → query hooks → screen) and shows the
// numbers the real Home will lay out. Replace it with the designed Home.

export function HomeDataCheck() {
  const t = useTranslations();
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id);
  const book = useBook(workspace.id);

  if (summary.isPending) return <p className="text-muted-foreground p-6 text-sm">{t('common.loading')}</p>;
  if (summary.isError) return <p className="text-destructive p-6 text-sm">{t('errors.unknown')}</p>;

  const s = summary.data;
  const base = (amount: number | null) =>
    amount === null ? t('placeholder.unknown') : <MoneyText money={{ amount, currency: s.baseCurrency }} />;

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 p-6">
      <header>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{t('placeholder.dataCheck')}</p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">{workspace.name}</h1>
        <p className="text-muted-foreground text-sm">{s.date}</p>
      </header>

      {s.missingRates.length > 0 ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
          {t('placeholder.ratesMissing', { currencies: s.missingRates.join(', ') })}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label={t('placeholder.totalInBase', { currency: s.baseCurrency })}>{base(s.totalInBase)}</Stat>
        <Stat label={t('placeholder.profitToday')}>{base(s.profit)}</Stat>
      </div>

      <Block title={t('placeholder.accounts')}>
        <ul className="divide-border divide-y">
          {s.accounts.map(({ account, balance, todayIn, todayOut }) => (
            <li key={account.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{account.name}</span>
              <span className="text-muted-foreground flex gap-3 text-xs">
                <span>
                  {t('placeholder.in')} <MoneyText money={{ amount: todayIn, currency: account.currency }} showCurrency={false} />
                </span>
                <span>
                  {t('placeholder.out')} <MoneyText money={{ amount: todayOut, currency: account.currency }} showCurrency={false} />
                </span>
              </span>
              <MoneyText money={{ amount: balance, currency: account.currency }} className="font-semibold" />
            </li>
          ))}
        </ul>
      </Block>

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyList title={t('placeholder.amanatHeld')} items={s.amanatHeld} />
        <MoneyList title={t('placeholder.owedToUs')} items={s.owedToUs} />
        <MoneyList title={t('placeholder.weOwe')} items={s.weOwe} />
      </div>

      <Block title={t('placeholder.recent')}>
        {book.data?.length ? (
          <ul className="divide-border divide-y">
            {book.data.slice(0, 10).map((row) => (
              <li key={`${row.type}-${row.id}`} className="grid grid-cols-[7rem_1fr_auto] items-baseline gap-3 py-2 text-sm">
                <span className="text-muted-foreground">{t(`recordTypes.${row.type}`)}</span>
                <span className="truncate">
                  {row.client?.name ?? row.note ?? ''} <span className="text-muted-foreground text-xs">· {row.recordedBy.name}</span>
                </span>
                <span className="flex gap-3">
                  {row.in ? <MoneyText money={row.in} signed className="text-emerald-600 dark:text-emerald-400" /> : null}
                  {row.out ? <MoneyText money={{ ...row.out, amount: -row.out.amount }} signed /> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('placeholder.empty')}</p>
        )}
      </Block>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{children}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-xl border p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function MoneyList({ title, items }: { title: string; items: Money[] }) {
  return (
    <Block title={title}>
      {items.length ? (
        <ul className="space-y-1 text-sm">
          {items.map((money) => (
            <li key={money.currency}>
              <MoneyText money={money} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">—</p>
      )}
    </Block>
  );
}
