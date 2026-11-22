import { ApiError, type BusinessDate, businessDate, createDealSchema, dealProfit, type DealRow, type Exchange, rateBoard, report, type SarrifApi } from '@sarrif/core';

import { createClient } from '@/lib/supabase/client';

import { databaseError, formError, parse, withTimeout } from './common';
import type { supabaseShops } from './shops';

// Exchanges in the database (migration 20261122130000_exchanges): dollars for
// shillings and back, at our rate, against today's. Read through row-level
// security; written only by record_exchange. Sallam comes later.

type Shops = ReturnType<typeof supabaseShops>;

interface ExchangeDbRow {
  id: string;
  shop_id: string;
  date: string;
  currency_in: string;
  amount_in: number;
  account_in: string;
  currency_out: string;
  amount_out: number;
  account_out: string;
  rate: string;
  customer_rate: string;
  today_rate: string;
  customer: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

const COLUMNS =
  'id, shop_id, date, currency_in, amount_in, account_in, currency_out, amount_out, account_out, rate, customer_rate::text, today_rate::text, customer, note, created_by, created_at, deleted_at';

function toExchange(row: ExchangeDbRow): Exchange {
  return {
    id: row.id,
    workspaceId: row.shop_id,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    date: row.date,
    currencyIn: row.currency_in as Exchange['currencyIn'],
    amountIn: Number(row.amount_in),
    accountIn: row.account_in,
    currencyOut: row.currency_out as Exchange['currencyOut'],
    amountOut: Number(row.amount_out),
    accountOut: row.account_out,
    rate: row.rate,
    clientId: null,
    note: row.note,
    kind: row.currency_in === 'USD' ? 'bought_usd' : 'sold_usd',
    todayRate: Number(row.today_rate).toString(),
    customerRate: Number(row.customer_rate).toString(),
    percent: null,
    customer: row.customer,
    highlight: null,
  };
}

export function supabaseDeals(auth: SarrifApi['auth'], shops: Shops): Pick<SarrifApi, 'deals' | 'reports'> {
  const supabase = () => createClient();
  const notYet = async (): Promise<never> => {
    throw formError('unavailable', 'errors.notYet');
  };

  async function one(id: string): Promise<Exchange> {
    const { data, error } = await withTimeout(supabase().from('exchanges').select(COLUMNS).eq('id', id).single<ExchangeDbRow>());
    if (error) throw databaseError(error, 'exchange');
    return toExchange(data);
  }

  return {
    // A run of days: profit from the exchanges kept in the database (each with its own today's rate).
    reports: {
      async range(shopId, from, to) {
        const [accounts, board] = await Promise.all([shops.shopAccounts(shopId), shops.shopBoard(shopId)]);
        const { data, error } = await withTimeout(
          supabase().from('exchanges').select(COLUMNS).eq('shop_id', shopId).gte('date', from).lte('date', to).is('deleted_at', null).returns<ExchangeDbRow[]>(),
        );
        if (error) throw databaseError(error, 'reportExchanges');
        const today = rateBoard(board.workspace, board.rates);
        return report({ from, to, exchanges: data.map(toExchange), expenses: [], closings: [], accounts, boardFor: () => today });
      },
    },
    deals: {
      /** A day's exchanges (today's without a date), newest first, each with what it made. */
      async list(shopId, date?: BusinessDate) {
        const [accounts, board, user] = await Promise.all([shops.shopAccounts(shopId), shops.shopBoard(shopId, date), auth.getSession()]);
        const day = date ?? businessDate(board.workspace.timeZone);
        const { data, error } = await withTimeout(
          supabase().from('exchanges').select(COLUMNS).eq('shop_id', shopId).eq('date', day).is('deleted_at', null).order('created_at', { ascending: false }).returns<ExchangeDbRow[]>(),
        );
        if (error) throw databaseError(error, 'listExchanges');
        const boardOfDay = rateBoard(board.workspace, board.rates);
        const ref = (id: string) => ({ id, name: accounts.find((a) => a.id === id)?.name ?? '—' });
        return data.map((row): DealRow => {
          const deal = toExchange(row);
          return {
            deal,
            profit: dealProfit(deal, boardOfDay),
            from: ref(deal.accountOut),
            to: ref(deal.accountIn),
            recordedBy: { id: deal.createdBy, name: deal.createdBy === user?.id ? user.name : '—' },
            locked: false,
          };
        });
      },

      async create(_shopId, input) {
        const data = parse(createDealSchema, input);
        if (data.type !== 'exchange') throw formError('unavailable', 'errors.notYet');
        const { data: id, error } = await withTimeout(
          supabase().rpc('record_exchange', {
            side: data.side,
            amount: data.amount,
            rate: data.rate,
            usd_account: data.usdAccountId,
            kes_account: data.kesAccountId,
            customer: data.customer ?? null,
            note: data.note ?? null,
          }),
        );
        if (error) {
          if (error.code === '22023') throw new ApiError('invalid', 'errors.invalid', { form: error.message === 'no rate set for today' ? 'profit.problem.noRate' : 'errors.invalid' });
          throw databaseError(error, 'recordExchange');
        }
        return one(id as string);
      },

      update: notYet,
      highlight: notYet,
      remove: notYet,
      restore: notYet,
    },
  };
}
