'use client';

import { type Account, type AccountPosition, fromMinor, parseAmount, type RateBoard, valueFromBase, valueInBase } from '@sarrif/core';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Flag } from '@/components/flag';
import { MoneyText } from '@/components/money-text';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FieldAlert } from '@/components/ui/field-alert';
import { useCreateTransfer } from '@/features/records/mutations';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { errorKey, useMessage } from '@/lib/api/errors';
import { currencyFlag } from '@/lib/currency-flag';
import { promiseToast } from '@/lib/promise-toast';
import { cn } from '@/lib/utils';

import { useAccountLabel } from './account-label';
import { useUpdateAccount } from './queries';

type Tab = 'balance' | 'move';
type Problem = { field: string; text: string } | null;

export interface AccountDialogProps {
  /** The account, with today's balance and moves; null when closed. */
  position: AccountPosition | null;
  /** Every account in the shop, today: where money can move to. */
  positions: AccountPosition[];
  /** Today's rates, to convert a move into another currency. */
  board: RateBoard;
  onClose: () => void;
}

/**
 * What you can do with one account, from its card on Home:
 *
 * - Balance (Owners): the money it started with. Its balance is that plus
 *   everything recorded on it.
 * - Move: to any other account in the shop. To another currency (500 USD
 *   into the KES account), what arrives is filled in at today's mid rate and
 *   can be typed over (the rate actually got).
 *
 * Nothing is checked until the button is pressed; then one problem at a time.
 */
export function AccountDialog({ position, ...props }: AccountDialogProps) {
  const t = useTranslations('accountDialog');
  return (
    <Dialog
      open={position !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent closeLabel={t('close')}>{position ? <AccountForms position={position} {...props} /> : null}</DialogContent>
    </Dialog>
  );
}

function AccountForms({ position: given, positions: all, board, onClose }: Omit<AccountDialogProps, 'position'> & { position: AccountPosition }) {
  const t = useTranslations('accountDialog');
  // Names as shown (suggested cash names in today's language), for every form below.
  const label = useAccountLabel();
  const named = (p: AccountPosition) => ({ ...p, account: { ...p.account, name: label(p.account) } });
  const position = named(given);
  const positions = all.map(named);
  const { can } = useWorkspace();
  const tabs = (['balance', 'move'] as const).filter((tab) => (tab === 'balance' ? can('manage_accounts') : can('record')));
  const [tab, setTab] = useState<Tab>(tabs[0] ?? 'balance');
  const { account, balance } = position;

  return (
    <div className="flex min-h-0 flex-col">
      <DialogTitle className="flex items-center gap-2.5 pe-10">
        <Flag code={currencyFlag(account.currency)} />
        {account.name}
      </DialogTitle>
      <DialogDescription>
        {t('balanceNow')} <MoneyText money={{ amount: balance, currency: account.currency }} className="text-foreground font-semibold" />
      </DialogDescription>

      {tabs.length > 1 ? (
        <div role="tablist" className="bg-field mt-5 grid auto-cols-fr grid-flow-col rounded-xl p-1">
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn('relative h-9 rounded-lg text-sm font-medium transition-colors', tab === value ? 'text-primary-foreground' : 'text-muted-foreground')}
            >
              {tab === value ? (
                <motion.span layoutId="account-tab" transition={{ type: 'spring', duration: 0.3, bounce: 0 }} className="bg-primary absolute inset-0 rounded-lg" />
              ) : null}
              <span className="relative">{t(`tabs.${value}`)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {tab === 'balance' ? <BalanceForm position={position} onDone={onClose} /> : null}
        {tab === 'move' ? <MoveForm account={account} positions={positions} board={board} onDone={onClose} /> : null}
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-11 w-full rounded-xl px-3 text-end text-sm tabular-nums outline-none';

/** An amount in one currency: its flag and code at the start, digits left to right. */
function AmountInput({ label, currency, value, onChange, problem }: { label: string; currency: string; value: string; onChange: (value: string) => void; problem: string | null }) {
  return (
    <label className="relative block">
      <span className="text-muted-foreground mb-1.5 block text-xs">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center gap-2 text-sm font-medium">
          <Flag code={currencyFlag(currency)} />
          {currency}
        </span>
        <input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" dir="ltr" placeholder="0.00" className={INPUT_CLASS} />
      </span>
      <FieldAlert>{problem}</FieldAlert>
    </label>
  );
}

/** Another account in the shop, picked with the beui select. */
function AccountPicker({ label, accounts, value, onChange, problem }: { label: string; accounts: Account[]; value: string; onChange: (id: string) => void; problem: string | null }) {
  const chosen = accounts.find((a) => a.id === value);
  return (
    <div className="relative">
      <span className="text-muted-foreground mb-1.5 block text-xs">{label}</span>
      <Select value={value} onValueChange={onChange} className="w-full">
        <SelectTrigger className="h-11 rounded-xl px-3 text-sm font-medium">
          {chosen ? (
            <span className="flex items-center gap-2">
              <Flag code={currencyFlag(chosen.currency)} />
              {chosen.name}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal">{label}</span>
          )}
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="flex items-center gap-2">
                <Flag code={currencyFlag(a.currency)} />
                {a.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldAlert>{problem}</FieldAlert>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground bg-field/50 rounded-xl px-3 py-2.5 text-sm">{children}</p>;
}

function Submit({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="mt-5 h-11 w-full rounded-xl font-semibold">
      {children}
    </Button>
  );
}

/** The amount typed, in minor units, or a problem to show. */
function useAmount(currency: string) {
  const [text, setText] = useState('');
  const amount = text.trim() ? parseAmount(text, currency as Account['currency']) : null;
  return { text, setText, amount };
}

// ── Balance ──────────────────────────────────────────────────────────────────

function BalanceForm({ position, onDone }: { position: AccountPosition; onDone: () => void }) {
  const t = useTranslations('accountDialog');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const update = useUpdateAccount(workspace.id);
  const { account, balance } = position;
  const [text, setText] = useState(account.openingBalance ? fromMinor(account.openingBalance, account.currency).toString() : '');
  const [problem, setProblem] = useState<string | null>(null);
  const opening = text.trim() ? parseAmount(text, account.currency) : null;
  // Everything recorded on the account so far; the balance is opening + this.
  const moved = balance - account.openingBalance;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (opening === null) return setProblem(message('validation.amount'));
        promiseToast(update.mutateAsync({ accountId: account.id, input: { openingBalance: opening } }), {
          loading: t('saving'),
          success: t('balanceSaved', { account: account.name }),
          error: (error) => message(errorKey(error)),
        }).then(onDone, () => undefined);
      }}
    >
      <AmountInput
        label={t('opening')}
        currency={account.currency}
        value={text}
        onChange={(value) => {
          setProblem(null);
          setText(value);
        }}
        problem={problem}
      />
      <div className="mt-3">
        <Note>
          {opening !== null ? (
            <>
              {t('balanceWillBe')}{' '}
              <MoneyText money={{ amount: opening + moved, currency: account.currency }} className="text-foreground font-semibold" />
            </>
          ) : (
            t('openingHint')
          )}
        </Note>
      </div>
      <Submit pending={update.isPending}>{t('saveBalance')}</Submit>
    </form>
  );
}

// ── Move ─────────────────────────────────────────────────────────────────────

function MoveForm({ account, positions, board, onDone }: { account: Account; positions: AccountPosition[]; board: RateBoard; onDone: () => void }) {
  const t = useTranslations('accountDialog');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const create = useCreateTransfer(workspace.id);
  const targets = positions.map((p) => p.account).filter((a) => a.id !== account.id);
  const [toId, setToId] = useState(targets[0]?.id ?? '');
  const { text, setText, amount } = useAmount(account.currency);
  // What arrives, when it's another currency: today's mid rate unless typed over.
  const [arrivesText, setArrivesText] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const to = targets.find((a) => a.id === toId);
  const converts = Boolean(to && to.currency !== account.currency);

  if (targets.length === 0) return <Note>{t('noOtherAccount')}</Note>;

  // The amount's worth in the other currency at the mid rate, through the base.
  const inBase = converts && amount !== null && amount > 0 ? valueInBase(board, { amount, currency: account.currency }) : null;
  const suggested = to && inBase !== null ? valueFromBase(board, inBase, to.currency) : null;
  const shown = arrivesText ?? (suggested !== null && to ? fromMinor(suggested, to.currency).toString() : '');
  const arrives = !converts ? amount : shown.trim() && to ? parseAmount(shown, to.currency) : null;

  const reset = () => {
    setProblem(null);
    setArrivesText(null);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (amount === null || amount <= 0) return setProblem({ field: 'amount', text: message(amount === null ? 'validation.amount' : 'validation.amountPositive') });
        if (!to) return setProblem({ field: 'to', text: t('pickAccount') });
        if (arrives === null || arrives <= 0) {
          // No rate to suggest it, and nothing typed: say what's missing.
          return setProblem({ field: 'arrives', text: suggested === null && arrivesText === null ? t('noRate') : message('validation.amount') });
        }
        promiseToast(create.mutateAsync({ fromAccountId: account.id, toAccountId: to.id, amountOut: amount, amountIn: arrives }), {
          loading: t('recording'),
          success: t('moved'),
          error: (error) => message(errorKey(error)),
        }).then(onDone, () => undefined);
      }}
      className="flex flex-col gap-4"
    >
      <AmountInput
        label={t('amountMove', { account: account.name })}
        currency={account.currency}
        value={text}
        onChange={(value) => {
          reset();
          setText(value);
        }}
        problem={problem?.field === 'amount' ? problem.text : null}
      />
      <AccountPicker
        label={t('moveTo')}
        accounts={targets}
        value={toId}
        onChange={(id) => {
          reset();
          setToId(id);
        }}
        problem={problem?.field === 'to' ? problem.text : null}
      />
      {/* Another currency: what lands there, at today's mid rate unless changed. */}
      {converts && to ? (
        <AmountInput
          label={t('arrivesAs', { account: to.name })}
          currency={to.currency}
          value={shown}
          onChange={(value) => {
            setProblem(null);
            setArrivesText(value);
          }}
          problem={problem?.field === 'arrives' ? problem.text : null}
        />
      ) : null}
      <Submit pending={create.isPending}>{t('recordMove')}</Submit>
    </form>
  );
}
