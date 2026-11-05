import {
  type Account,
  ApiError,
  boardRatesFromUsd,
  businessDate,
  type BusinessDate,
  type CurrencyCode,
  type DailyRate,
  daySummary,
  midRate,
  type SarrifApi,
  setRatesSchema,
  updateAccountSchema,
  updateWorkspaceSchema,
  type User,
  usdQuotesFromBoard,
  type Workspace,
} from '@sarrif/core';

import { createClient } from '@/lib/supabase/client';

import { completeOnboardingAction, createShopAction } from './actions';
import { databaseError, formError, parse, withTimeout } from './common';

// The main shop for real (Phase 1d): onboarding, the shop list, accounts,
// rates and Home's figures from Supabase. One owner per business for now;
// row-level security shows each person only their own (owner_id = them).
//
// The app's "workspace" is a shop: its id is shops.id, and the business it
// belongs to (base currency, currencies, time zone) comes along with it.
// Rates are stored as the market says them, units per 1 USD
// (supabase/migrations/*_main_shop.sql); the board the app works with
// (units per 1 base unit) is worked out from them here (core quotes.ts).
//
// Money records (deals, expenses, amanat, closings…) aren't in the database
// yet: not-yet.ts answers for those.

interface BusinessRow {
  id: string;
  owner_id: string;
  base_currency: CurrencyCode;
  currencies: CurrencyCode[];
  time_zone: string;
}

interface ShopRow {
  id: string;
  name: string;
  location: string;
  is_main: boolean;
  closing_time: string;
  large_row_limit: number;
  created_at: string;
  workspace: BusinessRow;
}

interface AccountRow {
  id: string;
  name: string;
  type: Account['type'];
  currency: CurrencyCode;
  provider: string | null;
  opening_amount: number;
  minimum_balance: number | null;
  archived: boolean;
  created_at: string;
}

interface RateRow {
  id: string;
  date: BusinessDate;
  currency: CurrencyCode;
  units_per_usd: string;
  set_by: string | null;
  updated_at: string;
}

const SHOP_COLUMNS =
  'id, name, location, is_main, closing_time, large_row_limit, created_at, workspace:workspaces!inner(id, owner_id, base_currency, currencies, time_zone)';
const ACCOUNT_COLUMNS = 'id, name, type, currency, provider, opening_amount, minimum_balance, archived, created_at';
// As text: numeric(20,6) is more digits than a JS number keeps.
const RATE_COLUMNS = 'id, date, currency, units_per_usd::text, set_by, updated_at';

/** A shop with its business, as the app's Workspace. */
function toWorkspace(row: ShopRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    baseCurrency: row.workspace.base_currency,
    currencies: row.workspace.currencies,
    timeZone: row.workspace.time_zone,
    closingTime: row.closing_time.slice(0, 5),
    largeTransactionLimit: row.large_row_limit,
    ownerId: row.workspace.owner_id,
    status: 'active',
    createdAt: row.created_at,
    isMain: row.is_main,
  };
}

function toAccount(shopId: string, row: AccountRow): Account {
  return {
    id: row.id,
    workspaceId: shopId,
    name: row.name,
    type: row.type,
    currency: row.currency,
    provider: row.provider,
    openingBalance: row.opening_amount,
    minimumBalance: row.minimum_balance,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

/**
 * One day's dollar quotes as the board's rows (units per 1 base unit, buy =
 * sell: one rate per currency until the client says otherwise).
 */
function toDailyRates(shop: ShopRow, date: BusinessDate, rows: RateRow[]): DailyRate[] {
  const quotes = Object.fromEntries(rows.map((row) => [row.currency, row.units_per_usd]));
  const board = boardRatesFromUsd(shop.workspace.base_currency, shop.workspace.currencies, quotes);
  // Who set it and when: the currency's own quote, or the base's (what made the cross rate).
  const source = (code: CurrencyCode) => rows.find((row) => row.currency === code) ?? rows.find((row) => row.currency === shop.workspace.base_currency);
  return (Object.entries(board) as [CurrencyCode, string][]).map(([currency, rate]) => {
    const row = source(currency);
    return {
      id: `${shop.workspace.id}:${date}:${currency}`,
      workspaceId: shop.id,
      currency,
      date,
      buy: rate,
      sell: rate,
      setBy: row?.set_by ?? '',
      setAt: row?.updated_at ?? '',
    };
  });
}

const notYet = () => formError('unavailable', 'errors.notYet');

export function supabaseShops(auth: SarrifApi['auth']): Pick<SarrifApi, 'onboarding' | 'workspaces' | 'accounts' | 'rates' | 'summary'> & {
  /** For not-yet.ts: a shop's accounts, and its board for a day. */
  shopAccounts(shopId: string): Promise<Account[]>;
  shopBoard(shopId: string, date?: BusinessDate): Promise<{ workspace: Workspace; date: BusinessDate; rates: DailyRate[] }>;
} {
  const supabase = () => createClient();

  async function me(): Promise<string> {
    const { data } = await withTimeout(supabase().auth.getUser());
    if (!data.user) throw new ApiError('unauthenticated');
    return data.user.id;
  }

  async function shop(shopId: string): Promise<ShopRow> {
    const { data, error } = await withTimeout(supabase().from('shops').select(SHOP_COLUMNS).eq('id', shopId).single<ShopRow>());
    if (error) throw databaseError(error, 'shop');
    return data;
  }

  async function accountsOf(shopId: string): Promise<Account[]> {
    const { data, error } = await withTimeout(
      supabase().from('accounts').select(ACCOUNT_COLUMNS).eq('shop_id', shopId).order('created_at').returns<AccountRow[]>(),
    );
    if (error) throw databaseError(error, 'accounts');
    return data.map((row) => toAccount(shopId, row));
  }

  async function quotesOn(row: ShopRow, date: BusinessDate): Promise<RateRow[]> {
    const { data, error } = await withTimeout(
      supabase().from('rates').select(RATE_COLUMNS).eq('workspace_id', row.workspace.id).eq('date', date).returns<RateRow[]>(),
    );
    if (error) throw databaseError(error, 'rates');
    return data;
  }

  /** The quotes of the last day before `date` that had any (for Rate change). */
  async function quotesBefore(row: ShopRow, date: BusinessDate): Promise<RateRow[]> {
    const { data, error } = await withTimeout(
      supabase()
        .from('rates')
        .select('date')
        .eq('workspace_id', row.workspace.id)
        .lt('date', date)
        .order('date', { ascending: false })
        .limit(1)
        .returns<{ date: BusinessDate }[]>(),
    );
    if (error) throw databaseError(error, 'rates');
    return data[0] ? quotesOn(row, data[0].date) : [];
  }

  /** The business's latest quote for one currency, or null. */
  async function latestQuote(row: ShopRow, currency: CurrencyCode): Promise<string | null> {
    const { data, error } = await withTimeout(
      supabase()
        .from('rates')
        .select('units_per_usd::text')
        .eq('workspace_id', row.workspace.id)
        .eq('currency', currency)
        .order('date', { ascending: false })
        .limit(1)
        .returns<{ units_per_usd: string }[]>(),
    );
    if (error) throw databaseError(error, 'rates');
    return data[0]?.units_per_usd ?? null;
  }

  async function forDate(shopId: string, date: BusinessDate): Promise<DailyRate[]> {
    const row = await shop(shopId);
    return toDailyRates(row, date, await quotesOn(row, date));
  }

  return {
    onboarding: {
      async progress() {
        const id = await me();
        const { data, error } = await withTimeout(
          supabase()
            .from('profiles')
            .select('onboarding_step, onboarding_data, onboarding_completed_at')
            .eq('id', id)
            .single<{ onboarding_step: number; onboarding_data: Record<string, unknown> | null; onboarding_completed_at: string | null }>(),
        );
        if (error) throw databaseError(error, 'onboardingProgress');
        if (data.onboarding_completed_at || !data.onboarding_data) return null;
        return { step: data.onboarding_step, data: data.onboarding_data };
      },

      async saveProgress({ step, data }) {
        const id = await me();
        const { error } = await withTimeout(
          supabase().from('profiles').update({ onboarding_step: step, onboarding_data: data }).eq('id', id),
        );
        if (error) throw databaseError(error, 'saveOnboardingProgress');
      },

      async complete(input) {
        let result: Awaited<ReturnType<typeof completeOnboardingAction>>;
        try {
          result = await withTimeout(completeOnboardingAction(input));
        } catch (error) {
          if (error instanceof ApiError) throw error;
          // The request never got an answer (offline, or the server didn't respond).
          throw formError('unavailable', 'errors.offline');
        }
        if (!result.ok) throw new ApiError(result.code, result.messageKey, result.fields);
        const user: User | null = await auth.getSession();
        if (!user) throw new ApiError('unauthenticated');
        return { user, workspace: toWorkspace(await shop(result.data.shopId)) };
      },
    },

    workspaces: {
      async listMine() {
        const { data, error } = await withTimeout(
          supabase()
            .from('shops')
            .select(SHOP_COLUMNS)
            .order('is_main', { ascending: false })
            .order('created_at')
            .returns<ShopRow[]>(),
        );
        if (error) throw databaseError(error, 'listShops');
        // Row-level security shows only the shops they own.
        return data.map((row) => ({ workspace: toWorkspace(row), role: 'owner' as const }));
      },

      async update(shopId, input) {
        const { name, location, closingTime, largeTransactionLimit } = parse(updateWorkspaceSchema, input);
        const { data, error } = await withTimeout(
          supabase()
            .from('shops')
            .update({ name, location, closing_time: closingTime, large_row_limit: largeTransactionLimit })
            .eq('id', shopId)
            .select(SHOP_COLUMNS)
            .single<ShopRow>(),
        );
        if (error) throw databaseError(error, 'updateShop');
        return toWorkspace(data);
      },

      // The old way in (a whole new business) isn't used with the database: see createShop.
      async create() {
        throw notYet();
      },

      async createShop(input) {
        let result: Awaited<ReturnType<typeof createShopAction>>;
        try {
          result = await withTimeout(createShopAction(input));
        } catch (error) {
          if (error instanceof ApiError) throw error;
          throw formError('unavailable', 'errors.offline');
        }
        if (!result.ok) throw new ApiError(result.code, result.messageKey, result.fields);
        return toWorkspace(await shop(result.data.shopId));
      },

      async setMain(shopId) {
        const { error } = await withTimeout(supabase().rpc('set_main_shop', { shop: shopId }));
        if (error) throw databaseError(error, 'setMainShop');
      },

      async remove(shopId) {
        const { error } = await withTimeout(supabase().rpc('delete_shop', { shop: shopId }));
        if (error?.hint === 'main_shop') throw formError('invalid', 'errors.mainShopDelete');
        if (error) throw databaseError(error, 'deleteShop');
      },
    },

    accounts: {
      list: accountsOf,
      // New accounts come with the rest of managing accounts (2c).
      async create() {
        throw notYet();
      },
      /**
       * The opening amount, as a recorded adjustment (set_opening_amount:
       * who, when, from what to what, in the same transaction), never a
       * quiet edit.
       */
      async update(shopId, accountId, input) {
        const { openingBalance } = parse(updateAccountSchema, input);
        const { error } = await withTimeout(supabase().rpc('set_opening_amount', { account: accountId, amount: openingBalance }));
        if (error) throw databaseError(error, 'setOpeningAmount');
        const account = (await accountsOf(shopId)).find((a) => a.id === accountId);
        if (!account) throw new ApiError('not_found');
        return account;
      },
    },

    rates: {
      forDate,

      /** The rates dialog gives the board (per 1 base unit); they're saved as dollar quotes. */
      async set(shopId, input) {
        const { date, rates } = parse(setRatesSchema, input);
        const row = await shop(shopId);
        const base = row.workspace.base_currency;
        const board = Object.fromEntries(rates.map((pair) => [pair.currency, midRate(pair).toString()]));
        const quotes = usdQuotesFromBoard(base, board, base === 'USD' || board.USD ? null : await latestQuote(row, base));
        if (!quotes) throw new ApiError('invalid', 'errors.rateNeedsDollar', { form: 'errors.rateNeedsDollar' });
        const upserts = (Object.entries(quotes) as [CurrencyCode, string][])
          .filter(([code]) => row.workspace.currencies.includes(code))
          .map(([currency, perUsd]) => ({ workspace_id: row.workspace.id, date, currency, units_per_usd: perUsd }));
        const { error } = await withTimeout(
          supabase().from('rates').upsert(upserts, { onConflict: 'workspace_id,date,currency' }),
        );
        if (error) throw databaseError(error, 'setRates');
        return forDate(shopId, date);
      },
    },

    summary: {
      /** Home's figures from the real accounts and rates; no money records yet, so nothing has moved. */
      async day(shopId, date) {
        const row = await shop(shopId);
        const workspace = toWorkspace(row);
        const day = date ?? businessDate(workspace.timeZone);
        const [accounts, today, before] = await Promise.all([accountsOf(shopId), quotesOn(row, day), quotesBefore(row, day)]);
        const previousDate = before[0]?.date;
        return daySummary({
          workspace,
          date: day,
          accounts,
          entries: [],
          rates: toDailyRates(row, day, today),
          previousRates: previousDate ? toDailyRates(row, previousDate, before) : [],
          exchanges: [],
          expenses: [],
          amanats: [],
          debts: [],
          debtPayments: [],
        });
      },
    },

    shopAccounts: accountsOf,

    async shopBoard(shopId, date) {
      const row = await shop(shopId);
      const workspace = toWorkspace(row);
      const day = date ?? businessDate(workspace.timeZone);
      return { workspace, date: day, rates: toDailyRates(row, day, await quotesOn(row, day)) };
    },
  };
}
