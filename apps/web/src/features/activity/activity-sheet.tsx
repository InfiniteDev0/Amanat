'use client';

import type { ActivityRow } from '@sarrif/core';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
/** Streamline's Time Lapse, as Barista's: a clock in a broken circle, "what happened, and when". */
export function ActivityGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.905 2.905C2.021 3.79 1.5 5.138 1.5 7c0 1.862 0.521 3.21 1.405 4.095C3.79 11.979 5.138 12.5 7 12.5c2.365 0 3.915 -0.836 4.742 -2.246a0.75 0.75 0 0 1 1.293 0.759C11.867 13.005 9.738 14 7 14c-2.138 0 -3.914 -0.604 -5.155 -1.845C0.604 10.915 0 9.138 0 7c0 -2.138 0.604 -3.914 1.845 -5.155C3.085 0.604 4.862 0 7 0h0.006c0.32 0.003 1.144 0.03 1.65 0.144a0.75 0.75 0 1 1 -0.328 1.463c-0.33 -0.074 -1.004 -0.104 -1.331 -0.107 -1.86 0 -3.208 0.522 -4.092 1.405Zm8.206 -1.716a0.75 0.75 0 0 0 -0.675 1.34c0.483 0.243 0.87 0.577 1.167 0.995a0.75 0.75 0 0 0 1.224 -0.867 4.632 4.632 0 0 0 -1.716 -1.468Zm1.29 6.969a0.75 0.75 0 0 0 1.48 0.247A8.54 8.54 0 0 0 13.99 7c0 -0.49 -0.037 -0.96 -0.11 -1.405a0.75 0.75 0 0 0 -1.48 0.247c0.06 0.356 0.09 0.741 0.09 1.158 0 0.417 -0.03 0.802 -0.09 1.158ZM7.75 4.75a0.75 0.75 0 0 0 -1.5 0v2.5c0 0.18 0.064 0.352 0.18 0.488l2.062 2.403a0.75 0.75 0 0 0 1.139 -0.977L7.75 6.972V4.75Z"
      />
    </svg>
  );
}

export function ActivityButton({ className }: { className?: string }) {
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
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('title')}
              // 17px: this clock fills its whole box, so it reads larger than the bar's other 18px icons.
              className={cn(className, '[&_svg]:size-[17px]!')}
            />
          }
        >
          <ActivityGlyph />
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('title')}</TooltipContent>
      </Tooltip>
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
