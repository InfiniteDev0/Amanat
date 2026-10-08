import type { CurrencyCode } from './currencies';
import type { DailyRate, Notification, NotificationType, Workspace } from './entities';
import { missingRates, rateBoard } from './summary';

// When a notification is due. The backend runs these on a schedule (the mock
// runs them when the list is read) and writes at most one notification per
// shop per day for each, in the receiver's own language.

/** Rates should be on the board by this hour, in the shop's own time. */
export const RATES_DUE_HOUR = 9;

/** How long notifications are kept. */
export const NOTIFICATION_DAYS = 90;

/** The hour (0–23) in the given IANA time zone. */
export function hourIn(timeZone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at);
  return Number(hour);
}

/**
 * "Rates not set": the shop's traded currencies still without a rate today,
 * once it's past RATES_DUE_HOUR there. Empty before then, or when all are set.
 * `todaysRates` are the shop's rate rows for its own today.
 */
export function overdueRates(
  workspace: Pick<Workspace, 'baseCurrency' | 'currencies' | 'timeZone'>,
  todaysRates: readonly DailyRate[],
  at: Date = new Date(),
): CurrencyCode[] {
  if (hourIn(workspace.timeZone, at) < RATES_DUE_HOUR) return [];
  return missingRates(workspace, rateBoard(workspace, todaysRates));
}

/** The id that keeps a reminder to one per shop per day ("no duplicates"). */
export function dailyNotificationId(type: NotificationType, workspaceId: string, date: string, userId: string): string {
  return `${type}:${workspaceId}:${date}:${userId}`;
}

/** Still shown: not cleared and not older than NOTIFICATION_DAYS. */
export function isNotificationKept(notification: Pick<Notification, 'clearedAt' | 'createdAt'>, at: Date = new Date()): boolean {
  if (notification.clearedAt) return false;
  return at.getTime() - Date.parse(notification.createdAt) <= NOTIFICATION_DAYS * 24 * 60 * 60 * 1000;
}
