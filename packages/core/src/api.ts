import type { CurrencyCode } from './currencies';
import type { BusinessDate } from './dates';
import type {
  Account,
  Amanat,
  Client,
  DailyRate,
  Debt,
  DebtPayment,
  Exchange,
  Expense,
  Id,
  Notification,
  Role,
  Transfer,
  User,
  Workspace,
} from './entities';
import type { Money } from './money';
import type {
  CreateAccountInput,
  CreateAmanatInput,
  CreateClientInput,
  CreateDebtInput,
  CreateDebtPaymentInput,
  CreateExchangeInput,
  CreateExpenseInput,
  CreateTransferInput,
  CreateWorkspaceInput,
  OnboardingInput,
  ProfileInput,
  SendCodeInput,
  SetRatesInput,
  UpdateAccountInput,
  VerifyCodeInput,
} from './schemas';
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

export interface VerifyCodeResult {
  user: User;
  /** True when this phone had no account (or no name) before this sign-in. */
  isNewUser: boolean;
}

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
  auth: {
    /** Texts a 6-digit code. Signs up and signs in alike. */
    sendCode(input: SendCodeInput): Promise<{ phone: string }>;
    verifyCode(input: VerifyCodeInput): Promise<VerifyCodeResult>;
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
