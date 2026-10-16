'use client';

import { type Account, type AmanatRow, parseAmount } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { Button } from '@/components/ui/button';
import { AccountButtons, AmountBox } from '@/features/profit/fields';
import { useAccountShort, useShortMoney } from '@/features/profit/money-text';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { errorKey, useMessage } from '@/lib/api/errors';

import { useHoldAmanat, useReturnAmanat, useUndoReturn } from './queries';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-lg font-semibold">{label}</span>
      {children}
    </div>
  );
}

const INPUT = 'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg outline-none';

/**
 * Hold money for a client (Build Plan v4, 3.7): the client's name, the account
 * it goes into (cash dollars to start), how much, and a note. It comes into
 * that account; it isn't the shop's, so the drawer count takes it off.
 */
function HoldForm({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const t = useTranslations('amanat');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const hold = useHoldAmanat(workspace.id);
  const [clientName, setClientName] = useState('');
  const [accountId, setAccountId] = useState(accounts.find((a) => a.currency === 'USD' && a.type === 'cash')?.id ?? accounts[0]?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const account = accounts.find((a) => a.id === accountId);
  const amount = account && amountText.trim() ? parseAmount(amountText.replace(/,/g, ''), account.currency) : null;
  const ready = clientName.trim().length >= 2 && Boolean(account) && Boolean(amount && amount > 0) && !hold.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !account || !amount) return;
    hold.mutateAsync({ clientName: clientName.trim(), accountId: account.id, amount, note: note.trim() || null }).then(
      () => {
        gooeyToast.success(t('held'));
        onDone();
      },
      (error) => gooeyToast.error(message(errorKey(error))),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field label={t('client')}>
        <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t('clientPlaceholder')} maxLength={80} autoFocus className={INPUT} />
      </Field>
      <Field label={t('account')}>
        <AccountButtons label={t('account')} accounts={accounts} value={accountId} onChange={setAccountId} />
      </Field>
      <Field label={t('amount')}>
        <AmountBox label={t('amount')} currency={account?.currency ?? 'USD'} value={amountText} onChange={setAmountText} />
      </Field>
      <Field label={t('note')}>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={INPUT} />
      </Field>
      <Button type="submit" disabled={!ready} className="h-14 w-full rounded-xl text-lg font-bold">
        {t('save')}
      </Button>
    </form>
  );
}

/** "+ Amanat": the hold form in a sheet (from the Amanat page and Home's quick action). */
export function HoldSheet({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (open: boolean) => void; accounts: Account[] }) {
  const t = useTranslations('amanat');
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={t('newTitle')} closeLabel={t('close')}>
      {open ? <HoldForm accounts={accounts} onDone={() => onOpenChange(false)} /> : null}
    </ActionSheet>
  );
}

/**
 * One amanat, opened: whose, how much, where it sits, when, by whom; and, while
 * it's held, a big "Given back" button (the money leaves the account).
 */
export function AmanatSheet({ row, accounts, onClose }: { row: AmanatRow | null; accounts: Account[]; onClose: () => void }) {
  const t = useTranslations('amanat');
  const locale = useLocale();
  const message = useMessage();
  const money = useShortMoney();
  const short = useAccountShort();
  const { workspace, can } = useWorkspace();
  const giveBack = useReturnAmanat(workspace.id);
  const undo = useUndoReturn(workspace.id);
  const [shown, setShown] = useState<AmanatRow | null>(null);
  // Keep the last one on screen while the sheet slides away.
  if (row && row !== shown) setShown(row);
  const current = row ?? shown;
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const account = current ? accounts.find((a) => a.id === current.account.id) : undefined;

  const line = (label: string, value: ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-3 text-base">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-semibold">{value}</span>
    </div>
  );

  const returnIt = () => {
    if (!current) return;
    giveBack.mutateAsync(current.amanat.id).then(
      () => {
        const id = current.amanat.id;
        gooeyToast.success(t('returnedToast', { name: current.clientName }), {
          action: { label: t('undo'), successLabel: t('undone'), onClick: () => undo.mutate(id) },
        });
        onClose();
      },
      (error) => gooeyToast.error(message(errorKey(error))),
    );
  };

  return (
    <ActionSheet open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())} title={current?.clientName ?? ''} closeLabel={t('close')}>
      {current ? (
        <div className="flex flex-col gap-6">
          <p className="text-3xl font-bold tabular-nums">{money({ amount: current.amanat.amount, currency: current.amanat.currency })}</p>
          <div className="divide-border/60 flex flex-col divide-y">
            {line(t('account'), account ? short(account) : current.account.name)}
            {line(t('heldOn'), when(current.amanat.createdAt))}
            {current.amanat.returnedAt ? line(t('returnedOn'), when(current.amanat.returnedAt)) : null}
            {current.amanat.note ? line(t('note'), current.amanat.note) : null}
            {line(t('by'), current.recordedBy.name)}
          </div>
          {!current.returned && can('record') ? (
            <Button type="button" onClick={returnIt} disabled={giveBack.isPending} className="h-14 rounded-xl text-lg font-bold">
              {t('giveBack')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </ActionSheet>
  );
}
