import type { Task } from '@/features/dashboard/tasks';

import type { PushMessage } from './push';

// The morning summary (D17): the home page's to-do list, as one push — what's
// waiting today, most urgent first. A tap opens the home page.

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Null when there's nothing to do — no push on a quiet morning. `monthLine`:
 * a month to close (month-close-rule.ts) — first, and enough on its own.
 */
export function morningSummary(tasks: Task[], monthLine: string | null = null): PushMessage | null {
  const open = tasks.filter((task) => !task.done);
  if (open.length === 0 && !monthLine) return null;

  const count = (keys: string[]) => open.filter((task) => keys.some((key) => task.key.startsWith(key))).length;
  const flying = open.filter((task) => task.group === 'travel' && task.status.label !== 'Tomorrow').length;
  const tomorrow = open.filter((task) => task.group === 'travel' && task.status.label === 'Tomorrow').length;
  const owingFlyers = count(['flying:']);
  const overdue = count(['overdue:']);
  const due = count(['due:']);
  const suppliers = count(['broker:', 'airline:']);
  const visas = count(['visa:']);
  const limit = count(['expense-limit:']);

  const lines = [
    monthLine,
    owingFlyers ? `${plural(owingFlyers, 'client flies', 'clients fly')} soon and still owe` : null,
    flying ? `${plural(flying, 'flight', 'flights')} to confirm today` : null,
    tomorrow ? `${plural(tomorrow, 'flight', 'flights')} tomorrow` : null,
    overdue ? `${plural(overdue, 'invoice', 'invoices')} overdue` : null,
    due ? `${plural(due, 'invoice', 'invoices')} due this week` : null,
    suppliers ? `${plural(suppliers, 'airline or broker', 'airlines or brokers')} to pay` : null,
    visas ? `${plural(visas, 'visa', 'visas')} waiting` : null,
    limit ? 'Expenses near or over the limit' : null,
  ].filter(Boolean);

  return {
    title:
      open.length > 0 ? `Good morning — ${plural(open.length, 'thing', 'things')} for today` : 'Good morning — a month to close',
    body: lines.join(' · ') || 'Open Manasik to see what’s waiting.',
    url: '/workspace',
    tag: 'morning-summary',
  };
}
