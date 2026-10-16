'use client';

import { type Account, EXPENSE_CATEGORIES, type ExpenseCategory, parseAmount } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { FieldAlert } from '@/components/ui/field-alert';
import { Button } from '@/components/ui/button';
import { AccountButtons, AmountBox } from '@/features/profit/fields';
import { useCreateExpense } from '@/features/records/mutations';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';
import { cn } from '@/lib/utils';

/**
 * Record an expense in an action sheet (Build Plan v4, 3.8): what for, how much, paid from which
 * account (its currency is the expense's), and a note. From the Profit page's
 * "+ Add expense", and later Home's Expense quick action.
 */
export function ExpenseDialog({ open, onOpenChange, accounts }: { open: boolean; onOpenChange: (open: boolean) => void; accounts: Account[] }) {
  const t = useTranslations('expenses');
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={t('add')} closeLabel={t('close')}>
      {open ? <ExpenseForm accounts={accounts} onDone={() => onOpenChange(false)} /> : null}
    </ActionSheet>
  );
}

function ExpenseForm({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const t = useTranslations('expenses');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const create = useCreateExpense(workspace.id);
  // Paid in cash shillings, usually.
  const [accountId, setAccountId] = useState((accounts.find((a) => a.currency === 'KES' && a.type === 'cash') ?? accounts[0])?.id ?? '');
  const account = accounts.find((a) => a.id === accountId);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const amount = text.trim() && account ? parseAmount(text.replace(/,/g, ''), account.currency) : null;
  const [problem, setProblem] = useState<{ field: string; text: string } | null>(null);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!category) return setProblem({ field: 'category', text: t('pickCategory') });
        if (amount === null || amount <= 0) return setProblem({ field: 'amount', text: message(amount === null ? 'validation.amount' : 'validation.amountPositive') });
        if (!account) return setProblem({ field: 'account', text: t('pickAccount') });
        promiseToast(create.mutateAsync({ category, amount, currency: account.currency, accountId: account.id, note: note.trim() || null }), {
          loading: t('saving'),
          success: t('saved'),
          error: (error) => message(errorKey(error)),
        }).then(onDone, () => undefined);
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <span className="mb-3 block text-lg font-semibold">{t('category')}</span>
        <div role="radiogroup" aria-label={t('category')} className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => {
                setProblem(null);
                setCategory(value);
              }}
              className={cn(
                'h-12 rounded-full px-5 text-base font-medium transition-colors',
                category === value ? 'bg-primary text-primary-foreground' : 'bg-field text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`categories.${value}`)}
            </button>
          ))}
        </div>
        <FieldAlert>{problem?.field === 'category' ? problem.text : null}</FieldAlert>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-lg font-semibold">{t('paidFrom')}</span>
        <AccountButtons
          label={t('paidFrom')}
          accounts={accounts}
          value={accountId}
          onChange={(id) => {
            setProblem(null);
            setAccountId(id);
          }}
        />
        <FieldAlert>{problem?.field === 'account' ? problem.text : null}</FieldAlert>
      </div>
      <div className="flex flex-col gap-3">
        <span className="text-lg font-semibold">{t('amount')}</span>
        <AmountBox
          label={t('amount')}
          currency={account?.currency ?? 'KES'}
          value={text}
          onChange={(value) => {
            setProblem(null);
            setText(value);
          }}
        />
        <FieldAlert>{problem?.field === 'amount' ? problem.text : null}</FieldAlert>
      </div>
      <label className="block">
        <span className="mb-3 block text-lg font-semibold">{t('note')}</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg outline-none"
        />
      </label>
      <Button type="submit" disabled={create.isPending} className="h-14 w-full rounded-xl text-lg font-bold">
        {t('record')}
      </Button>
    </form>
  );
}
