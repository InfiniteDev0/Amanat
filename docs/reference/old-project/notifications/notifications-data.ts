import { airlineDebts, brokerDebts } from '@/features/finance/debts';
import {
  amountOutstanding,
  amountPaid,
  invoiceStatus,
  quotationValidUntil,
  serviceLabel,
} from '@/features/finance/finance-data';
import { heldBalance } from '@/features/finance/holdings';
import { daysBetween, plural, totalsText, type ReportRecords } from '@/features/reports/report-data';
import { WORKSPACE_PATH } from '@/features/workspace/navigation';
import { countryName } from '@/lib/countries';
import { formatMoney } from '@/lib/currency';
import { formatDayLabel } from '@/lib/format';

// Notifications are worked out from the records — nothing sends them. Each one
// lasts while its reason does: pay the broker and "Pay the broker" goes away.

export type NotificationKind =
  | 'welcome'
  | 'departure'
  | 'return'
  | 'broker'
  | 'airline'
  | 'collect'
  | 'pending'
  | 'rejected'
  | 'invoice'
  | 'holding'
  | 'quotation';

export interface AppNotification {
  /** Stable while the reason lasts, so "read" sticks to it. */
  id: string;
  kind: NotificationKind;
  title: string;
  /** The day it's about, `yyyy-mm-dd` — sorts the list and gives its time label. */
  date: string;
  /** Label–value rows: who, what and how much. */
  details: { label: string; value: string }[];
  /** Where to deal with it, and what its button says. */
  href: string;
  action: string;
}

/** Flights this many days ahead get a reminder. */
const FLIGHT_WARNING_DAYS = 7;
/** A visa pending this long is worth chasing with its broker. */
const PENDING_VISA_DAYS = 3;
/** A rejected visa is news for this long. */
const REJECTED_VISA_DAYS = 30;
/** Open quotations this close to their "valid until" day are about to expire… */
const QUOTATION_WARNING_DAYS = 3;
/** …and ones this old, with more time left, are worth a follow-up call. */
const QUOTATION_FOLLOW_UP_DAYS = 2;

/** "today", "tomorrow", "in 5 days". */
function inDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${plural(days, 'day')}`;
}

/** The agency, for the note that greets it. */
export interface AgencyGreeting {
  name: string;
  /** Their first name — the card says hello properly. */
  person: string;
  /** How many countries they pinned in setup. */
  destinations: number;
}

/** Everything that needs the agency's attention, nearest to today first. */
export function buildNotifications(
  {
    tickets,
    visas,
    quotations,
    invoices,
    payments,
    holdings,
    holdingMoves,
  }: Pick<ReportRecords, 'tickets' | 'visas' | 'quotations' | 'invoices' | 'payments' | 'holdings' | 'holdingMoves'>,
  today: string,
  agency?: AgencyGreeting,
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const visasPath = `${WORKSPACE_PATH}/visas`;

  // The first thing in a new agency's bell. It stays until it's cleared.
  if (agency) {
    notifications.push({
      id: 'welcome',
      kind: 'welcome',
      title: `Welcome, ${agency.person}`,
      date: today,
      details: [
        { label: 'Agency', value: agency.name },
        {
          label: 'Countries',
          value: agency.destinations > 0 ? plural(agency.destinations, 'country', 'countries') : 'None yet',
        },
        { label: 'Next', value: 'Add your first ticket' },
      ],
      href: `${WORKSPACE_PATH}/tickets`,
      action: 'Add a ticket',
    });
  }

  for (const ticket of tickets) {
    const flights = [
      { kind: 'departure' as const, day: ticket.departure, title: 'Flying out' },
      { kind: 'return' as const, day: ticket.returnDate, title: 'Flying back' },
    ];
    for (const { kind, day, title } of flights) {
      if (!day) continue;
      const days = daysBetween(today, day);
      if (days < 0 || days > FLIGHT_WARNING_DAYS) continue;
      notifications.push({
        id: `${kind}-${ticket.id}-${day}`,
        kind,
        title: `${title} ${inDays(days)}`,
        date: day,
        details: [
          { label: 'Traveller', value: ticket.traveller },
          { label: 'Airline', value: ticket.airline || '—' },
          { label: 'Route', value: ticket.route || '—' },
          { label: 'PNR', value: ticket.pnr || '—' },
        ],
        href: `${WORKSPACE_PATH}/tickets`,
        action: 'Open Tickets',
      });
    }
  }

  for (const visa of visas) {
    const country = visa.country ? countryName(visa.country) : '—';
    const age = daysBetween(visa.date, today);

    // Approved but not paid for — the visa's own invoice says so.
    const visaInvoice = invoices.find((invoice) => invoice.recordId === visa.id && invoice.state !== 'cancelled');
    if (visa.status === 'approved' && visaInvoice && invoiceStatus(visaInvoice, payments, today) !== 'paid') {
      const owed = amountOutstanding(visaInvoice, payments);
      notifications.push({
        id: `collect-${visa.id}`,
        kind: 'collect',
        title: 'Collect the visa payment',
        date: visa.date,
        details: [
          { label: 'Traveller', value: visa.traveller },
          { label: 'Visa', value: `${country} · Approved` },
          { label: 'Invoice', value: visaInvoice.number },
          { label: 'Owed', value: visaInvoice.amount === null ? 'No price yet' : formatMoney(owed, visa.currency) },
        ],
        href: visasPath,
        action: 'Record a payment',
      });
    }
    if (visa.status === 'pending' && age >= PENDING_VISA_DAYS) {
      notifications.push({
        id: `pending-${visa.id}`,
        kind: 'pending',
        title: 'Visa still pending',
        date: visa.date,
        details: [
          { label: 'Traveller', value: visa.traveller },
          { label: 'Country', value: country },
          { label: 'Broker', value: visa.broker || '—' },
          { label: 'Waiting', value: plural(age, 'day') },
        ],
        href: visasPath,
        action: 'Check on it',
      });
    }
    if (visa.status === 'rejected' && age <= REJECTED_VISA_DAYS) {
      notifications.push({
        id: `rejected-${visa.id}`,
        kind: 'rejected',
        title: 'Visa rejected',
        date: visa.date,
        details: [
          { label: 'Traveller', value: visa.traveller },
          { label: 'Country', value: country },
          { label: 'Broker', value: visa.broker || '—' },
          { label: 'Applied', value: formatDayLabel(visa.date) },
        ],
        href: visasPath,
        action: 'Tell the client',
      });
    }
  }

  // Brokers and airlines you owe — one each, with the total across every visa
  // or ticket, since they're usually paid for several at once.
  const debtsPath = `${WORKSPACE_PATH}/reports/debts`;
  for (const group of brokerDebts(visas)) {
    notifications.push({
      id: `broker-${group.name}-${group.items.map(({ id }) => id).join('-')}`,
      kind: 'broker',
      title: `Pay ${group.name}`,
      date: group.items.reduce((oldest, visa) => (visa.date < oldest ? visa.date : oldest), today),
      details: [
        { label: 'Broker', value: group.name },
        { label: 'Visas', value: plural(group.items.length, 'approved visa') },
        { label: 'You owe', value: totalsText(group.total) },
      ],
      href: debtsPath,
      action: 'Pay the broker',
    });
  }
  for (const group of airlineDebts(tickets)) {
    notifications.push({
      id: `airline-${group.name}-${group.items.map(({ id }) => id).join('-')}`,
      kind: 'airline',
      title: `Pay ${group.name}`,
      date: group.items.reduce((oldest, ticket) => (ticket.date < oldest ? ticket.date : oldest), today),
      details: [
        { label: 'Airline', value: group.name },
        { label: 'Tickets', value: plural(group.items.length, 'ticket') },
        { label: 'You owe', value: totalsText(group.total) },
      ],
      href: debtsPath,
      action: 'Pay the airline',
    });
  }

  // An approved visa's invoice already has its own "Collect the visa payment" above.
  const approvedVisas = new Set(visas.filter((visa) => visa.status === 'approved').map((visa) => visa.id));
  for (const invoice of invoices) {
    if (invoice.state === 'cancelled') continue;
    if (invoice.recordId && approvedVisas.has(invoice.recordId)) continue;
    const outstanding = amountOutstanding(invoice, payments);
    if (outstanding <= 0) continue;

    // A part-paid invoice is a different conversation from one never paid.
    const paid = amountPaid(invoice, payments);
    const overdue = invoiceStatus(invoice, payments, today) === 'overdue';
    const waiting = Math.max(0, daysBetween(invoice.date, today));
    notifications.push({
      id: `invoice-${invoice.id}`,
      kind: 'invoice',
      title: overdue ? 'Invoice overdue' : paid > 0 ? 'Balance still owing' : 'Waiting for payment',
      date: overdue ? invoice.dueDate : invoice.date,
      details: [
        { label: 'Invoice', value: invoice.number },
        { label: 'Client', value: invoice.client },
        ...(paid > 0 ? [{ label: 'Paid', value: formatMoney(paid, invoice.currency) }] : []),
        { label: 'Outstanding', value: formatMoney(outstanding, invoice.currency) },
        {
          label: overdue ? 'Was due' : 'Waiting',
          value: overdue ? formatDayLabel(invoice.dueDate) : waiting === 0 ? 'Since today' : plural(waiting, 'day'),
        },
      ],
      href: `${WORKSPACE_PATH}/finance/invoices/${invoice.id}`,
      action: 'Record a payment',
    });
  }

  // Money held for a client who hasn't decided yet — use it or give it back.
  for (const holding of holdings) {
    const held = heldBalance(holding, holdingMoves);
    if (held <= 0) continue;
    notifications.push({
      id: `holding-${holding.id}-${held}`,
      kind: 'holding',
      title: 'Money being held',
      date: holding.date,
      details: [
        { label: 'Client', value: holding.client },
        { label: 'Holding', value: holding.number },
        { label: 'For', value: serviceLabel(holding.service) },
        { label: 'Still held', value: formatMoney(held, holding.currency) },
      ],
      href: `${WORKSPACE_PATH}/finance/holding`,
      action: 'Open Holdings',
    });
  }

  for (const quotation of quotations) {
    if (quotation.invoiceId) continue;
    const validUntil = quotationValidUntil(quotation);
    const daysLeft = daysBetween(today, validUntil);
    const age = daysBetween(quotation.date, today);
    if (daysLeft < 0) continue;
    const expiring = daysLeft <= QUOTATION_WARNING_DAYS;
    if (!expiring && age < QUOTATION_FOLLOW_UP_DAYS) continue;
    notifications.push({
      id: `quotation-${quotation.id}-${expiring ? 'expiring' : 'follow-up'}`,
      kind: 'quotation',
      title: expiring
        ? daysLeft === 0
          ? 'Quotation expires today'
          : 'Quotation about to expire'
        : 'Follow up on the quotation',
      date: expiring ? validUntil : quotation.date,
      details: [
        { label: 'Quotation', value: quotation.number },
        { label: 'Client', value: quotation.client },
        { label: 'Amount', value: formatMoney(quotation.amount, quotation.currency) },
        { label: 'Valid until', value: formatDayLabel(validUntil) },
      ],
      href: `${WORKSPACE_PATH}/finance/quotations/${quotation.id}`,
      action: 'Open quotation',
    });
  }

  // Nearest to today first — a flight today before one next week, yesterday's
  // news before last week's.
  const distance = (notification: AppNotification) => Math.abs(daysBetween(today, notification.date));
  return notifications.sort((a, b) => distance(a) - distance(b) || b.date.localeCompare(a.date));
}

/** "Today", "Tomorrow", "Yesterday", "3 days ago", "In 2 days". */
export function whenLabel(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${plural(days, 'day')}` : `${plural(-days, 'day')} ago`;
}
