'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

import { Flag } from '@/components/flag';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { usePathname, useRouter } from '@/i18n/navigation';
import { type Locale, routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** The flag shown for each language. Arabic has no single country; Saudi Arabia is the usual pick. */
export const LOCALE_FLAG: Record<Locale, string> = { en: 'GB', so: 'SO', ar: 'SA' };

/** Switches the language in the URL, staying on the same page. */
export function useSwitchLocale() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: string) => {
    if (next === locale) return;
    startTransition(() => {
      // @ts-expect-error -- `params` always matches `pathname`, which next-intl can't prove.
      router.replace({ pathname, params }, { locale: next as Locale });
    });
  };
  return { switchTo, isPending };
}

/** Flag + EN / SO / AR. Swaps the language in the URL and keeps you on the same page. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('language');
  const locale = useLocale() as Locale;
  const { switchTo, isPending } = useSwitchLocale();

  return (
    <Select value={locale} onValueChange={switchTo} disabled={isPending} className={cn('w-[88px] shrink-0', className)}>
      <SelectTrigger className="h-9 gap-1.5 rounded-lg px-2.5 text-xs font-semibold">
        <span className="sr-only">{t('label')}: </span>
        <span className="flex items-center gap-2" lang={locale}>
          <Flag code={LOCALE_FLAG[locale]} />
          <span className="uppercase">{locale}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((code) => (
          <SelectItem key={code} value={code} className="px-2 text-xs font-semibold">
            <span className="flex items-center gap-2" lang={code} title={t(code)}>
              <Flag code={LOCALE_FLAG[code]} />
              <span className="uppercase">{code}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
