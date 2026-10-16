'use client';

import { type CurrencyCode, formatMoney } from '@sarrif/core';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { WalletIcon } from '@/components/icons/wallet';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { useDaySummary } from './queries';
import { splitDecimals } from './split-amount';

/** Whether that total is hidden on this device. */
function readHidden(key: string) {
  try {
    return localStorage.getItem(`amanat.hide.${key}`) === '1';
  } catch {
    return false;
  }
}

function writeHidden(key: string, hidden: boolean) {
  try {
    localStorage.setItem(`amanat.hide.${key}`, hidden ? '1' : '0');
  } catch {
    // Not remembered; it still toggles.
  }
}

function partOfDay(hour: number) {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** The hour now in the shop's time zone (0–23), checked again every minute. */
function useShopHour(timeZone: string) {
  const read = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const [hour, setHour] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setHour(read()), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `read` only depends on timeZone.
  }, [timeZone]);
  return hour;
}

/**
 * One total: its label, the amount big with the cents lighter, and an eye
 * that blurs it (for when customers can see the screen), remembered per
 * total on this device.
 */
function TotalFigure({ id, amount, currency }: { id: 'totalUsd' | 'totalKsh'; amount: number | null; currency: CurrencyCode }) {
  const t = useTranslations('home');
  const locale = useLocale();
  const [hidden, setHidden] = useState(() => readHidden(id));
  const toggle = () => {
    writeHidden(id, !hidden);
    setHidden(!hidden);
  };
  const [whole, cents] = amount === null ? ['', ''] : splitDecimals(formatMoney({ amount, currency }, { locale, showCurrency: false }), locale);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <WalletIcon className="size-4" />
        {t(id)}
      </span>
      <div className="flex items-center gap-2">
        {amount === null ? (
          <span className="bg-muted h-10 w-48 animate-pulse rounded-lg" />
        ) : (
          <>
            <bdi
              dir="ltr"
              aria-hidden={hidden}
              className={cn('text-4xl font-semibold tabular-nums transition-[filter]', hidden && 'pointer-events-none blur-md select-none')}
            >
              {whole}
              <span className="text-muted-foreground font-normal">{cents}</span>
              <span className="text-muted-foreground ms-2 text-lg font-medium">{currency}</span>
            </bdi>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggle}
              aria-label={hidden ? t('showTotal', { total: t(id) }) : t('hideTotal', { total: t(id) })}
              className="text-muted-foreground"
            >
              {hidden ? <EyeIcon /> : <EyeOffIcon />}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The top of Home: a greeting by name in Luxurious Roman (morning, afternoon
 * or evening by the shop's clock, kept current), then two totals side by side: Total
 * USD (every USD account: cash and Salaam) and Total KSh (every KES
 * account: cash and M-Pesa). Each is a plain sum in its own currency, so
 * neither waits on a rate. Each has its own eye to blur it.
 */
export function HomeHeader({ date }: { date: string | undefined }) {
  const t = useTranslations('home');
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id, date).data;
  const firstName = useSession().data?.name.trim().split(/\s+/)[0] ?? '';
  const greeting = t(`greeting.${partOfDay(useShopHour(workspace.timeZone))}`);
  const sumOf = (currency: CurrencyCode) =>
    summary?.accounts.filter(({ account }) => account.currency === currency).reduce((sum, { balance }) => sum + balance, 0) ?? null;
  const totals = [
    { key: 'totalUsd', amount: sumOf('USD'), currency: 'USD' },
    { key: 'totalKsh', amount: sumOf('KES'), currency: 'KES' },
  ] as const;

  return (
    <section className="flex flex-col gap-6">
      {/* Luxurious Roman has one weight: no bold, or the browser fakes it. */}
      <h1 className="hero text-3xl font-normal">{firstName ? t('greetingNamed', { greeting, name: firstName }) : greeting}</h1>

      <div className="flex flex-wrap gap-x-12 gap-y-4">
        {totals.map(({ key, amount, currency }) => (
          <TotalFigure key={key} id={key} amount={amount} currency={currency} />
        ))}
      </div>
    </section>
  );
}
