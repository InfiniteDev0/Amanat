import { LinkExpired } from '@/features/auth/link-expired';

// /api/auth/callback sends people here when an email link doesn't work.
export default function LinkExpiredPage() {
  return <LinkExpired />;
}
