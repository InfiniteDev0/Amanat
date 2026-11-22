import { type Amanat, type AmanatRow, ApiError, holdAmanatSchema, type SarrifApi } from '@sarrif/core';

import { createClient } from '@/lib/supabase/client';

import { databaseError, formError, parse, withTimeout } from './common';

// Amanat in the database (migration 20261122100000_amanat): money a customer
// leaves with the shop, held, given back, the giving back undone the same
// day. Reads go through row-level security (the owner's shops only); writes
// only through hold_amanat, return_amanat and undo_return_amanat, so who did
// it and when come from the server.

interface AmanatDbRow {
  id: string;
  shop_id: string;
  account_id: string;
  client_name: string;
  amount: number;
  currency: string;
  note: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
  returned_at: string | null;
  highlighted: boolean;
  deleted_at: string | null;
  account: { name: string } | null;
}

const COLUMNS = 'id, shop_id, account_id, client_name, amount, currency, note, date, created_by, created_at, returned_at, highlighted, deleted_at, account:accounts(name)';

function toAmanat(row: AmanatDbRow): Amanat {
  return {
    id: row.id,
    workspaceId: row.shop_id,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    highlighted: row.highlighted,
    clientId: null,
    clientName: row.client_name,
    date: row.date,
    type: 'deposit',
    amount: Number(row.amount),
    currency: row.currency as Amanat['currency'],
    accountId: row.account_id,
    note: row.note,
    returnedAt: row.returned_at,
  };
}

/** The database said no to what was asked (nothing held, a name missing, given back twice…). */
function refused(error: { code?: string }, during: string): ApiError {
  if (error.code === '22023') return formError('invalid', 'errors.invalid');
  return databaseError(error as Parameters<typeof databaseError>[0], during);
}

export function supabaseAmanat(auth: SarrifApi['auth']): Pick<SarrifApi, 'amanat'> {
  const supabase = () => createClient();

  /** Who recorded it: you, by name (the owner is the only one until the team comes). */
  async function rowsOf(rows: AmanatDbRow[]): Promise<AmanatRow[]> {
    const user = await auth.getSession();
    return rows.map((row) => ({
      amanat: toAmanat(row),
      clientName: row.client_name,
      account: { id: row.account_id, name: row.account?.name ?? '—' },
      recordedBy: { id: row.created_by ?? '', name: row.created_by && row.created_by === user?.id ? user.name : '—' },
      returned: row.returned_at !== null,
    }));
  }

  async function one(id: string): Promise<Amanat> {
    const { data, error } = await withTimeout(supabase().from('amanat').select(COLUMNS).eq('id', id).single<AmanatDbRow>());
    if (error) throw databaseError(error, 'amanat');
    return toAmanat(data);
  }

  return {
    amanat: {
      async list(shopId) {
        const { data, error } = await withTimeout(
          supabase().from('amanat').select(COLUMNS).eq('shop_id', shopId).is('deleted_at', null).order('created_at', { ascending: false }).returns<AmanatDbRow[]>(),
        );
        if (error) throw databaseError(error, 'listAmanat');
        return rowsOf(data);
      },

      async trashed(shopId) {
        const { data, error } = await withTimeout(
          supabase().from('amanat').select(COLUMNS).eq('shop_id', shopId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).returns<AmanatDbRow[]>(),
        );
        if (error) throw databaseError(error, 'trashedAmanat');
        return rowsOf(data);
      },

      async highlight(_shopId, amanatId, on) {
        const { error } = await withTimeout(supabase().rpc('highlight_amanat', { amanat: amanatId, highlighted: on }));
        if (error) throw refused(error, 'highlightAmanat');
      },

      async remove(_shopId, amanatId) {
        const { error } = await withTimeout(supabase().rpc('trash_amanat', { amanat: amanatId }));
        if (error) throw refused(error, 'trashAmanat');
      },

      async restore(_shopId, amanatId) {
        const { error } = await withTimeout(supabase().rpc('restore_amanat', { amanat: amanatId }));
        if (error) throw refused(error, 'restoreAmanat');
      },

      async deleteForever(_shopId, amanatId) {
        const { error } = await withTimeout(supabase().rpc('delete_amanat', { amanat: amanatId }));
        if (error) throw refused(error, 'deleteAmanat');
      },

      async hold(_shopId, input) {
        const { clientName, accountId, amount, note } = parse(holdAmanatSchema, input);
        const { data, error } = await withTimeout(supabase().rpc('hold_amanat', { account: accountId, client_name: clientName, amount, note: note ?? null }));
        if (error) throw refused(error, 'holdAmanat');
        return one(data as string);
      },

      async update(_shopId, amanatId, input) {
        const { clientName, accountId, amount, note } = parse(holdAmanatSchema, input);
        const { error } = await withTimeout(supabase().rpc('update_amanat', { amanat: amanatId, account: accountId, client_name: clientName, amount, note: note ?? null }));
        if (error) throw refused(error, 'updateAmanat');
        return one(amanatId);
      },

      async markReturned(_shopId, amanatId) {
        const { error } = await withTimeout(supabase().rpc('return_amanat', { amanat: amanatId }));
        if (error) throw refused(error, 'returnAmanat');
        return one(amanatId);
      },

      async undoReturn(_shopId, amanatId) {
        const { error } = await withTimeout(supabase().rpc('undo_return_amanat', { amanat: amanatId }));
        if (error) throw refused(error, 'undoReturnAmanat');
        return one(amanatId);
      },
    },
  };
}
