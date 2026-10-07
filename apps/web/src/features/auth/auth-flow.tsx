'use client';

import type { CurrencyCode, ProfileInput } from '@sarrif/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type AuthMode = 'signup' | 'login';

/** What the Sign up tab collected, held until the code is checked. */
export interface SignUpDraft {
  phone: string;
  profile: ProfileInput;
  /** In the order picked; the first suggests the base currency. */
  currencies: CurrencyCode[];
}

interface AuthFlow {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  draft: SignUpDraft | null;
  setDraft: (draft: SignUpDraft | null) => void;
}

const AuthFlowContext = createContext<AuthFlow | null>(null);

/**
 * State shared by the two auth steps. It lives in the auth layout, which stays
 * mounted from the phone step to the code step, so nothing goes in the URL.
 */
export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [draft, setDraft] = useState<SignUpDraft | null>(null);
  const value = useMemo(() => ({ mode, setMode, draft, setDraft }), [mode, draft]);
  return <AuthFlowContext value={value}>{children}</AuthFlowContext>;
}

export function useAuthFlow() {
  const flow = useContext(AuthFlowContext);
  if (!flow) throw new Error('useAuthFlow must be used inside the auth layout');
  return flow;
}
