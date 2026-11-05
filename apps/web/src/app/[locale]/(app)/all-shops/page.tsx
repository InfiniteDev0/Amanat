import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

// The old address of Home: links and bookmarks to it go to /home.
export default async function AllShopsPage({ params }: PageProps<'/[locale]/all-shops'>) {
  redirect({ href: '/home', locale: (await params).locale as Locale });
}
