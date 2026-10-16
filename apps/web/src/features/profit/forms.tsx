'use client';

import {
  type Account,
  accountKind,
  dealResult,
  type DealRow,
  exchangeRowProfit,
  exchangeShillings,
  type ExchangeSide,
  fromMinor,
  moveArrives,
  parseAmount,
  type RateBoard,
  ratedCurrencies,
  sallamAmounts,
  type SallamSide,
} from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { Button } from '@/components/ui/button';
import { useCreateDeal, useRemoveDeals, useUpdateDeal } from '@/features/deals/queries';
import { RatesDialog } from '@/features/rates/rates-dialog';
import { useCreateTransfer } from '@/features/records/mutations';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { errorKey, useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { AccountButtons, AmountBox, withCommas } from './fields';
import { useShortMoney } from './money-text';

// ── Pieces every form shares ─────────────────────────────────────────────────

/** Two big buttons, one picked: Sold / Bought, Bought $ / Sold $, Cash / Sallam… */
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-14 rounded-xl text-lg font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option.value ? 'bg-primary text-primary-foreground' : 'bg-field text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled field: the label big (18px), then the field. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-lg font-semibold">{label}</span>
      {children}
    </div>
  );
}

/** A % or a rate: big digits, a suffix at the end. */
function SmallNumber({ label, value, onChange, suffix }: { label: string; value: string; onChange: (value: string) => void; suffix?: string }) {
  return (
    <label dir="ltr" className="relative block">
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ''))}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground/70 h-16 w-full rounded-xl ps-4 pe-12 text-end text-3xl font-semibold tabular-nums outline-none"
      />
      {suffix ? <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-4 flex items-center text-2xl font-semibold">{suffix}</span> : null}
    </label>
  );
}

/** A worked-out line ("→ Sallam receives 20,160 $"): shown, never typed. */
function Result({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1', strong ? 'bg-field/60 min-h-16 rounded-xl px-4 py-3' : 'px-1')}>
      <span className={strong ? 'text-lg font-semibold' : 'text-muted-foreground text-lg'}>{label}</span>
      <span className={strong ? 'text-3xl font-bold tabular-nums' : 'text-2xl font-semibold tabular-nums'}>{value}</span>
    </div>
  );
}

/** "+160 $" in green, "−20 $" in red. */
function Profit({ amount, currency }: { amount: number; currency: Account['currency'] }) {
  const money = useShortMoney();
  return (
    <span className={cn(amount > 0 && 'text-emerald-600 dark:text-emerald-400', amount < 0 && 'text-red-600 dark:text-red-400')}>{money({ amount, currency }, true)}</span>
  );
}

/** "+ name" and "+ note": small links that open their fields. */
function Extras({ customer, note, onCustomer, onNote }: { customer: string; note: string; onCustomer: (v: string) => void; onNote: (v: string) => void }) {
  const t = useTranslations('form');
  const [showName, setShowName] = useState(Boolean(customer));
  const [showNote, setShowNote] = useState(Boolean(note));
  const input = 'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-14 rounded-xl px-4 text-lg outline-none';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-5">
        {!showName ? (
          <button type="button" onClick={() => setShowName(true)} className="text-muted-foreground hover:text-foreground text-base font-medium">
            {t('addName')}
          </button>
        ) : null}
        {!showNote ? (
          <button type="button" onClick={() => setShowNote(true)} className="text-muted-foreground hover:text-foreground text-base font-medium">
            {t('addNote')}
          </button>
        ) : null}
      </div>
      {showName ? <input value={customer} onChange={(e) => onCustomer(e.target.value)} placeholder={t('name')} maxLength={80} className={input} /> : null}
      {showNote ? <input value={note} onChange={(e) => onNote(e.target.value)} placeholder={t('note')} maxLength={200} className={input} /> : null}
    </div>
  );
}

function Save({ ready }: { ready: boolean }) {
  const t = useTranslations('form');
  return (
    <Button type="submit" disabled={!ready} className="h-14 w-full rounded-xl text-lg font-bold">
      {t('save')}
    </Button>
  );
}

/** Typed text → minor units, or null while empty or not a number. */
const amountOf = (text: string, currency: Account['currency']) => (text.trim() ? parseAmount(text.replace(/,/g, ''), currency) : null);
/** Minor units → a box's text. */
const textOf = (amount: number, currency: Account['currency']) => withCommas(fromMinor(amount, currency).toFixed(2).replace(/\.00$/, ''));
/** A % or rate as typed: a positive decimal, or null. */
const decimalOf = (text: string, max?: number) => {
  const clean = text.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 && (max === undefined || value <= max) ? clean : null;
};

/** Saves a new row or one being changed; a new one gets Undo. */
function useSaveDeal(editing: DealRow | undefined, onDone: () => void) {
  const t = useTranslations('form');
  const message = useMessage();
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const create = useCreateDeal(workspace.id);
  const update = useUpdateDeal(workspace.id);
  const remove = useRemoveDeals(workspace.id);
  const save = (input: Parameters<typeof create.mutateAsync>[0], profit: { amount: number; currency: Account['currency'] } | null) => {
    if (editing) {
      update.mutateAsync({ id: editing.deal.id, input }).then(
        () => {
          gooeyToast.success(t('saved'));
          onDone();
        },
        (error) => gooeyToast.error(message(errorKey(error))),
      );
      return;
    }
    create.mutateAsync(input).then(
      (record) => {
        onDone();
        gooeyToast.success(`${t('saved')}${profit ? ` ${money(profit, true)}` : ''}`, {
          action: { label: t('undo'), successLabel: t('undone'), onClick: () => remove.mutate({ ids: [record.id] }) },
        });
      },
      (error) => gooeyToast.error(message(errorKey(error))),
    );
  };
  return { save, pending: create.isPending || update.isPending };
}

// ── Sallam ───────────────────────────────────────────────────────────────────

/**
 * Sallam (profit way 1): sold or bought, the dollars from the cash drawer, the
 * % (the last one used, to start). Sallam receives the dollars plus (sold) or
 * less (bought) the %, and that difference is the profit. Always $ Cash to
 * $ Sallam: no account to pick.
 */
export function SallamForm({ rows, editing, onDone }: { rows: DealRow[]; editing?: DealRow; onDone: () => void }) {
  const t = useTranslations('sallam');
  const was = editing ? dealResult(editing.deal) : null;
  const [side, setSide] = useState<SallamSide>(was?.profit && was.profit.amount < 0 ? 'bought' : 'sold');
  const lastPercent = rows.map((row) => row.deal.percent).find((percent): percent is string => Boolean(percent));
  const [amountText, setAmountText] = useState(editing ? textOf(editing.deal.amountOut, 'USD') : '');
  const [percentText, setPercentText] = useState(editing ? (editing.deal.percent ?? String(Math.abs(Number(was?.percent ?? 0)))) : (lastPercent ?? ''));
  const [customer, setCustomer] = useState(editing?.deal.customer ?? '');
  const [note, setNote] = useState(editing?.deal.note ?? '');
  const amount = amountOf(amountText, 'USD');
  const percent = decimalOf(percentText, 100);
  const result = amount && amount > 0 && percent ? sallamAmounts(side, amount, percent) : null;
  const money = useShortMoney();
  const { save, pending } = useSaveDeal(editing, () => {
    setAmountText('');
    setCustomer('');
    setNote('');
    onDone();
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!result || !amount || !percent || pending) return;
    save({ type: 'sallam', side, amount, percent, customer: customer.trim() || null, note: note.trim() || null }, result.profit);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Choice
        label={t('title')}
        value={side}
        onChange={setSide}
        options={[
          { value: 'sold', label: t('sold') },
          { value: 'bought', label: t('bought') },
        ]}
      />
      <Field label={t('dollarsCash')}>
        <AmountBox label={t('dollarsCash')} currency="USD" value={amountText} onChange={setAmountText} />
      </Field>
      <Field label={t('percent')}>
        <SmallNumber label={t('percent')} value={percentText} onChange={setPercentText} suffix="%" />
      </Field>
      <Result label={t('sallamReceives')} value={result ? money({ amount: result.sallamIn, currency: 'USD' }) : '—'} />
      <Result label={t('profit')} value={result ? <Profit amount={result.profit.amount} currency="USD" /> : '—'} strong />
      <Extras customer={customer} note={note} onCustomer={setCustomer} onNote={setNote} />
      <Save ready={Boolean(result) && !pending} />
    </form>
  );
}

// ── Exchange ─────────────────────────────────────────────────────────────────

/**
 * Exchange (profit way 2): bought or sold dollars, how many, at what rate
 * (today's to start). The shillings and the profit against today's rate are
 * worked out. Dollars go in or out of Cash (or Sallam), shillings Cash (or
 * M-Pesa). Without today's rate: a button to set it, and no saving.
 */
export function ExchangeForm({ accounts, board, editing, onDone }: { accounts: Account[]; board: RateBoard; editing?: DealRow; onDone: () => void }) {
  const t = useTranslations('exchange');
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const { today: todayDate } = useShopDay();
  const today = board.rates.KES?.buy ?? null;
  const editSide: ExchangeSide | null = editing ? (editing.deal.currencyIn === 'USD' ? 'bought' : 'sold') : null;
  const [side, setSide] = useState<ExchangeSide>(editSide ?? 'bought');
  const usdAccounts = accounts.filter((a) => a.currency === 'USD').sort((a) => (accountKind(a) === 'cash_usd' ? -1 : 1));
  const kesAccounts = accounts.filter((a) => a.currency === 'KES').sort((a) => (accountKind(a) === 'cash_kes' ? -1 : 1));
  const editUsd = editing ? (editSide === 'bought' ? editing.deal.accountIn : editing.deal.accountOut) : null;
  const editKes = editing ? (editSide === 'bought' ? editing.deal.accountOut : editing.deal.accountIn) : null;
  const [usdId, setUsdId] = useState(editUsd ?? usdAccounts[0]?.id ?? '');
  const [kesId, setKesId] = useState(editKes ?? kesAccounts[0]?.id ?? '');
  const editDollars = editing ? (editSide === 'bought' ? editing.deal.amountIn : editing.deal.amountOut) : null;
  const [amountText, setAmountText] = useState(editDollars ? textOf(editDollars, 'USD') : '');
  const [rateText, setRateText] = useState(editing ? (editing.deal.customerRate ?? dealResult(editing.deal)?.rate ?? '') : (today ?? ''));
  const [customer, setCustomer] = useState(editing?.deal.customer ?? '');
  const [note, setNote] = useState(editing?.deal.note ?? '');
  const [rateOpen, setRateOpen] = useState(false);
  const amount = amountOf(amountText, 'USD');
  const rate = decimalOf(rateText);
  const shillings = amount && amount > 0 && rate ? exchangeShillings(amount, rate) : null;
  const profit = amount && amount > 0 && rate ? exchangeRowProfit(side, amount, rate, today) : null;
  const ready = Boolean(shillings && profit && usdId && kesId);
  const { save, pending } = useSaveDeal(editing, () => {
    setAmountText('');
    setCustomer('');
    setNote('');
    onDone();
  });
  const accountChoice = (list: Account[]) =>
    list.map((a) => ({ value: a.id, label: accountKind(a) === 'cash_usd' || accountKind(a) === 'cash_kes' ? t('cash') : accountKind(a) === 'salaam_bank' ? t('sallam') : t('mpesa') }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !amount || !rate || pending) return;
    save({ type: 'exchange', side, amount, rate, usdAccountId: usdId, kesAccountId: kesId, customer: customer.trim() || null, note: note.trim() || null }, profit);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="text-muted-foreground text-base">{today ? t('todaysRate', { rate: today }) : t('noRate')}</p>
      <Choice
        label={t('title')}
        value={side}
        onChange={setSide}
        options={[
          { value: 'bought', label: t('bought') },
          { value: 'sold', label: t('sold') },
        ]}
      />
      <Field label={t('dollars')}>
        <AmountBox label={t('dollars')} currency="USD" value={amountText} onChange={setAmountText} />
      </Field>
      <Field label={t('rate')}>
        <SmallNumber label={t('rate')} value={rateText} onChange={setRateText} />
      </Field>
      <Result label={t('shillings')} value={shillings ? money({ amount: shillings, currency: 'KES' }) : '—'} />
      <Result
        label={t('profit')}
        strong
        value={
          !today ? (
            <Button type="button" variant="secondary" onClick={() => setRateOpen(true)} className="h-12 rounded-xl px-5 text-base font-semibold">
              {t('setRate')}
            </Button>
          ) : profit ? (
            <Profit amount={profit.amount} currency="KES" />
          ) : (
            '—'
          )
        }
      />
      {usdAccounts.length > 1 ? (
        <Field label={t('dollarsAccount')}>
          <Choice label={t('dollarsAccount')} value={usdId} onChange={setUsdId} options={accountChoice(usdAccounts).slice(0, 2)} />
        </Field>
      ) : null}
      {kesAccounts.length > 1 ? (
        <Field label={t('shillingsAccount')}>
          <Choice label={t('shillingsAccount')} value={kesId} onChange={setKesId} options={accountChoice(kesAccounts).slice(0, 2)} />
        </Field>
      ) : null}
      <Extras customer={customer} note={note} onCustomer={setCustomer} onNote={setNote} />
      <Save ready={ready && !pending} />
      <RatesDialog open={rateOpen} onOpenChange={setRateOpen} workspaceId={workspace.id} date={todayDate} currencies={ratedCurrencies(workspace)} board={board} />
    </form>
  );
}

// ── Move ─────────────────────────────────────────────────────────────────────

/**
 * Move (never profit): any account to any other, the amount, and a rate only
 * when the two are different currencies (today's to start). What arrives is
 * worked out.
 */
export function MoveForm({ accounts, board, onDone }: { accounts: Account[]; board: RateBoard; onDone: () => void }) {
  const t = useTranslations('move');
  const tf = useTranslations('form');
  const message = useMessage();
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const create = useCreateTransfer(workspace.id);
  const [fromId, setFromId] = useState(accounts.find((a) => accountKind(a) === 'mpesa')?.id ?? accounts[0]?.id ?? '');
  const [toId, setToId] = useState(accounts.find((a) => accountKind(a) === 'cash_usd')?.id ?? accounts[1]?.id ?? '');
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const [amountText, setAmountText] = useState('');
  const [rateText, setRateText] = useState(board.rates.KES?.buy ?? '');
  const amount = from ? amountOf(amountText, from.currency) : null;
  const converts = Boolean(from && to && from.currency !== to.currency);
  const same = fromId === toId;
  const arrives = from && to && amount && amount > 0 && !same ? moveArrives(amount, from.currency, to.currency, converts ? decimalOf(rateText) : null) : null;
  const ready = Boolean(arrives) && !create.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !from || !to || !amount || !arrives) return;
    create.mutateAsync({ fromAccountId: from.id, toAccountId: to.id, amountOut: amount, amountIn: arrives }).then(
      () => {
        gooeyToast.success(t('moved'));
        setAmountText('');
        onDone();
      },
      (error) => gooeyToast.error(message(errorKey(error))),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field label={t('from')}>
        <AccountButtons label={t('from')} accounts={accounts} value={fromId} onChange={setFromId} />
      </Field>
      <Field label={t('to')}>
        <AccountButtons label={t('to')} accounts={accounts} value={toId} onChange={setToId} />
        {same ? <p className="text-base font-medium text-red-600 dark:text-red-400">{t('pickDifferent')}</p> : null}
      </Field>
      <Field label={t('amount')}>
        <AmountBox label={t('amount')} currency={from?.currency ?? 'USD'} value={amountText} onChange={setAmountText} />
      </Field>
      {converts ? (
        <Field label={t('rate')}>
          <SmallNumber label={t('rate')} value={rateText} onChange={setRateText} />
        </Field>
      ) : null}
      <Result label={t('receives')} value={arrives && to ? money({ amount: arrives, currency: to.currency }) : '—'} strong />
      <Button type="submit" disabled={!ready} className="h-14 w-full rounded-xl text-lg font-bold">
        {tf('save')}
      </Button>
    </form>
  );
}

// ── Sheets ───────────────────────────────────────────────────────────────────

/**
 * A Sallam or exchange row in a sheet: a new one, or one from the list
 * filled in to change or delete (soft, with Undo) while its day is open.
 */
export function DealSheet({
  type,
  open,
  onOpenChange,
  editing,
  accounts,
  board,
  rows,
}: {
  type: 'sallam' | 'exchange';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: DealRow | null;
  accounts: Account[];
  board: RateBoard;
  rows: DealRow[];
}) {
  const t = useTranslations('form');
  const title = useTranslations(type);
  const message = useMessage();
  const { workspace, can } = useWorkspace();
  const remove = useRemoveDeals(workspace.id);
  const canChange = !editing || (!editing.locked && can('edit_entry_today'));
  const close = () => onOpenChange(false);

  const deleteRow = () => {
    if (!editing) return;
    const ids = [editing.deal.id];
    close();
    remove.mutateAsync({ ids }).then(
      () => gooeyToast.success(t('deleted'), { action: { label: t('undo'), successLabel: t('undone'), onClick: () => remove.mutate({ ids, restore: true }) } }),
      (error) => gooeyToast.error(message(errorKey(error))),
    );
  };

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={title('title')} closeLabel={t('close')}>
      {open ? (
        <div className="flex flex-col gap-4">
          {!canChange ? (
            <p className="text-muted-foreground text-base">{t('locked')}</p>
          ) : type === 'sallam' ? (
            <SallamForm key={editing?.deal.id ?? 'new'} rows={rows} editing={editing ?? undefined} onDone={close} />
          ) : (
            <ExchangeForm key={editing?.deal.id ?? 'new'} accounts={accounts} board={board} editing={editing ?? undefined} onDone={close} />
          )}
          {editing && canChange ? (
            <Button type="button" variant="destructive" onClick={deleteRow} className="h-14 rounded-xl text-base font-semibold">
              <Trash2Icon data-icon="inline-start" />
              {t('delete')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </ActionSheet>
  );
}

/** Move in a sheet (Home's Move button). */
export function MoveSheet({ open, onOpenChange, accounts, board }: { open: boolean; onOpenChange: (open: boolean) => void; accounts: Account[]; board: RateBoard }) {
  const t = useTranslations('move');
  const tf = useTranslations('form');
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={t('title')} closeLabel={tf('close')}>
      {open ? <MoveForm accounts={accounts} board={board} onDone={() => onOpenChange(false)} /> : null}
    </ActionSheet>
  );
}
