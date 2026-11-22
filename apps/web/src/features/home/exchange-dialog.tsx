'use client';

import { accountKind, type CurrencyCode, exchangeRowProfit, exchangeShillings, type ExchangeSide, fromMinor, midRate, parseAmount, toMinor } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { AdminButton, Modal } from '@/components/barista-modal';
import { MoneyInput } from '@/components/money-input';
import { useAccounts } from '@/features/accounts/queries';
import { Field, inputClass, PickSelect } from '@/features/calculator/fields';
import { useCreateDeal } from '@/features/deals/queries';
import { useShortMoney } from '@/features/profit/money-text';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { CAN_RECORD } from '@/lib/api';
import { errorKey, useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { useDaySummary } from './queries';

/** A box that went wrong, once Save is pressed: a red ring. */
const INPUT_ERROR = 'ring-2 ring-red-500/50 focus-visible:ring-red-500/50';
/** A rate as typed: digits and one point, up to six places. */
const plainRate = (typed: string) => {
  const cleaned = typed.replace(/[^\d.]/g, '');
  const at = cleaned.indexOf('.');
  return at === -1 ? cleaned : `${cleaned.slice(0, at)}.${cleaned.slice(at + 1).replace(/\./g, '').slice(0, 6)}`;
};
const sign = (currency: CurrencyCode) => (currency === 'USD' ? '$' : 'KSh');

/**
 * Exchange, kept simple, in Barista's dialog: the shop at the top (its
 * chevron picks another); then From, what the customer hands over, and To,
 * what they get, with ⇄ to turn it round (dollars to shillings, or
 * shillings to dollars); and beside them the rate, today's to start, which
 * can be changed. Under them, the profit: our rate against today's rate.
 */
export function ExchangeDialog({ open, onClose, shopId: startShop }: { open: boolean; onClose: () => void; shopId: string }) {
  const t = useTranslations('exchangeDialog');
  const money = useShortMoney();
  const message = useMessage();
  const shops = useMyWorkspaces().data ?? [];
  const [shopId, setShopId] = useState(startShop);
  const summary = useDaySummary(shopId).data;
  const accounts = (useAccounts(shopId).data ?? []).filter((a) => !a.archived);
  const create = useCreateDeal(shopId);
  // bought: the customer brings dollars, takes shillings. sold: brings shillings, takes dollars.
  const [side, setSide] = useState<ExchangeSide>('bought');
  const [fromText, setFromText] = useState('');
  const [rateText, setRateText] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  // Today's rate (KSh for 1 $), as the shop set it.
  const pair = summary?.board.rates.KES;
  const today = pair ? midRate(pair).toString() : null;
  const rate = rateText ?? today ?? '';
  const rateOk = /^\d+(\.\d{1,6})?$/.test(rate) && Number(rate) > 0;

  // Each time it opens: the shop it was opened on, dollars to shillings, today's rate.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setShopId(startShop);
      setSide('bought');
      setFromText('');
      setRateText(null);
      setTried(false);
    }
  }

  const fromCurrency: CurrencyCode = side === 'bought' ? 'USD' : 'KES';
  const toCurrency: CurrencyCode = side === 'bought' ? 'KES' : 'USD';
  const fromAmount = fromText.trim() ? parseAmount(fromText, fromCurrency) : null;
  // The dollars that change hands, and what the other side comes to at our rate.
  const dollars = !fromAmount || !rateOk ? null : side === 'bought' ? fromAmount : toMinor(fromMinor(fromAmount, 'KES').div(rate), 'USD');
  const toAmount = dollars === null ? null : side === 'bought' ? exchangeShillings(dollars, rate) : dollars;
  const profit = dollars !== null && rateOk ? exchangeRowProfit(side, dollars, rate, today) : null;
  const usdAccount = accounts.find((a) => accountKind(a) === 'cash_usd') ?? accounts.find((a) => a.currency === 'USD');
  const kesAccount = accounts.find((a) => accountKind(a) === 'cash_kes') ?? accounts.find((a) => a.currency === 'KES');
  const errors = {
    from: fromAmount && fromAmount > 0 ? null : t('fromRequired'),
    rate: rateOk ? null : t('rateRequired'),
  };
  const shown = (key: keyof typeof errors) => (tried ? errors[key] : null);
  const dirty = Boolean(fromText.trim()) || rateText !== null;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setTried(true);
    if (errors.from || errors.rate || dollars === null || !usdAccount || !kesAccount) return;
    create.mutateAsync({ type: 'exchange', side, amount: dollars, rate, usdAccountId: usdAccount.id, kesAccountId: kesAccount.id, customer: null, note: null }).then(
      () => {
        gooeyToast.success(t('saved'));
        onClose();
      },
      (error) => gooeyToast.error(t('couldNotSave'), { description: message(errorKey(error)) }),
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('description')}
      dirty={dirty}
      footer={
        <>
          <AdminButton variant="ghost" onClick={onClose}>
            {t('cancel')}
          </AdminButton>
          <AdminButton variant="primary" disabled={create.isPending || !CAN_RECORD} onClick={() => submit()}>
            {create.isPending ? t('saving') : t('save')}
          </AdminButton>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {/* The shop, at the top, with its chevron. */}
        <PickSelect
          id="exchange-shop"
          value={shopId}
          onChange={(next) => {
            setShopId(next);
            setRateText(null);
          }}
          placeholder={t('shop')}
          options={shops.map(({ workspace: shop }) => ({ value: shop.id, label: shop.name, badge: shop.isMain ? t('main') : undefined, detail: shop.location || undefined }))}
        />

        {/* From ⇄ To, and the rate beside them. */}
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_8.5rem]">
          <Field label={t('from', { currency: sign(fromCurrency) })} htmlFor="exchange-from" error={shown('from')}>
            <MoneyInput id="exchange-from" autoFocus placeholder="0" value={fromText} onChange={setFromText} className={cn(inputClass, 'tabular-nums', shown('from') && INPUT_ERROR)} />
          </Field>
          <button
            type="button"
            onClick={() => {
              setSide(side === 'bought' ? 'sold' : 'bought');
              setFromText('');
            }}
            aria-label={t('swap')}
            title={t('swap')}
            className="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 mb-0.5 flex size-10 items-center justify-center self-end rounded-xl transition-colors max-sm:hidden"
          >
            <ArrowLeftRightIcon className="size-4 rtl:-scale-x-100" />
          </button>
          <Field label={t('to', { currency: sign(toCurrency) })} htmlFor="exchange-to">
            <input id="exchange-to" readOnly dir="ltr" tabIndex={-1} value={toAmount === null ? '' : money({ amount: toAmount, currency: toCurrency })} placeholder="0" className={cn(inputClass, 'tabular-nums opacity-80')} />
          </Field>
          <Field label={t('rate')} htmlFor="exchange-rate" error={shown('rate')}>
            <input
              id="exchange-rate"
              inputMode="decimal"
              dir="ltr"
              value={rate}
              onChange={(e) => setRateText(plainRate(e.target.value))}
              placeholder={t('ratePlaceholder')}
              className={cn(inputClass, 'tabular-nums', shown('rate') && INPUT_ERROR)}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            setSide(side === 'bought' ? 'sold' : 'bought');
            setFromText('');
          }}
          className="text-muted-foreground hover:text-foreground -mt-2 flex items-center gap-1.5 text-[0.8125rem] sm:hidden"
        >
          <ArrowLeftRightIcon className="size-3.5" />
          {t('swap')}
        </button>

        {/* The profit: our rate against today's. */}
        <div className="bg-muted ring-border flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-3.5 py-3 ring-1">
          <span className="text-muted-foreground text-[0.8125rem]">{today ? t('todayRate', { rate: today }) : t('noTodayRate')}</span>
          <span className="text-[0.875rem]">
            <span className="text-muted-foreground me-1.5">{t('profit')}</span>
            <span
              dir="ltr"
              className={cn(
                'font-semibold tabular-nums',
                profit && profit.amount > 0 && 'text-emerald-600 dark:text-emerald-400',
                profit && profit.amount < 0 && 'text-red-600 dark:text-red-400',
              )}
            >
              {profit ? money(profit, true) : '—'}
            </span>
          </span>
        </div>

        {CAN_RECORD ? null : <p className="text-muted-foreground text-[0.8125rem]">{t('soon')}</p>}
      </form>
    </Modal>
  );
}
