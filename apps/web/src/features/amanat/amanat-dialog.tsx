'use client';

import { type AmanatRow, fromMinor, parseAmount } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { AdminButton, Modal } from '@/components/barista-modal';
import { MoneyInput } from '@/components/money-input';
import { useAccountLabel } from '@/features/accounts/account-label';
import { useAccounts } from '@/features/accounts/queries';
import { Field, inputClass, PickSelect } from '@/features/calculator/fields';
import { currencySymbol } from '@/features/profit/money-text';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { CAN_HOLD_AMANAT } from '@/lib/api';
import { errorKey, useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { useHoldAmanat, useUpdateAmanat } from './queries';

/** A box that went wrong, once Save is pressed: a red ring. */
const INPUT_ERROR = 'ring-2 ring-red-500/50 focus-visible:ring-red-500/50';


/**
 * Hold amanat, as Barista's Create an intake: which shop holds it (the main
 * shop to start), the customer, the account it goes into and how much side by
 * side (commas as you type), a note; under them, plainly, where the
 * money goes and that it isn't the shop's. Cancel and Hold amanat at the foot.
 * What's missing is said when Hold is pressed, not before. With `editing`,
 * the same form filled in: its shop stays, and once given back so do its
 * account and amount (the money has left).
 */
export function AmanatDialog({ open, onClose, editing = null, shop: startShop }: { open: boolean; onClose: () => void; editing?: AmanatRow | null; /** The shop to start on (the one picked on the page); else the main shop. */ shop?: string | null }) {
  const t = useTranslations('amanat');
  const tDialog = useTranslations('amanatDialog');
  const tSoon = useTranslations('home.actions');
  const shopName = (id: string) => shops.find((m) => m.workspace.id === id)?.workspace.name ?? workspace.name;
  const message = useMessage();
  const label = useAccountLabel();
  const { workspace } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const mainShop = shops.find((m) => m.workspace.isMain)?.workspace.id ?? workspace.id;
  const [shopId, setShopId] = useState(mainShop);
  const hold = useHoldAmanat(shopId);
  const update = useUpdateAmanat();
  const saving = hold.isPending || update.isPending;
  const locked = Boolean(editing?.returned);
  const accounts = (useAccounts(shopId).data ?? []).filter((a) => !a.archived);
  // Cash dollars to start; another shop's accounts aren't this one's, so a pick from there gives way to its own.
  const startAccount = accounts.find((a) => a.currency === 'USD' && a.type === 'cash')?.id ?? accounts[0]?.id ?? '';
  const [clientName, setClientName] = useState('');
  const [picked, setPicked] = useState('');
  const accountId = accounts.some((a) => a.id === picked) ? picked : startAccount;
  const setAccountId = setPicked;
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  // Each time it opens, it starts empty.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && editing) {
      const { amanat } = editing;
      setShopId(amanat.workspaceId);
      setClientName(editing.clientName);
      setPicked(amanat.accountId);
      setAmountText(fromMinor(amanat.amount, amanat.currency).toString());
      setNote(amanat.note ?? '');
      setTried(false);
    } else if (open) {
      setShopId(startShop ?? mainShop);
      setClientName('');
      setPicked('');
      setAmountText('');
      setNote('');
      setTried(false);
    }
  }

  const account = accounts.find((a) => a.id === accountId);
  const amount = account && amountText.trim() ? parseAmount(amountText, account.currency) : null;
  const errors = {
    clientName: clientName.trim().length < 2 ? tDialog('nameRequired') : null,
    account: account ? null : tDialog('accountRequired'),
    amount: amount && amount > 0 ? null : tDialog('amountRequired'),
  };
  const shown = (key: keyof typeof errors) => (tried ? errors[key] : null);
  const dirty = editing
    ? clientName !== editing.clientName || note !== (editing.amanat.note ?? '') || accountId !== editing.amanat.accountId || amount !== editing.amanat.amount
    : Boolean(clientName.trim() || amountText.trim() || note.trim());

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setTried(true);
    if (errors.clientName || errors.account || errors.amount || !account || !amount) return;
    const input = { clientName: clientName.trim(), accountId: account.id, amount, note: note.trim() || null };
    if (editing) {
      update.mutateAsync({ shopId: editing.amanat.workspaceId, id: editing.amanat.id, input }).then(
        () => {
          gooeyToast.success(tDialog('saved'), { description: clientName.trim() });
          onClose();
        },
        (error) => gooeyToast.error(tDialog('couldNotSave'), { description: message(errorKey(error)) }),
      );
      return;
    }
    hold.mutateAsync(input).then(
      () => {
        gooeyToast.success(t('held'), { description: tDialog('heldBody', { name: clientName.trim(), account: `${label(account)} · ${shopName(shopId)}` }) });
        onClose();
      },
      (error) => gooeyToast.error(tDialog('couldNotSave'), { description: message(errorKey(error)) }),
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? tDialog('editTitle') : tDialog('title')}
      description={editing ? (locked ? tDialog('editLocked') : tDialog('editDescription')) : tDialog('description')}
      dirty={dirty}
      footer={
        <>
          <AdminButton variant="ghost" onClick={onClose}>
            {tDialog('cancel')}
          </AdminButton>
          <AdminButton variant="primary" disabled={saving || !CAN_HOLD_AMANAT || (Boolean(editing) && !dirty)} onClick={() => submit()}>
            {saving ? tDialog('saving') : editing ? tDialog('saveChanges') : tDialog('save')}
          </AdminButton>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={tDialog('shop')} htmlFor="amanat-shop">
          <PickSelect
            id="amanat-shop"
            disabled={Boolean(editing)}
            value={shopId}
            onChange={(next) => {
              setShopId(next);
              setPicked('');
            }}
            placeholder={tDialog('shop')}
            options={shops.map(({ workspace: shop }) => ({ value: shop.id, label: shop.name, badge: shop.isMain ? tDialog('main') : undefined, detail: shop.location || undefined }))}
          />
        </Field>

        <Field label={tDialog('customer')} htmlFor="amanat-customer" error={shown('clientName')}>
          <input
            id="amanat-customer"
            autoFocus
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder={t('clientPlaceholder')}
            maxLength={80}
            className={cn(inputClass, shown('clientName') && INPUT_ERROR)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tDialog('account')} htmlFor="amanat-account" error={shown('account')}>
            <PickSelect
              id="amanat-account"
              disabled={locked}
              value={accountId}
              onChange={setAccountId}
              placeholder={tDialog('pickAccount')}
              options={accounts.map((a) => ({ value: a.id, label: label(a), detail: a.currency }))}
              className={cn(shown('account') && INPUT_ERROR)}
            />
          </Field>
          <Field label={account ? tDialog('amountIn', { currency: currencySymbol(account.currency) }) : tDialog('amount')} htmlFor="amanat-amount" error={shown('amount')}>
            <MoneyInput
              id="amanat-amount"
              disabled={locked}
              placeholder={tDialog('amountPlaceholder')}
              value={amountText}
              onChange={setAmountText}
              className={cn(inputClass, 'tabular-nums disabled:opacity-60', shown('amount') && INPUT_ERROR)}
            />
          </Field>
        </div>

        <Field label={tDialog('note')} htmlFor="amanat-note" optional>
          <input id="amanat-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={tDialog('notePlaceholder')} className={inputClass} />
        </Field>

        {CAN_HOLD_AMANAT ? null : <p className="text-muted-foreground text-[0.8125rem]">{tSoon('soon')}</p>}
      </form>
    </Modal>
  );
}
