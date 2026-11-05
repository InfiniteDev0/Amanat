import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { requireShop, SERVER_AUTH } from '@/lib/auth/server';

// The shop comes from the URL, never from a global: /w/<id>/… is always that shop.
//
// Checked on the server so typing a URL can't get round it: setup must be
// finished (main shop, phone and terms), and the shop must be theirs.
// Missing → All shops (the setup wizard, or their own shop).
export default async function WorkspaceLayout({ children, params }: LayoutProps<'/[locale]/w/[workspaceId]'>) {
  const { locale, workspaceId } = await params;
  if (SERVER_AUTH) await requireShop(locale, workspaceId);
  return <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>;
}
