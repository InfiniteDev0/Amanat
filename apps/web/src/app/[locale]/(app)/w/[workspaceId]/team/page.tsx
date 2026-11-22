import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

// People is a dialog now (the People tile in Quick actions), not a page: an
// old link to it goes to the shop.
export default async function TeamPage({ params }: PageProps<'/[locale]/w/[workspaceId]/team'>) {
  const { locale, workspaceId } = await params;
  redirect({ href: `/w/${workspaceId}`, locale: locale as Locale });
}
