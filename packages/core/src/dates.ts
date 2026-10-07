// A shop's "day" is a calendar date in the shop's own time zone, written
// YYYY-MM-DD. Entries, rates and closings all hang off it. Never use the
// browser's or the server's local date for this.

export type BusinessDate = string;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isBusinessDate(value: unknown): value is BusinessDate {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

/** Today's date in the given IANA time zone, e.g. 'Africa/Nairobi'. */
export function businessDate(timeZone: string, at: Date = new Date()): BusinessDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The date `days` after (or before, when negative) a business date. */
export function addDays(date: BusinessDate, days: number): BusinessDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
