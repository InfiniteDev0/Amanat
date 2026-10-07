import 'goey-toast/styles.css';
import '../globals.css';

import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Luxurious_Roman, Manrope, Outfit } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Providers } from '@/components/providers';
import { getTheme } from '@/features/theme/get-theme';
import { directionOf, routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] });
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] });
const roman = Luxurious_Roman({ variable: '--font-roman', subsets: ['latin'], weight: '400' });
const arabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'brand' });
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('description'),
    appleWebApp: { capable: true, title: t('name') },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const theme = await getTheme();
  const dir = directionOf(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(manrope.variable, outfit.variable, roman.variable, arabic.variable, 'h-full antialiased', theme === 'dark' && 'dark')}
      style={{ colorScheme: theme }}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir} theme={theme}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
