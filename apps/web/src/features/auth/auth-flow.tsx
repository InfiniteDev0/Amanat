'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type AuthMode = 'signup' | 'login';

interface AuthFlow {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
}

const AuthFlowContext = createContext<AuthFlow | null>(null);

/**
 * Which tab the auth page shows. It lives in the auth layout, which stays
 * mounted across the auth pages, so coming back from "Forgot password?" keeps
 * Log in open.
 */
export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <AuthFlowContext value={value}>{children}</AuthFlowContext>;
}

export function useAuthFlow() {
  const flow = useContext(AuthFlowContext);
  if (!flow) throw new Error('useAuthFlow must be used inside the auth layout');
  return flow;
}
