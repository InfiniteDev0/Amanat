import type { CurrencyCode } from './currencies';
import type { BusinessDate } from './dates';

// The records the app stores, one interface per entity in the product spec.
// Field names are camelCase here and snake_case in the database; the backend
// adapter maps between them. Amounts are minor units (see money.ts), rates are
// decimal strings (see rates.ts), timestamps are ISO strings.
//
// Everything except User and Currency belongs to exactly one workspace.

export type Id = string;
/** An ISO 8601 timestamp: "2026-10-07T09:15:00.000Z". */
export type Timestamp = string;

export const LANGUAGES = ['en', 'so', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const ROLES = ['owner', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/** Soft delete: records are never erased, see "Nothing is silently changed". */
interface Recorded {
  id: Id;
  workspaceId: Id;
  createdBy: Id;
  createdAt: Timestamp;
  deletedAt: Timestamp | null;
}

// ── People and access ────────────────────────────────────────────────────────

export interface User {
  id: Id;
  /** Empty until they finish the profile step after their first sign-in. */
  name: string;
  /** E.164: +254712345678 */
  phone: string;
  email: string | null;
  /** Profile photo: a URL (the real backend's storage) or a small data URL (the mock). */
  avatar: string | null;
  language: Language;
  createdAt: Timestamp;
}

export interface Workspace {
  id: Id;
  name: string;
  location: string;
  baseCurrency: CurrencyCode;
  /** The currencies this shop trades; always includes the base. */
  currencies: CurrencyCode[];
  /** IANA zone the shop's day is counted in, e.g. 'Africa/Nairobi'. */
  timeZone: string;
  /** "21:00": when "Day not closed" fires. */
  closingTime: string;
  /** Entries above this (base minor units) raise "Large transaction". */
  largeTransactionLimit: number;
  ownerId: Id;
  status: 'active' | 'archived';
  createdAt: Timestamp;
}

export interface Member {
  id: Id;
  workspaceId: Id;
  userId: Id;
  role: Role;
  joinedAt: Timestamp;
}

export interface Invitation {
  id: Id;
  workspaceId: Id;
  phone: string | null;
  email: string | null;
  role: Role;
  invitedBy: Id;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export type ActivityAction = 'create' | 'edit' | 'delete' | 'close' | 'reopen';

/** Append-only. */
export interface ActivityLog {
  id: Id;
  workspaceId: Id;
  userId: Id;
  action: ActivityAction;
  recordType: string;
  recordId: Id;
  before: unknown;
  after: unknown;
  /** Required when an Owner changes a closed day. */
  reason: string | null;
  createdAt: Timestamp;
}

// ── Money and where it sits ──────────────────────────────────────────────────

export const ACCOUNT_TYPES = ['cash', 'mobile_money', 'bank'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface Account {
  id: Id;
  workspaceId: Id;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  /** M-Pesa, EVC Plus, Zaad, or the bank's name. */
  provider: string | null;
  openingBalance: number;
  /** "Low balance" fires below this; null for no alert. */
  minimumBalance: number | null;
  archived: boolean;
  createdAt: Timestamp;
}

export interface DailyRate {
  id: Id;
  workspaceId: Id;
  currency: CurrencyCode;
  date: BusinessDate;
  /** Units of `currency` per 1 base unit; see rates.ts. */
  buy: string;
  sell: string;
  setBy: Id;
  setAt: Timestamp;
}

/** What created an entry. Entries are never written by hand. */
export const SOURCE_TYPES = ['exchange', 'expense', 'transfer', 'amanat', 'debt_payment'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** One money movement on one account: the ledger. */
export interface Entry extends Recorded {
  accountId: Id;
  date: BusinessDate;
  /** + money in, − money out, in the account's currency. */
  amount: number;
  currency: CurrencyCode;
  sourceType: SourceType;
  sourceId: Id;
}

// ── Customers and obligations ────────────────────────────────────────────────

export interface Client {
  id: Id;
  workspaceId: Id;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: Timestamp;
}

export interface Amanat extends Recorded {
  clientId: Id;
  date: BusinessDate;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: CurrencyCode;
  accountId: Id;
  note: string | null;
}

export type DebtDirection = 'they_owe_us' | 'we_owe_them';
export type DebtStatus = 'open' | 'partly_paid' | 'paid';

/** Status is not stored: it follows from the payments (see ledger.ts). */
export interface Debt extends Recorded {
  clientId: Id;
  date: BusinessDate;
  direction: DebtDirection;
  amount: number;
  currency: CurrencyCode;
  dueDate: BusinessDate | null;
  note: string | null;
}

export interface DebtPayment extends Recorded {
  debtId: Id;
  date: BusinessDate;
  amount: number;
  accountId: Id;
}

// ── Daily operations ─────────────────────────────────────────────────────────

export interface Exchange extends Recorded {
  date: BusinessDate;
  currencyIn: CurrencyCode;
  amountIn: number;
  accountIn: Id;
  currencyOut: CurrencyCode;
  amountOut: number;
  accountOut: Id;
  /** amountOut per 1 amountIn; see rates.ts `displayRate` for showing it. */
  rate: string;
  /** Null for a walk-in. */
  clientId: Id | null;
  note: string | null;
}

export const EXPENSE_CATEGORIES = ['rent', 'salary', 'transport', 'food', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense extends Recorded {
  date: BusinessDate;
  category: ExpenseCategory;
  amount: number;
  currency: CurrencyCode;
  accountId: Id;
  note: string | null;
}

/** Own money between own accounts, in this shop or another shop of the same owner. */
export interface Transfer extends Recorded {
  date: BusinessDate;
  fromAccountId: Id;
  toAccountId: Id;
  /** The other shop for a shop-to-shop transfer; null within one shop. */
  toWorkspaceId: Id | null;
  /** Leaves `from`, in its currency. */
  amountOut: number;
  /** Arrives at `to`, in its currency. */
  amountIn: number;
  /** Charged on top of amountOut, in `from`'s currency. */
  fee: number;
  note: string | null;
}

/** One account's count at the end of a day. A day is closed once it has these. */
export interface DailyClosing {
  id: Id;
  workspaceId: Id;
  date: BusinessDate;
  accountId: Id;
  expected: number;
  counted: number;
  difference: number;
  /** Required when difference is not zero. */
  note: string | null;
  closedBy: Id;
  closedAt: Timestamp;
}

export const NOTIFICATION_TYPES = [
  'rates_not_set',
  'day_not_closed',
  'closing_difference',
  'daily_summary',
  'large_transaction',
  'past_entry_changed',
  'entry_deleted',
  'debt_due',
  'debt_overdue',
  'amanat_withdrawal',
  'low_balance',
  'invitation_accepted',
  'role_changed',
  'new_device',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPriority = 'low' | 'normal' | 'high';

export interface Notification {
  id: Id;
  userId: Id;
  workspaceId: Id;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app path to the record it is about. */
  link: string | null;
  priority: NotificationPriority;
  readAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface NotificationSetting {
  userId: Id;
  workspaceId: Id;
  type: NotificationType;
  inApp: boolean;
  push: boolean;
  sms: boolean;
}
