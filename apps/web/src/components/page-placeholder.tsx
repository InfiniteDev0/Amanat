import { useTranslations } from 'next-intl';

type Page = 'book' | 'clients' | 'accounts' | 'close' | 'reports' | 'team' | 'settings' | 'notifications' | 'allShops';

/** Stands in for a page until we design it. */
export function PagePlaceholder({ page }: { page: Page }) {
  const t = useTranslations();
  return (
    <section className="w-full p-4 lg:p-6">
      <h1 className="font-heading text-2xl font-semibold">{t('placeholder.title', { page: t(`nav.${page}`) })}</h1>
      <p className="text-muted-foreground mt-2">{t('placeholder.body')}</p>
    </section>
  );
}
