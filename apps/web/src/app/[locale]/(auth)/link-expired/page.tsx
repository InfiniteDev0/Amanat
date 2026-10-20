import { LinkExpired } from '@/features/auth/link-expired';

// /api/auth/confirm sends people here when an email link doesn't work, with
// ?type= the kind of link it was (signup or recovery), so a new one can be sent.
export default async function LinkExpiredPage({ searchParams }: PageProps<'/[locale]/link-expired'>) {
  const { type } = await searchParams;
  return <LinkExpired kind={type === 'recovery' ? 'recovery' : 'signup'} />;
}
