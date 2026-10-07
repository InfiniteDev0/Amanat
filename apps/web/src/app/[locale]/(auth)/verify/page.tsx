import { phoneSchema } from '@sarrif/core';
import { getLocale } from 'next-intl/server';

import { CodeForm } from '@/features/auth/code-form';
import { redirect } from '@/i18n/navigation';

// Read on the server so the form gets the number without a Suspense boundary.
// No number, or a malformed one: back to step 1.
export default async function VerifyPage({ searchParams }: PageProps<'/[locale]/verify'>) {
  const { phone } = await searchParams;
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) {
    return redirect({ href: '/', locale: await getLocale() });
  }
  return <CodeForm phone={parsed.data} />;
}
