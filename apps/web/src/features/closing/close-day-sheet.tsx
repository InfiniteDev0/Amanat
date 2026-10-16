'use client';

import { type ClosingLine, type ClosingView, closingDifference, fromMinor, type Money, parseAmount, totalInShillings } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { CheckIcon, LockIcon, Share2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { Button } from '@/components/ui/button';
import { useDaySummary } from '@/features/home/queries';
import { AmountBox, withCommas } from '@/features/profit/fields';
import { useAccountShort, useShortMoney } from '@/features/profit/money-text';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { useCloseDay, useClosingDay, useReopenDay } from './queries';

const INPUT = 'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg outline-none';

/** A difference in its colour: zero green with a tick, anything else red. */
function Difference({ money }: { money: Money }) {
  const t = useTranslations('closing');
  const format = useShortMoney();
  const zero = money.amount === 0;
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-bold tabular-nums', zero ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {zero ? <CheckIcon className="size-5" aria-hidden /> : null}
      {zero ? t('matches') : format(money, true)}
    </span>
  );
}

function Line({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 text-base', strong && 'text-lg font-semibold')}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end tabular-nums">{children}</span>
    </div>
  );
}

/** The day's profit, as on the Profit page: Sallam, Exchange, Expenses, Net. */
function DayTotals({ date }: { date: string }) {
  const t = useTranslations('closing');
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id, date).data;
  if (!summary) return null;
  const list = (items: Money[], signed: boolean) => (items.length === 0 ? '0' : items.map((m) => money(m, signed)).join(' · '));
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-semibold">{t('dayTotals')}</h3>
      <Line label={t('sallamProfit')}>{list(summary.swapCharges, true)}</Line>
      <Line label={t('exchangeProfit')}>{list(summary.exchangeCharges, true)}</Line>
      <Line label={t('expenses')}>{list(summary.expenses.map((m) => ({ ...m, amount: -m.amount })), true)}</Line>
      <Line label={t('net')} strong>
        {list(summary.net, true)}
      </Line>
    </section>
  );
}

/** One account to count: what should be there, the amanat in it, the count, and how far off. */
function CountCard({
  line,
  text,
  note,
  onText,
  onNote,
  noteMissing,
}: {
  line: ClosingLine;
  text: string;
  note: string;
  onText: (text: string) => void;
  onNote: (note: string) => void;
  noteMissing: boolean;
}) {
  const t = useTranslations('closing');
  const money = useShortMoney();
  const short = useAccountShort();
  const { currency } = line.account;
  const counted = text.trim() ? parseAmount(text.replace(/,/g, ''), currency) : null;
  const difference = counted === null ? null : closingDifference(line.expected, counted);
  const asText = (amount: number) => withCommas(fromMinor(amount, currency).toString());

  return (
    <li className="bg-card flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-lg font-bold">{short(line.account)}</span>
        <span className="text-end">
          <span className="text-muted-foreground block text-sm">{t('expected')}</span>
          <span className="text-2xl font-bold tabular-nums">{money({ amount: line.expected, currency })}</span>
        </span>
      </div>
      {line.amanatHeld !== 0 ? (
        <p className="text-muted-foreground text-sm">
          {t('amanatIn', { held: money({ amount: line.amanatHeld, currency }), own: money({ amount: line.own, currency }) })}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">{t('counted')}</span>
          <button type="button" onClick={() => onText(asText(line.expected))} className="text-primary text-sm font-semibold hover:underline">
            {t('sameAsExpected')}
          </button>
        </div>
        <AmountBox label={t('counted')} currency={currency} value={text} onChange={onText} />
      </div>
      {difference !== null ? (
        <Line label={t('difference')}>
          <Difference money={{ amount: difference, currency }} />
        </Line>
      ) : null}
      {difference !== null && difference !== 0 ? (
        <label className="flex flex-col gap-1.5">
          <span className={cn('text-sm font-semibold', noteMissing && 'text-red-600 dark:text-red-400')}>{t('noteNeeded')}</span>
          <input value={note} onChange={(e) => onNote(e.target.value)} placeholder={t('notePlaceholder')} maxLength={500} className={INPUT} />
        </label>
      ) : null}
    </li>
  );
}

/** The counts of a closed day, read-only, with who closed it, Share to WhatsApp, and Reopen for Owners. */
function ClosedDay({ view, dayLabel, onDone }: { view: ClosingView; dayLabel: string; onDone: () => void }) {
  const t = useTranslations('closing');
  const locale = useLocale();
  const message = useMessage();
  const money = useShortMoney();
  const short = useAccountShort();
  const { workspace, can } = useWorkspace();
  const summary = useDaySummary(workspace.id, view.date).data;
  const reopen = useReopenDay(workspace.id);
  const [reason, setReason] = useState('');
  const closed = view.closed!;
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(closed.at));
  const accountOf = (id: string) => view.lines.find((l) => l.account.id === id)?.account;
  const kshTotal = totalInShillings(
    closed.counts.flatMap((c) => {
      const account = accountOf(c.accountId);
      return account ? [{ amount: c.difference, currency: account.currency }] : [];
    }),
    view.board,
  );

  const share = () => {
    const list = (items: Money[]) => (items.length === 0 ? '0' : items.map((m) => money(m, true)).join(' · '));
    const lines = [
      t('shareTitle', { shop: workspace.name, day: dayLabel }),
      '',
      ...closed.counts.flatMap((c) => {
        const account = accountOf(c.accountId);
        if (!account) return [];
        const off = c.difference === 0 ? '✓' : money({ amount: c.difference, currency: account.currency }, true);
        return [`${short(account)}: ${money({ amount: c.counted, currency: account.currency })} (${off})`];
      }),
      '',
      ...(summary
        ? [
            `${t('sallamProfit')}: ${list(summary.swapCharges)}`,
            `${t('exchangeProfit')}: ${list(summary.exchangeCharges)}`,
            `${t('expenses')}: ${list(summary.expenses.map((m) => ({ ...m, amount: -m.amount })))}`,
            `${t('net')}: ${list(summary.net)}`,
          ]
        : []),
      '',
      t('closedBy', { name: closed.by.name, time }),
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  };

  const reopenIt = () => {
    reopen.mutateAsync({ date: view.date, reason: reason.trim() }).then(
      () => {
        gooeyToast.success(t('reopened'));
        onDone();
      },
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/12 px-4 py-3 text-emerald-700 dark:text-emerald-300">
        <LockIcon className="size-5 shrink-0" aria-hidden />
        <span className="text-base font-semibold">{t('closedBy', { name: closed.by.name, time })}</span>
      </div>

      <ul className="flex flex-col gap-2">
        {closed.counts.map((c) => {
          const account = accountOf(c.accountId);
          if (!account) return null;
          return (
            <li key={c.id} className="bg-card flex flex-col gap-1.5 rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-lg font-bold">{short(account)}</span>
                <span className="text-xl font-bold tabular-nums">{money({ amount: c.counted, currency: account.currency })}</span>
              </div>
              <Line label={t('expected')}>{money({ amount: c.expected, currency: account.currency })}</Line>
              <Line label={t('difference')}>
                <Difference money={{ amount: c.difference, currency: account.currency }} />
              </Line>
              {c.note ? <p className="text-muted-foreground text-sm">{c.note}</p> : null}
            </li>
          );
        })}
      </ul>

      {kshTotal ? (
        <Line label={t('kshTotal')} strong>
          <Difference money={kshTotal} />
        </Line>
      ) : null}

      <DayTotals date={view.date} />

      <Button type="button" onClick={share} className="h-14 rounded-xl bg-[#25D366] text-lg font-bold text-white hover:bg-[#1ebe5a]">
        <Share2Icon data-icon="inline-start" />
        {t('share')}
      </Button>

      {can('reopen_day') ? (
        <section className="border-border/60 flex flex-col gap-2 border-t pt-5">
          <h3 className="text-lg font-semibold">{t('reopenTitle')}</h3>
          <p className="text-muted-foreground text-sm">{t('reopenHelp')}</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reasonPlaceholder')} maxLength={500} className={INPUT} />
          <Button type="button" variant="outline" onClick={reopenIt} disabled={reason.trim().length < 3 || reopen.isPending} className="h-14 rounded-xl text-lg font-bold">
            {t('reopen')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/** Counting each account, then Close. */
function CountForm({ view }: { view: ClosingView }) {
  const t = useTranslations('closing');
  const message = useMessage();
  const { workspace, can } = useWorkspace();
  const close = useCloseDay(workspace.id);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);

  const counts = view.lines.map((line) => {
    const text = texts[line.account.id] ?? '';
    const counted = text.trim() ? parseAmount(text.replace(/,/g, ''), line.account.currency) : null;
    const note = notes[line.account.id]?.trim() ?? '';
    return { line, counted, note, off: counted !== null && counted !== line.expected };
  });
  const allCounted = counts.every((c) => c.counted !== null);
  const notesMissing = counts.filter((c) => c.off && !c.note);
  const ready = allCounted && notesMissing.length === 0 && !close.isPending;
  const kshTotal = allCounted
    ? totalInShillings(
        counts.map((c) => ({ amount: closingDifference(c.line.expected, c.counted ?? 0), currency: c.line.account.currency })),
        view.board,
      )
    : null;

  const submit = () => {
    setTried(true);
    if (!ready) return;
    close
      .mutateAsync({
        date: view.date,
        counts: counts.map((c) => ({ accountId: c.line.account.id, counted: c.counted ?? 0, note: c.note || null })),
      })
      .then(
        () => gooeyToast.success(t('closed')),
        (error) => gooeyToast.error(message(formErrorKey(error))),
      );
  };

  if (!can('close_day')) return <p className="text-muted-foreground text-base">{t('notClosedYet')}</p>;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-base">{t('help')}</p>
      <ul className="flex flex-col gap-3">
        {counts.map(({ line, off, note }) => (
          <CountCard
            key={line.account.id}
            line={line}
            text={texts[line.account.id] ?? ''}
            note={notes[line.account.id] ?? ''}
            onText={(text) => setTexts((all) => ({ ...all, [line.account.id]: text }))}
            onNote={(text) => setNotes((all) => ({ ...all, [line.account.id]: text }))}
            noteMissing={tried && off && !note}
          />
        ))}
      </ul>
      {kshTotal ? (
        <Line label={t('kshTotal')} strong>
          <Difference money={kshTotal} />
        </Line>
      ) : null}
      <DayTotals date={view.date} />
      {tried && !allCounted ? <p className="text-base font-semibold text-red-600 dark:text-red-400">{t('countAll')}</p> : null}
      <Button type="button" onClick={submit} disabled={close.isPending} className="h-14 rounded-xl text-lg font-bold">
        <LockIcon data-icon="inline-start" />
        {t('close')}
      </Button>
    </div>
  );
}

/**
 * Close day (Build Plan v4, 3.9 and 7.7), from the date control: count every
 * account, see what it should hold (and the amanat in it), how far off the
 * count is, a note wherever it's off, the day's profit, then Close: the day
 * locks. A closed day shows its counts, who closed it, Share to WhatsApp,
 * and, for Owners, Reopen with a reason.
 */
export function CloseDaySheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (open: boolean) => void; date: string }) {
  const t = useTranslations('closing');
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const view = useClosingDay(workspace.id, date, open).data;
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={t('titleFor', { day: dayLabel })} closeLabel={t('dismiss')}>
      {!view || view.date !== date ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card h-36 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : view.closed ? (
        <ClosedDay view={view} dayLabel={dayLabel} onDone={() => onOpenChange(false)} />
      ) : (
        // Fresh counts for each day.
        <CountForm key={date} view={view} />
      )}
    </ActionSheet>
  );
}
