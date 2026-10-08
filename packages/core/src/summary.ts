import type { CurrencyCode } from './currencies';
import type { Account, Amanat, DailyRate, Debt, DebtPayment, Entry, Exchange, Expense, Workspace } from './entities';
import { accountBalances, accountMovements, amanatHeld, debtState } from './ledger';
import { addTo, type Money, totalsToList } from './money';
import { type RateBoard, valueInBase } from './rates';

// The figures Home shows. None of these are stored: they are worked out from
// entries and records every time, so they can never drift from the ledger.

/** The board for one day from that day's rate rows. */
export function rateBoard(workspace: Pick<Workspace, 'baseCurrency'>, rates: readonly DailyRate[]): RateBoard {
  const board: RateBoard = { base: workspace.baseCurrency, rates: {} };
  for (const rate of rates) {
    board.rates[rate.currency] = { buy: rate.buy, sell: rate.sell };
  }
  return board;
}

/** Traded currencies with no rate on the board. Empty means rates are set. */
export function missingRates(workspace: Pick<Workspace, 'baseCurrency' | 'currencies'>, board: RateBoard): CurrencyCode[] {
  return workspace.currencies.filter((code) => code !== workspace.baseCurrency && !board.rates[code]);
}

/**
 * Profit on one exchange, in base minor units: what came in minus what went
 * out, both valued at the day's mid rate. Null when a rate is missing.
 *
 * PROVISIONAL: the spec's open question "Profit method" (day's rates vs.
 * average cost of the currency held) is not settled. Everything that shows
 * profit goes through this function, so changing the method is one edit.
 */
export function exchangeProfit(board: RateBoard, exchange: Exchange): number | null {
  const valueIn = valueInBase(board, { amount: exchange.amountIn, currency: exchange.currencyIn });
  const valueOut = valueInBase(board, { amount: exchange.amountOut, currency: exchange.currencyOut });
  return valueIn === null || valueOut === null ? null : valueIn - valueOut;
}

export interface AccountPosition {
  account: Account;
  balance: number;
  todayIn: number;
  todayOut: number;
  /** Balance in the base currency at today's mid rate; null without a rate. */
  balanceInBase: number | null;
}

export interface DaySummary {
  date: string;
  baseCurrency: CurrencyCode;
  /** The day's rates, for showing figures in another currency (valueFromBase). */
  board: RateBoard;
  /** Traded currencies with no rate today. */
  missingRates: CurrencyCode[];
  exchangeCount: number;
  exchangedIn: Money[];
  exchangedOut: Money[];
  expenses: Money[];
  /** Base minor units. Null when a missing rate makes it unknowable. */
  profit: number | null;
  accounts: AccountPosition[];
  /** All live accounts in the base currency; null when a rate is missing. */
  totalInBase: number | null;
  amanatHeld: Money[];
  owedToUs: Money[];
  weOwe: Money[];
}

export interface DaySummaryInput {
  workspace: Workspace;
  date: string;
  accounts: readonly Account[];
  entries: readonly Entry[];
  rates: readonly DailyRate[];
  exchanges: readonly Exchange[];
  expenses: readonly Expense[];
  amanats: readonly Amanat[];
  debts: readonly Debt[];
  debtPayments: readonly DebtPayment[];
}

export function daySummary(input: DaySummaryInput): DaySummary {
  const { workspace, date } = input;
  const board = rateBoard(workspace, input.rates);
  const live = <T extends { deletedAt: string | null }>(rows: readonly T[]) => rows.filter((row) => row.deletedAt === null);

  const todaysExchanges = live(input.exchanges).filter((exchange) => exchange.date === date);
  const todaysExpenses = live(input.expenses).filter((expense) => expense.date === date);

  const exchangedIn = new Map<CurrencyCode, number>();
  const exchangedOut = new Map<CurrencyCode, number>();
  let profit: number | null = 0;
  for (const exchange of todaysExchanges) {
    addTo(exchangedIn, { amount: exchange.amountIn, currency: exchange.currencyIn });
    addTo(exchangedOut, { amount: exchange.amountOut, currency: exchange.currencyOut });
    const earned = exchangeProfit(board, exchange);
    profit = profit === null || earned === null ? null : profit + earned;
  }

  const expenses = new Map<CurrencyCode, number>();
  for (const expense of todaysExpenses) {
    const money = { amount: expense.amount, currency: expense.currency };
    addTo(expenses, money);
    const cost = valueInBase(board, money);
    profit = profit === null || cost === null ? null : profit - cost;
  }

  const activeAccounts = input.accounts.filter((account) => !account.archived);
  const balances = accountBalances(activeAccounts, input.entries);
  const movements = accountMovements(input.entries, date);
  let totalInBase: number | null = 0;
  const accounts = activeAccounts.map((account): AccountPosition => {
    const balance = balances.get(account.id) ?? account.openingBalance;
    const movement = movements.get(account.id);
    const balanceInBase = valueInBase(board, { amount: balance, currency: account.currency });
    totalInBase = totalInBase === null || balanceInBase === null ? null : totalInBase + balanceInBase;
    return { account, balance, todayIn: movement?.in ?? 0, todayOut: movement?.out ?? 0, balanceInBase };
  });

  const amanatTotals = new Map<CurrencyCode, number>();
  for (const perCurrency of amanatHeld(input.amanats).values()) {
    for (const [currency, amount] of perCurrency) addTo(amanatTotals, { amount, currency });
  }

  const owedToUs = new Map<CurrencyCode, number>();
  const weOwe = new Map<CurrencyCode, number>();
  for (const debt of live(input.debts)) {
    const { remaining } = debtState(debt, input.debtPayments);
    if (remaining === 0) continue;
    addTo(debt.direction === 'they_owe_us' ? owedToUs : weOwe, { amount: remaining, currency: debt.currency });
  }

  return {
    date,
    baseCurrency: workspace.baseCurrency,
    board,
    missingRates: missingRates(workspace, board),
    exchangeCount: todaysExchanges.length,
    exchangedIn: totalsToList(exchangedIn),
    exchangedOut: totalsToList(exchangedOut),
    expenses: totalsToList(expenses),
    profit,
    accounts,
    totalInBase,
    amanatHeld: totalsToList(amanatTotals),
    owedToUs: totalsToList(owedToUs),
    weOwe: totalsToList(weOwe),
  };
}
