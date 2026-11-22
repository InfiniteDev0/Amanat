import { closingLines, rateBoard, report, type SarrifApi } from '@sarrif/core';

import { formError } from './common';
import type { supabaseShops } from './shops';

// The money records (deals, expenses, amanat, closings, the team…) aren't in
// the database yet. A real shop must never show the demo data's, so until
// their tables exist: every list is empty (the screens show their empty
// states), figures come from the real accounts and rates with nothing moved,
// and anything that would record money says "not yet" instead of saving.

type Shops = ReturnType<typeof supabaseShops>;

const notYet = () => formError('unavailable', 'errors.notYet');

export function notYetAreas(
  shops: Shops,
): Pick<SarrifApi, 'clients' | 'records' | 'book' | 'amanat' | 'closings' | 'reports' | 'activity' | 'team' | 'expenses' | 'deals'> {
  const refuse = async (): Promise<never> => {
    throw notYet();
  };

  return {
    clients: { list: async () => [], create: refuse },
    records: {
      createExchange: refuse,
      createExpense: refuse,
      createAmanat: refuse,
      createDebt: refuse,
      createDebtPayment: refuse,
      createTransfer: refuse,
    },
    book: { list: async () => [] },
    amanat: { list: async () => [], hold: refuse, update: refuse, markReturned: refuse, undoReturn: refuse, trashed: async () => [], highlight: refuse, remove: refuse, restore: refuse, deleteForever: refuse },
    closings: {
      // What each account should hold is its opening amount: nothing has moved yet.
      async day(shopId, date) {
        const [accounts, board] = await Promise.all([shops.shopAccounts(shopId), shops.shopBoard(shopId, date)]);
        return { date, lines: closingLines(accounts, [], [], date), board: rateBoard(board.workspace, board.rates), closed: null };
      },
      close: refuse,
      reopen: refuse,
    },
    reports: {
      async range(shopId, from, to) {
        const [accounts, board] = await Promise.all([shops.shopAccounts(shopId), shops.shopBoard(shopId)]);
        const today = rateBoard(board.workspace, board.rates);
        return report({ from, to, exchanges: [], expenses: [], closings: [], accounts, boardFor: () => today });
      },
    },
    activity: { list: async () => [] },
    // One owner until 1e brings the team.
    team: { list: async () => ({ members: [], invitations: [] }), invite: refuse, cancelInvite: refuse, setRole: refuse, remove: refuse },
    expenses: { list: async () => [] },
    deals: { list: async () => [], create: refuse, update: refuse, highlight: refuse, remove: refuse, restore: refuse },
  };
}
