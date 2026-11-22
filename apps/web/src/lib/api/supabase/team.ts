import { ApiError, type Invitation, inviteSchema, type MemberRow, type Role, type SarrifApi } from '@sarrif/core';

import { createClient } from '@/lib/supabase/client';

import { databaseError, formError, parse, withTimeout } from './common';

// The team in the database (migration 20261122150000_invitations): the owner,
// and the invitations still waiting. Inviting and cancelling go through
// invite_to_shop and cancel_invitation. Joining from an invitation, changing
// a right and removing someone come with the next step.

interface InvitationDbRow {
  id: string;
  shop_id: string;
  phone: string;
  role: Role;
  token: string;
  status: Invitation['status'];
  invited_by: string | null;
  created_at: string;
  expires_at: string;
}

const COLUMNS = 'id, shop_id, phone, role, token, status, invited_by, created_at, expires_at';

function toInvitation(row: InvitationDbRow): Invitation {
  return {
    id: row.id,
    workspaceId: row.shop_id,
    phone: row.phone,
    email: null,
    role: row.role,
    invitedBy: row.invited_by ?? '',
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function supabaseTeam(auth: SarrifApi['auth']): Pick<SarrifApi, 'team'> {
  const supabase = () => createClient();
  const later = async (): Promise<never> => {
    throw formError('unavailable', 'errors.notYet');
  };

  return {
    team: {
      async list(shopId) {
        const [user, result] = await Promise.all([
          auth.getSession(),
          withTimeout(
            supabase().from('invitations').select(COLUMNS).eq('shop_id', shopId).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).returns<InvitationDbRow[]>(),
          ),
        ]);
        if (result.error) throw databaseError(result.error, 'listInvitations');
        // The owner (you) until people can join.
        const members: MemberRow[] = user
          ? [{ member: { id: user.id, workspaceId: shopId, userId: user.id, role: 'owner', joinedAt: '' }, user: { id: user.id, name: user.name, phone: user.phone }, lastActive: null, invitedBy: null }]
          : [];
        return { members, invitations: result.data.map(toInvitation) };
      },

      async invite(shopId, input) {
        const { phone, role } = parse(inviteSchema, input);
        const { data, error } = await withTimeout(supabase().rpc('invite_to_shop', { shop: shopId, phone, role }));
        if (error) {
          if (error.code === '23505') throw new ApiError('conflict', 'team.alreadyInvited', { phone: 'team.alreadyInvited' });
          if (error.code === '22023') throw new ApiError('invalid', 'errors.invalid', { phone: 'validation.phone' });
          throw databaseError(error, 'invite');
        }
        const { data: row, error: readError } = await withTimeout(supabase().from('invitations').select(COLUMNS).eq('id', data as string).single<InvitationDbRow>());
        if (readError) throw databaseError(readError, 'invitation');
        return toInvitation(row);
      },

      async cancelInvite(_shopId, invitationId) {
        const { error } = await withTimeout(supabase().rpc('cancel_invitation', { invitation: invitationId }));
        if (error) throw databaseError(error, 'cancelInvitation');
      },

      setRole: later,
      remove: later,
    },
  };
}
