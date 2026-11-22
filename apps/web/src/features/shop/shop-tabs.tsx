'use client';

import { type AmanatRow, businessDate, dealSection, type Money, monthStart } from '@sarrif/core';
import { ArrowLeftRightIcon, ArrowUpRightIcon, HandCoinsIcon, ReceiptIcon, SmartphoneIcon, TrendingUpIcon, WalletCardsIcon, WalletIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { AmanatDialog } from '@/features/amanat/amanat-dialog';
import { AmanatCard, AmanatDetails, useDayLabel } from '@/features/amanat/amanat-notes';
import { useAmanat, useHighlightAmanat } from '@/features/amanat/queries';
import { useDeals } from '@/features/deals/queries';
import { DealList, useDealSentence } from '@/features/profit/deal-list';
import { useShortMoney } from '@/features/profit/money-text';
import { useReport } from '@/features/reports/queries';
import { StatCard } from '@/features/reports/period';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { Link } from '@/i18n/navigation';

// What each of the shop page's tabs shows: this shop's own records, today's
// (or this month's for Reports), each with a way to its full page.

/** "Open Profit ↗": to the page with all of it. */
function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors">
      {children}
      <ArrowUpRightIcon className="size-4 rtl:-scale-x-100" />
    </Link>
  );
}

function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-foreground/3 text-muted-foreground flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center text-sm">
      <span className="bg-foreground/5 flex size-10 items-center justify-center rounded-xl [&_svg]:size-5">{icon}</span>
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

/** Today in this shop, newest first: every exchange and amanat, one line each. */
export function ActivityTab() {
  const t = useTranslations('shop');
  const locale = useLocale();
  const money = useShortMoney();
  const sentence = useDealSentence();
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const deals = useDeals(workspace.id).data;
  const amanat = useAmanat(workspace.id).data;
  if (!deals || !amanat) return <div className="bg-card h-32 animate-pulse rounded-xl" />;
  const lines = [
    ...deals.map((row) => ({
      id: row.deal.id,
      at: row.deal.createdAt,
      icon: dealSection(row.deal) === 'sallam' ? <SmartphoneIcon /> : <ArrowLeftRightIcon />,
      title: dealSection(row.deal) === 'sallam' ? t('lines.sallam') : t('lines.exchange'),
      detail: sentence(row),
      money: row.profit,
    })),
    ...amanat
      .filter((row) => row.amanat.date === today)
      .map((row) => ({ id: row.amanat.id, at: row.amanat.createdAt, icon: <HandCoinsIcon />, title: t('lines.amanat', { name: row.clientName }), detail: row.account.name, money: { amount: row.amanat.amount, currency: row.amanat.currency } as Money })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  if (lines.length === 0) return <Empty icon={<ArrowLeftRightIcon />}>{t('empty.activity')}</Empty>;
  return (
    <ul className="flex flex-col">
      {lines.map((line, n) => (
        <li key={line.id} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${n % 2 === 0 ? 'bg-muted/40 dark:bg-white/[0.025]' : ''}`}>
          <span className="text-muted-foreground flex size-7 shrink-0 items-center justify-center [&_svg]:size-4">{line.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{line.title}</span>
            <span className="text-muted-foreground block truncate text-xs">{line.detail}</span>
          </span>
          <span className="shrink-0 text-end">
            {line.money ? <span dir="ltr" className="font-semibold tabular-nums">{money(line.money)}</span> : null}
            <span className="text-muted-foreground block text-xs tabular-nums">{new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(line.at))}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Today's exchanges in this shop. */
export function ExchangeTab() {
  const t = useTranslations('shop');
  const { workspace } = useWorkspace();
  const deals = useDeals(workspace.id);
  const rows = (deals.data ?? []).filter((row) => dealSection(row.deal) === 'exchange');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <More href={`/w/${workspace.id}/profit`}>{t('openProfit')}</More>
      </div>
      {deals.data && rows.length === 0 ? <Empty icon={<ArrowLeftRightIcon />}>{t('empty.exchange')}</Empty> : <DealList rows={rows} loading={!deals.data} empty={t('empty.exchange')} />}
    </div>
  );
}

/** Today's profit: where it came from, what was spent, what it came to. */
export function ProfitTab() {
  const t = useTranslations('profit.calc');
  const tShop = useTranslations('shop');
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const report = useReport(workspace.id, today, today).data;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <More href={`/w/${workspace.id}/profit`}>{tShop('openProfit')}</More>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowLeftRightIcon} label={t('exchange')} money={report?.exchange ?? []} tone="signed" loading={!report} />
        <StatCard icon={SmartphoneIcon} label={t('sallam')} money={report?.sallam ?? []} tone="signed" loading={!report} />
        <StatCard icon={ReceiptIcon} label={t('expenses')} money={report?.expenses ?? []} negative loading={!report} />
        <StatCard icon={TrendingUpIcon} label={t('net')} money={report?.net ?? []} tone="signed" loading={!report} />
      </div>
    </div>
  );
}

/** This shop's amanat as the Amanat page's cards; one opens its dialog. */
export function AmanatTab() {
  const t = useTranslations('shop');
  const { workspace } = useWorkspace();
  const list = useAmanat(workspace.id).data;
  const highlight = useHighlightAmanat();
  const dayLabel = useDayLabel();
  const today = businessDate(workspace.timeZone);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AmanatRow | null>(null);
  const opened = list?.find((row) => row.amanat.id === openId) ?? null;
  if (!list) return <div className="bg-card h-64 animate-pulse rounded-lg" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <More href={`/w/${workspace.id}/amanat`}>{t('openAmanat')}</More>
      </div>
      {list.length === 0 ? (
        <Empty icon={<HandCoinsIcon />}>{t('empty.amanat')}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((row) => (
            <AmanatCard
              key={row.amanat.id}
              row={row}
              shop={workspace}
              day={dayLabel(row.amanat.date, today)}
              onOpen={() => setOpenId(row.amanat.id)}
              onHighlight={() => void highlight.mutateAsync({ shopId: workspace.id, id: row.amanat.id, on: !row.amanat.highlighted })}
            />
          ))}
        </div>
      )}
      <AmanatDetails
        row={opened}
        shop={workspace}
        today={today}
        onClose={() => setOpenId(null)}
        onEdit={(row) => {
          setOpenId(null);
          setEditing(row);
        }}
      />
      <AmanatDialog open={editing !== null} editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** This month so far: money in and out, profit, expenses. */
export function ReportsTab() {
  const t = useTranslations('calculator.cards');
  const tShop = useTranslations('shop');
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const report = useReport(workspace.id, monthStart(today), today).data;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">{tShop('thisMonth')}</span>
        <More href={`/w/${workspace.id}/reports`}>{tShop('openReports')}</More>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={WalletIcon} label={t('in')} money={report?.moneyIn ?? []} loading={!report} />
        <StatCard icon={WalletCardsIcon} label={t('out')} money={report?.moneyOut ?? []} negative loading={!report} />
        <StatCard icon={TrendingUpIcon} label={t('net')} money={report?.net ?? []} tone="signed" loading={!report} />
        <StatCard icon={ReceiptIcon} label={t('expenses')} money={report?.expenses ?? []} negative loading={!report} />
      </div>
    </div>
  );
}
