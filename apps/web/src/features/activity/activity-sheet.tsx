'use client';

import type { ActivityRow } from '@sarrif/core';
import { HistoryIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { useShortMoney } from '@/features/profit/money-text';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { useActivity } from './queries';

const GROUPS = ['all', 'money', 'day', 'people'] as const;
type Group = (typeof GROUPS)[number];

const GROUP_OF: Record<string, Group> = {
  create: 'money',
  edit: 'money',
  delete: 'money',
  restore: 'money',
  return: 'money',
  set_rates: 'day',
  close: 'day',
  reopen: 'day',
  update_shop: 'people',
  invite: 'people',
  change_role: 'people',
  remove_member: 'people',
};

/** What the line is about: a Sallam or an exchange row, an amanat held or given back, the day, someone… */
function subjectOf({ activity }: ActivityRow): string {
  const record = (activity.after ?? activity.before) as Record<string, unknown> | null;
  if (activity.recordType === 'exchange') return record && !Array.isArray(record) && record.currencyIn === record.currencyOut ? 'sallam' : 'exchange';
  if (activity.recordType === 'amanat') return record && !Array.isArray(record) && record.type === 'withdrawal' ? 'amanatBack' : 'amanat';
  return activity.recordType;
}

function Line({ row }: { row: ActivityRow }) {
  const t = useTranslations('activity');
  const tRoles = useTranslations('roles');
  const tExpenses = useTranslations('expenses');
  const locale = useLocale();
  const money = useShortMoney();
  const { activity } = row;
  const key = `verbs.${activity.action}_${subjectOf(row)}`;
  const after = activity.after as { role?: string } | null;
  const role = after && typeof after.role === 'string' && ['owner', 'editor', 'viewer'].includes(after.role) ? tRoles(after.role as 'owner') : '';
  const verb = t.has(key as never) ? t(key as never, { role } as never) : t('verbs.other');
  const detail = activity.recordType === 'expense' && row.detail && tExpenses.has(`categories.${row.detail}` as never) ? tExpenses(`categories.${row.detail}` as never) : row.detail;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
      className="bg-card mb-2 flex flex-col gap-1 overflow-hidden rounded-xl px-4 py-3 last:mb-0"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-base">
          <span className="font-semibold">{row.user.name}</span> {verb}
        </span>
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(activity.createdAt))}
        </span>
      </span>
      {row.money || detail ? (
        <span className="text-muted-foreground text-sm">
          {[row.money ? money(row.money) : null, detail].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {activity.reason ? <span className="text-sm text-orange-600 dark:text-orange-400">{t('reason', { reason: activity.reason })}</span> : null}
    </motion.li>
  );
}

/**
 * The Activity log (Build Plan v4, 7.6), a drawer from the top bar: who did
 * what on the day the date control shows, newest first, filtered by person
 * and by kind. Owners see everyone; Editors only themselves; Viewers don't
 * get the button.
 */
export function ActivityButton() {
  const t = useTranslations('activity');
  const { workspace, can } = useWorkspace();
  const { day } = useShopDay();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>('all');
  const rows = useActivity(workspace.id, day, open).data;
  if (!can('view_activity_own')) return null;

  const people = [...new Map((rows ?? []).map((r) => [r.user.id, r.user.name])).entries()];
  const shown = (rows ?? []).filter((r) => (!person || r.user.id === person) && (group === 'all' || GROUP_OF[r.activity.action] === group));
  const chip = (picked: boolean) =>
    cn('h-10 shrink-0 rounded-full px-4 text-base font-semibold transition-colors', picked ? 'bg-primary text-primary-foreground' : 'bg-field text-foreground hover:bg-field-focus');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('title')}
        title={t('title')}
        className="hover:bg-foreground/10 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-5"
      >
        <HistoryIcon />
      </button>
      <ActionSheet open={open} onOpenChange={setOpen} title={t('title')} closeLabel={t('close')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('kind')}>
            {GROUPS.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)} className={chip(group === g)}>
                {t(`groups.${g}`)}
              </button>
            ))}
          </div>
          {can('view_activity_all') && people.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('person')}>
              <button type="button" role="radio" aria-checked={person === null} onClick={() => setPerson(null)} className={chip(person === null)}>
                {t('everyone')}
              </button>
              {people.map(([id, name]) => (
                <button key={id} type="button" role="radio" aria-checked={person === id} onClick={() => setPerson(id)} className={chip(person === id)}>
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {!rows ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card h-16 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground py-6 text-base">{t('none')}</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {shown.map((row) => (
                  <Line key={row.activity.id} row={row} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </ActionSheet>
    </>
  );
}
