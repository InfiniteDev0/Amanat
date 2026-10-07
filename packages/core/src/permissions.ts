import type { Role } from './entities';

// Who may do what, per workspace. The UI calls `can` to hide what you can't
// do; the backend calls the same function to refuse it. One table, two uses,
// so they can never disagree. Mirrors "Roles and permissions" in the spec.

export const ACTIONS = [
  'view',
  'record',
  'set_rates',
  'close_day',
  'edit_entry_today',
  'edit_entry_closed_day',
  'reopen_day',
  'manage_accounts',
  'manage_team',
  'view_activity_all',
  'view_activity_own',
  'manage_shop',
  'export',
] as const;

export type Action = (typeof ACTIONS)[number];

const ALLOWED: Record<Action, readonly Role[]> = {
  view: ['owner', 'editor', 'viewer'],
  record: ['owner', 'editor'],
  set_rates: ['owner', 'editor'],
  close_day: ['owner', 'editor'],
  /** Editors only for their own entries: use `canEditEntry`. */
  edit_entry_today: ['owner', 'editor'],
  /** Logged, and needs a reason. */
  edit_entry_closed_day: ['owner'],
  reopen_day: ['owner'],
  manage_accounts: ['owner'],
  manage_team: ['owner'],
  view_activity_all: ['owner'],
  view_activity_own: ['owner', 'editor'],
  manage_shop: ['owner'],
  export: ['owner', 'editor', 'viewer'],
};

export function can(role: Role | null | undefined, action: Action): boolean {
  return role ? ALLOWED[action].includes(role) : false;
}

/** Edit or delete one entry: the role, whether it's theirs, and whether its day is closed. */
export function canEditEntry(
  role: Role | null | undefined,
  entry: { createdBy: string; dayClosed: boolean },
  userId: string,
): boolean {
  if (entry.dayClosed) {
    return can(role, 'edit_entry_closed_day');
  }
  if (role === 'editor') {
    return entry.createdBy === userId;
  }
  return can(role, 'edit_entry_today');
}
