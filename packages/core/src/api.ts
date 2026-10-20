import type { CurrencyCode } from './currencies';
import type { BusinessDate } from './dates';
import type {
  Account,
  ActivityLog,
  Amanat,
  Client,
  DailyClosing,
  DailyRate,
  Debt,
  DebtPayment,
  Exchange,
  Expense,
  Id,
  Invitation,
  Member,
  Notification,
  Role,
  Timestamp,
  Transfer,
  User,
  Workspace,
} from './entities';
import type { Money } from './money';
import type {
  CreateAccountInput,
  CreateAmanatInput,
  CreateClientInput,
  CreateDealInput,
  CreateDebtInput,
  CreateDebtPaymentInput,
  CreateExchangeInput,
  CreateExpenseInput,
  CreateTransferInput,
  CreateWorkspaceInput,
  OnboardingInput,
  ProfileInput,
  SignUpInput,
  LogInInput,
  GoogleSignInInput,
  EmailLinkInput,
  NewPasswordInput,
  CompleteProfileInput,
  SetRatesInput,
  UpdateAccountInput,
  HoldAmanatInput,
  CloseDayInput,
  ReopenDayInput,
  InviteInput,
  UpdateWorkspaceInput,
} from './schemas';
import type { ClosingLine } from './closing';
import type { RateBoard } from './rates';
import type { Report } from './reports';
import type { DaySummary } from './summary';

// The contract between the UI and the backend.
//
// The UI only ever talks to a `SarrifApi`. Today that is the in-browser mock
// (apps/web/src/lib/api/mock); later it is a thin client over server actions
// backed by Supabase. Swapping one for the other must not change a single
// screen, which is why every page reaches data through this interface and
// nothing else.
//
// Rules every implementation follows:
// - Every workspace call checks membership and `can(role, action)`.
// - Inputs are parsed with the schemas in schemas.ts before anything else.
// - Money records write their entries with `entriesFor` (ledger.ts), in the
//   same transaction as the record and its activity-log row.
// - The record's date is "today" in the shop's time zone, set by the backend.
// - Failures are thrown as `ApiError`, never as raw database errors.

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'conflict'
  | 'day_closed'
  | 'rate_limited'
  | 'unavailable';

export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly code: ApiErrorCode,
    /** A translation key under `errors.*`, shown to the user. */
    readonly messageKey: string = `errors.${code}`,
    /** Field → translation key, for highlighting the form field at fault. */
    readonly fields: Record<string, string> = {},
  ) {
    super(messageKey);
  }
}

export interface WorkspaceMembership {
  workspace: Workspace;
  role: Role;
}

/**
 * After Sign up: in straight away (no email check, as in the demo), or "check
 * your email". An address that already has an account gets the same answer as
 * a new one, so the form never reveals who has an account.
 */
export type SignUpResult = { status: 'signed_in'; user: User } | { status: 'confirm_email' };

export type BookRowType = 'exchange' | 'expense' | 'amanat' | 'debt' | 'debt_payment' | 'transfer';
/** The Book's filter chips: "Debt" covers new debts and repayments. */
export type BookFilterType = 'exchange' | 'expense' | 'amanat' | 'debt' | 'transfer';

/** One row of the Book: one record, Excel-style. */
export interface BookRow {
  /** The record's id. */
  id: Id;
  type: BookRowType;
  date: BusinessDate;
  createdAt: string;
  client: { id: Id; name: string } | null;
  /** What came into the shop (null for pure money out). */
  in: Money | null;
  /** What left the shop (null for pure money in). */
  out: Money | null;
  /** Exchanges only: out per 1 in. */
  rate: string | null;
  accounts: { id: Id; name: string }[];
  /** Expense category, 'deposit' / 'withdrawal', or debt direction. */
  detail: string | null;
  recordedBy: { id: Id; name: string };
  note: string | null;
  /** Its day is closed. */
  locked: boolean;
}

/** One deal on the Profit page: the deal, its profit and who's who. */
export interface DealRow {
  deal: Exchange;
  /** What it made (negative: a cost); null when it needs a rate nobody set. */
  profit: Money | null;
  from: { id: Id; name: string };
  to: { id: Id; name: string };
  recordedBy: { id: Id; name: string };
  /** Its day is closed. */
  locked: boolean;
}

/** One expense on the Profit page, with its account and who recorded it. */
export interface ExpenseRow {
  expense: Expense;
  account: { id: Id; name: string };
  recordedBy: { id: Id; name: string };
  /** Its day is closed. */
  locked: boolean;
}

/** One amanat on the Amanat page: the money held, whose, where, and whether it's been given back. */
export interface AmanatRow {
  /** The deposit. */
  amanat: Amanat;
  clientName: string;
  account: { id: Id; name: string };
  recordedBy: { id: Id; name: string };
  returned: boolean;
}

/** Close day for one day: what each account should hold, and the closing if it's done. */
export interface ClosingView {
  date: BusinessDate;
  lines: ClosingLine[];
  /** The day's rate board, for the KSh total. */
  board: RateBoard;
  /** Null while the day is open. */
  closed: { by: { id: Id; name: string }; at: Timestamp; counts: DailyClosing[] } | null;
}

/** One line of the Activity log: who did what, when, and to how much. */
export interface ActivityRow {
  activity: ActivityLog;
  user: { id: Id; name: string };
  /** The amount involved, when there is one. */
  money: Money | null;
  /** A name to go with it: the client, the person invited, the account… */
  detail: string | null;
}

/** Someone in the shop, on the People page. */
export interface MemberRow {
  member: Member;
  user: { id: Id; name: string; phone: string };
  /** When they last did something in this shop. */
  lastActive: Timestamp | null;
  /** Who invited them; null for whoever made the shop. */
  invitedBy: { id: Id; name: string } | null;
}

export interface TeamView {
  members: MemberRow[];
  /** Invitations not yet accepted. */
  invitations: Invitation[];
}

export interface BookFilter {
  /** One day; defaults to today. */
  date?: BusinessDate;
  type?: BookFilterType;
  /** Matches client name or note. */
  search?: string;
}

/**
 * Today's mid-market rates from a public source: a guide while a shop sets
 * its own buy and sell, never the shop's rate. Same convention as the board:
 * units of each currency per 1 base unit, as decimal strings.
 */
export interface MarketRates {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, string>>;
  /** When the source last updated them (ISO). */
  updatedAt: string;
  /** Name of the source, shown as credit. */
  source: string;
}

export interface SarrifApi {
  /**
   * Email + password, or Google (Phase 1b). The phone is profile data, never
   * a way in. A wrong password and an unknown email fail the same way
   * (`errors.wrongLogin`), so nobody can probe who has an account.
   */
  auth: {
    signUp(input: SignUpInput): Promise<SignUpResult>;
    logIn(input: LogInInput): Promise<User>;
    /** Leaves for Google's page; the browser comes back signed in. */
    signInWithGoogle(input: GoogleSignInInput): Promise<void>;
    /** Sends the sign-up email again. Says nothing about whether the address has an account. */
    resendConfirmation(input: EmailLinkInput): Promise<void>;
    /** Emails a link to set a new password, if the address has an account (and says nothing either way). */
    requestPasswordReset(input: EmailLinkInput): Promise<void>;
    /** The signed-in user (after the reset link) sets a new password. */
    setNewPassword(input: NewPasswordInput): Promise<void>;
    /** Google sign-ups: the phone and the terms, before anything else. */
    completeProfile(input: CompleteProfileInput): Promise<User>;
    /** The signed-in user, or null. */
    getSession(): Promise<User | null>;
    updateProfile(input: ProfileInput): Promise<User>;
    signOut(): Promise<void>;
  };

  onboarding: {
    /**
     * Saves the first-run setup at once: profile, shop (caller = Owner),
     * accounts and today's rates. All or nothing.
     */
    complete(input: OnboardingInput): Promise<{ user: User; workspace: Workspace }>;
  };

  market: {
    /** Today's reference rates against `base`. Needs no sign-in. */
    rates(base: CurrencyCode): Promise<MarketRates>;
  };

  workspaces: {
    /** Owners: the shop's name, place, closing time and large-row limit. */
    update(workspaceId: Id, input: UpdateWorkspaceInput): Promise<Workspace>;
    /** Every shop the user is a member of, with their role there. */
    listMine(): Promise<WorkspaceMembership[]>;
    /** Creates the shop and makes the caller its Owner. */
    create(input: CreateWorkspaceInput): Promise<Workspace>;
  };

  accounts: {
    list(workspaceId: Id): Promise<Account[]>;
    create(workspaceId: Id, input: CreateAccountInput): Promise<Account>;
    /** Owners: set the money the account started with (its balance = that + its entries). */
    update(workspaceId: Id, accountId: Id, input: UpdateAccountInput): Promise<Account>;
  };

  rates: {
    forDate(workspaceId: Id, date: BusinessDate): Promise<DailyRate[]>;
    /** Replaces that day's rate for each currency given. */
    set(workspaceId: Id, input: SetRatesInput): Promise<DailyRate[]>;
  };

  clients: {
    list(workspaceId: Id): Promise<Client[]>;
    create(workspaceId: Id, input: CreateClientInput): Promise<Client>;
  };

  records: {
    createExchange(workspaceId: Id, input: CreateExchangeInput): Promise<Exchange>;
    createExpense(workspaceId: Id, input: CreateExpenseInput): Promise<Expense>;
    createAmanat(workspaceId: Id, input: CreateAmanatInput): Promise<Amanat>;
    createDebt(workspaceId: Id, input: CreateDebtInput): Promise<Debt>;
    createDebtPayment(workspaceId: Id, input: CreateDebtPaymentInput): Promise<DebtPayment>;
    createTransfer(workspaceId: Id, input: CreateTransferInput): Promise<Transfer>;
  };

  book: {
    /** Newest first. */
    list(workspaceId: Id, filter?: BookFilter): Promise<BookRow[]>;
  };

  /** The exchange sheet (deals.ts): swaps (cash ↔ mobile for a %) and USD ↔ KSh exchanges. */
  amanat: {
    /** Every amanat of the shop: the ones still held first (newest first), then those given back. */
    list(workspaceId: Id): Promise<AmanatRow[]>;
    /** Holds money for a client today: it comes into the account. */
    hold(workspaceId: Id, input: HoldAmanatInput): Promise<Amanat>;
    /** Gives it back today: marked returned, and the money leaves the account again. */
    markReturned(workspaceId: Id, amanatId: Id): Promise<Amanat>;
    /** Undoes "Given back" (today only): the withdrawal goes and the amanat is held again. */
    undoReturn(workspaceId: Id, amanatId: Id): Promise<Amanat>;
  };

  closings: {
    /** Close day for one day: expected, amanat held, and the counts if it's closed. */
    day(workspaceId: Id, date: BusinessDate): Promise<ClosingView>;
    /** Counts every account and closes the day: nothing on it can change after (but by an Owner, reopening). */
    close(workspaceId: Id, input: CloseDayInput): Promise<DailyClosing[]>;
    /** Owners: opens a closed day again, with a reason. */
    reopen(workspaceId: Id, input: ReopenDayInput): Promise<void>;
  };

  reports: {
    /** Every day from `from` to `to`, and the run added up. */
    range(workspaceId: Id, from: BusinessDate, to: BusinessDate): Promise<Report>;
  };

  activity: {
    /** Who did what on a day, newest first. Owners see everyone; Editors themselves; Viewers nothing. */
    list(workspaceId: Id, date: BusinessDate): Promise<ActivityRow[]>;
  };

  team: {
    /** Owners: everyone in the shop and the invitations still open. */
    list(workspaceId: Id): Promise<TeamView>;
    /** Owners: invites a phone number; they join when they sign in with it. */
    invite(workspaceId: Id, input: InviteInput): Promise<Invitation>;
    cancelInvite(workspaceId: Id, invitationId: Id): Promise<void>;
    /** Owners: changes what someone may do. The last Owner stays an Owner. */
    setRole(workspaceId: Id, memberId: Id, role: Role): Promise<Member>;
    /** Owners: takes someone out of the shop. The last Owner can't be removed. */
    remove(workspaceId: Id, memberId: Id): Promise<void>;
  };

  expenses: {
    /** One day's expenses (today by default), oldest first. Recording one is records.createExpense. */
    list(workspaceId: Id, date?: BusinessDate): Promise<ExpenseRow[]>;
  };

  deals: {
    /** One day's rows (today by default), oldest first, as the sheet reads. */
    list(workspaceId: Id, date?: BusinessDate): Promise<DealRow[]>;
    /** Records a deal today: what the customer gave, what you gave. */
    create(workspaceId: Id, input: CreateDealInput): Promise<Exchange>;
    /** Changes a deal of a day that's still open: both accounts and its profit are worked out again (logged before / after). */
    update(workspaceId: Id, dealId: Id, input: CreateDealInput): Promise<Exchange>;
    /** Colours rows in the sheet for everyone (null clears it). */
    highlight(workspaceId: Id, ids: Id[], colour: string | null): Promise<void>;
    /**
     * Deletes rows from a day that's still open (soft: the record and its
     * money movements are kept, marked deleted). `restore` undoes it.
     */
    remove(workspaceId: Id, ids: Id[]): Promise<void>;
    restore(workspaceId: Id, ids: Id[]): Promise<void>;
  };

  summary: {
    /** Everything Home shows for one day (defaults to today). */
    day(workspaceId: Id, date?: BusinessDate): Promise<DaySummary>;
  };

  notifications: {
    /**
     * The signed-in user's notifications from every shop they're in, newest
     * first: the last 90 days, cleared ones left out.
     */
    list(): Promise<Notification[]>;
    markRead(ids: Id[]): Promise<void>;
    /** Off the list. `restore` puts them back (the Undo after clearing). */
    clear(ids: Id[]): Promise<void>;
    restore(ids: Id[]): Promise<void>;
  };
}

/** The currencies a shop trades other than its base: the ones that need a rate. */
export function ratedCurrencies(workspace: Pick<Workspace, 'baseCurrency' | 'currencies'>): CurrencyCode[] {
  return workspace.currencies.filter((code) => code !== workspace.baseCurrency);
}
