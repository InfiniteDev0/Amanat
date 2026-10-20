import { emailSchema } from '@sarrif/core';
import { getLocale } from 'next-intl/server';

import { CheckEmail } from '@/features/auth/check-email';
import { redirect } from '@/i18n/navigation';

// After Sign up. Read on the server so the page gets the address without a
// Suspense boundary. No address, or a malformed one: back to the start.
export default async function CheckEmailPage({ searchParams }: PageProps<'/[locale]/check-email'>) {
  const { email, from } = await searchParams;
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return redirect({ href: '/', locale: await getLocale() });
  }
  // From Log in ("Confirm your email first"): no email was just sent, so they can ask for one right away.
  return <CheckEmail email={parsed.data} fromLogIn={from === 'login'} />;
}
