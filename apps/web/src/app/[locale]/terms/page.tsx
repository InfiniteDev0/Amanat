import { TERMS_VERSION } from '@sarrif/core';
import { useLocale, useTranslations } from 'next-intl';

import { LegalDocument } from '@/features/legal/legal-document';
import { Link } from '@/i18n/navigation';

// The files in docs/legal, as they are in git: one copy of the text.
import riskStatement from '../../../../../../docs/legal/risk-statement.md';
import termsOfUse from '../../../../../../docs/legal/terms-of-use.md';

// Linked from "I have read and agree to the Terms and Risk statements". Still
// drafts: see docs/legal/README.md for what's left before launch.
export default function TermsPage() {
  const t = useTranslations();
  const english = useLocale() === 'en';
  return (
    <main className="mx-auto w-full max-w-2xl p-6 py-16">
      <h1 className="font-heading text-3xl font-bold">{t('terms.title')}</h1>
      <p className="text-muted-foreground mt-4 leading-relaxed">{t('terms.intro')}</p>
      <p className="bg-field mt-6 rounded-xl px-4 py-3 text-sm">
        {t('terms.draft')} {english ? null : t('terms.englishOnly')}
        <span className="text-muted-foreground block mt-1 text-xs tabular-nums">{t('terms.version', { version: TERMS_VERSION })}</span>
      </p>
      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href="#terms-of-use" className="bg-field hover:bg-field-focus rounded-xl px-4 py-2 font-medium transition-colors">
          {t('terms.termsOfUse')}
        </a>
        <a href="#risk-statement" className="bg-field hover:bg-field-focus rounded-xl px-4 py-2 font-medium transition-colors">
          {t('terms.risk')}
        </a>
      </nav>

      <div className="mt-12 flex flex-col gap-16">
        <LegalDocument id="terms-of-use" markdown={termsOfUse} />
        <LegalDocument id="risk-statement" markdown={riskStatement} />
      </div>

      <Link href="/" className="text-primary mt-12 inline-block underline underline-offset-4">
        {t('terms.back')}
      </Link>
    </main>
  );
}
