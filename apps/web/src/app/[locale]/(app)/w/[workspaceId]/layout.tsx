import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { requireCompleteProfile, SERVER_AUTH } from '@/lib/auth/server';

// The shop comes from the URL, never from a global: /w/<id>/… is always that shop.
//
// A shop's pages need a phone and the terms, checked on the server so typing
// the URL can't skip it: missing → Complete your profile. (Someone with no
// shop gives both in the setup wizard, on All shops.) Whether they belong to
// this shop is checked in the browser (WorkspaceShell) until 1d moves shops
// to the database (lib/auth/server.ts, requireMember).
export default async function WorkspaceLayout({ children, params }: LayoutProps<'/[locale]/w/[workspaceId]'>) {
  const { locale, workspaceId } = await params;
  if (SERVER_AUTH) await requireCompleteProfile(locale);
  return <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>;
}
