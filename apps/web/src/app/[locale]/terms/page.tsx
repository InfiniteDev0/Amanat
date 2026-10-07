import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

// PLACEHOLDER: linked from the Sign up tab. The real terms and risk statement
// must be written (and reviewed) before launch.
export default function TermsPage() {
  const t = useTranslations();
  return (
    <section className="mx-auto w-full max-w-2xl p-6 py-16">
      <h1 className="font-heading text-3xl font-bold">{t('terms.title')}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{t('terms.body')}</p>
      <Link href="/" className="text-primary mt-8 inline-block underline underline-offset-4">
        {t('terms.back')}
      </Link>
    </section>
  );
}
