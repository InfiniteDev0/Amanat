import { appReturnPath } from '@sarrif/core';

import { Entry, type EntryNotice } from '@/features/auth/entry';

// The auth page is the landing page: Sign up / Log in, email and password or
// Google. Coming back from Google (?auth_error=) or after a session ended
// (?next=), it opens on Log in with a calm line saying what happened.
export default async function AuthPage({ searchParams }: PageProps<'/[locale]'>) {
  const { auth_error: authError, next } = await searchParams;
  let notice: EntryNotice | null = null;
  if (authError === 'google_cancelled') notice = 'googleCancelled';
  else if (authError === 'google_failed') notice = 'googleFailed';
  else if (appReturnPath(next)) notice = 'sessionEnded';
  return <Entry notice={notice} />;
}
