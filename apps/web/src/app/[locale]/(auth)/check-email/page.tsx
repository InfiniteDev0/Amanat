import { emailSchema } from '@sarrif/core';
import { getLocale } from 'next-intl/server';

import { CheckEmail } from '@/features/auth/check-email';
import { redirect } from '@/i18n/navigation';

// After Sign up. Read on the server so the page gets the address without a
// Suspense boundary. No address, or a malformed one: back to the start.
export default async function CheckEmailPage({ searchParams }: PageProps<'/[locale]/check-email'>) {
  const { email } = await searchParams;
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return redirect({ href: '/', locale: await getLocale() });
  }
  return <CheckEmail email={parsed.data} />;
}
