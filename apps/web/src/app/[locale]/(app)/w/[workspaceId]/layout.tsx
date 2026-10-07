import { WorkspaceShell } from '@/features/workspaces/workspace-shell';

// The shop comes from the URL, never from a global: /w/<id>/… is always that shop.
export default async function WorkspaceLayout({ children, params }: LayoutProps<'/[locale]/w/[workspaceId]'>) {
  const { workspaceId } = await params;
  return <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>;
}
