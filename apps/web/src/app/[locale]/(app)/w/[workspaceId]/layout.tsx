import { NoAccess } from '@/features/workspaces/no-access';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { ownsShop, SERVER_AUTH } from '@/lib/auth/server';

// The shop comes from the URL, never from a global: /w/<id>/… is always that shop.
//
// Checked on the server so typing a URL can't get round it: setup must be
// finished (else Home, where the setup wizard opens), and the shop must be
// theirs (else "No access", with nothing of the shop sent).
export default async function WorkspaceLayout({ children, params }: LayoutProps<'/[locale]/w/[workspaceId]'>) {
  const { locale, workspaceId } = await params;
  if (SERVER_AUTH && !(await ownsShop(locale, workspaceId))) return <NoAccess />;
  return <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>;
}
