import type { BookFilter, Id } from '@sarrif/core';

// Every cache key in one place. Everything about a shop starts with
// ['w', workspaceId], so recording anything there refreshes all of it with a
// single invalidate, and switching shops never shows another shop's data.
export const queryKeys = {
  session: ['session'] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: Id) => ['w', workspaceId] as const,
  accounts: (workspaceId: Id) => ['w', workspaceId, 'accounts'] as const,
  rates: (workspaceId: Id, date: string) => ['w', workspaceId, 'rates', date] as const,
  clients: (workspaceId: Id) => ['w', workspaceId, 'clients'] as const,
  book: (workspaceId: Id, filter: BookFilter) => ['w', workspaceId, 'book', filter] as const,
  summary: (workspaceId: Id, date: string | undefined) => ['w', workspaceId, 'summary', date ?? 'today'] as const,
};
