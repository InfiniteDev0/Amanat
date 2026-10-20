'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

export type AuthMode = 'signup' | 'login';

interface AuthFlow {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  /** An email to put in the Log in form (from Check your email): only the password is left to type. */
  loginEmail: string;
  /** Opens Log in with this email filled in. */
  logInAs: (email: string) => void;
}

const AuthFlowContext = createContext<AuthFlow | null>(null);

/**
 * Which tab the auth page shows, and the email Log in starts with. It lives
 * in the auth layout, which stays mounted across the auth pages, so coming
 * back from "Forgot password?" or "Check your email" keeps both.
 */
export function AuthFlowProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [loginEmail, setLoginEmail] = useState('');
  const value = useMemo(
    () => ({
      mode,
      setMode,
      loginEmail,
      logInAs: (email: string) => {
        setLoginEmail(email);
        setMode('login');
      },
    }),
    [mode, loginEmail],
  );
  return <AuthFlowContext value={value}>{children}</AuthFlowContext>;
}

export function useAuthFlow() {
  const flow = useContext(AuthFlowContext);
  if (!flow) throw new Error('useAuthFlow must be used inside the auth layout');
  return flow;
}
