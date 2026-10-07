'use client';

import { type Action, can, type Role, type Workspace } from '@sarrif/core';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

interface WorkspaceContextValue {
  workspace: Workspace;
  role: Role;
  /** `can(role, action)` for this shop: hide what the user isn't allowed to do. */
  can: (action: Action) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * The shop in the URL (/w/[workspaceId]) and the user's role there, for every
 * screen inside it. Set by the workspace layout once membership is confirmed.
 */
export function WorkspaceProvider({ workspace, role, children }: { workspace: Workspace; role: Role; children: ReactNode }) {
  const value = useMemo(() => ({ workspace, role, can: (action: Action) => can(role, action) }), [workspace, role]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside /w/[workspaceId]');
  return value;
}
