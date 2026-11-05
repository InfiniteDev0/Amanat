'use client';

import { LANGUAGES } from '@sarrif/core';
import { GlobeIcon, LogOutIcon, MonitorSmartphoneIcon, MoonIcon, SunIcon, SunMoonIcon, UserRoundCogIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { LOCALE_FLAG, useSwitchLocale } from '@/components/locale-switcher';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useSignOutAndLeave } from '@/features/auth/use-sign-out-and-leave';
import { isTheme } from '@/features/theme/theme';
import { useTheme } from '@/features/theme/use-theme';

const SUB_MENU_CLASS = 'border-border bg-popover w-fit min-w-48 border shadow-none ring-0';

/**
 * Your own settings, at the bottom of the shop menu (there's no separate
 * account menu): account settings, language, theme, sign out, and sign out
 * of all devices. Their dialogs live outside the menu (onAccountSettings,
 * onSignOutEverywhere open them). Goes inside a DropdownMenuContent.
 */
export function AccountItems({
  onAccountSettings,
  onSignOutEverywhere,
}: {
  onAccountSettings: () => void;
  onSignOutEverywhere: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const { switchTo } = useSwitchLocale();
  const signOut = useSignOutAndLeave();

  return (
    <>
      <DropdownMenuItem className="h-9 gap-2.5" onClick={onAccountSettings}>
        <UserRoundCogIcon />
        {t('me.menu')}
      </DropdownMenuItem>
      <DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-9 gap-2.5">
            <GlobeIcon />
            {t('language.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SUB_MENU_CLASS}>
            <DropdownMenuRadioGroup value={locale} onValueChange={(value) => switchTo(String(value))}>
              {LANGUAGES.map((language) => (
                <DropdownMenuRadioItem key={language} value={language} lang={language}>
                  <Flag code={LOCALE_FLAG[language]} />
                  {t(`language.${language}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-9 gap-2.5">
            <SunMoonIcon />
            {t('theme.label')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SUB_MENU_CLASS}>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (isTheme(value)) setTheme(value);
              }}
            >
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                {t('theme.light')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                {t('theme.dark')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator className="my-1" />
      <DropdownMenuItem className="h-9 gap-2.5" onClick={() => signOut()}>
        <LogOutIcon />
        {t('common.signOut')}
      </DropdownMenuItem>
      <DropdownMenuItem className="text-destructive h-9 gap-2.5 [&_svg]:text-destructive" onClick={onSignOutEverywhere}>
        <MonitorSmartphoneIcon />
        {t('auth.everywhere.menu')}
      </DropdownMenuItem>
    </>
  );
}
