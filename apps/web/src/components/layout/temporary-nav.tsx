'use client';

import type { WorkspaceMembership } from '@sarrif/core';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { useSignOut } from '@/features/auth/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// TEMPORARY. A plain strip of links so every page is reachable while the real
// layout (sidebar, top bar, + New, mobile bottom bar) is designed. Delete this
// file when components/layout/ gets Sidebar, TopBar and BottomBar.

const PAGES = [
  ['home', ''],
  ['book', '/book'],
  ['clients', '/clients'],
  ['accounts', '/accounts'],
  ['close', '/close'],
  ['reports', '/reports'],
  ['team', '/team'],
  ['settings', '/settings'],
  ['notifications', '/notifications'],
] as const;

export function TemporaryNav({ memberships }: { memberships: WorkspaceMembership[] }) {
  const t = useTranslations();
  const { workspace, role } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSignOut();
  const base = `/w/${workspace.id}`;

  return (
    <nav aria-label={t('placeholder.temporaryNav')} className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-sm">
      <select
        value={workspace.id}
        onChange={(event) => router.push(`/w/${event.target.value}`)}
        className="bg-muted rounded-md px-2 py-1 font-semibold"
      >
        {memberships.map(({ workspace: shop }) => (
          <option key={shop.id} value={shop.id}>
            {shop.name}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground text-xs">{t(`roles.${role}`)}</span>

      <div className="flex flex-wrap gap-3">
        {PAGES.map(([key, path]) => {
          const href = `${base}${path}`;
          return (
            <Link key={key} href={href} className={cn('hover:text-foreground', pathname === href ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </div>

      <div className="ms-auto flex items-center gap-3">
        <LocaleSwitcher />
        <button
          type="button"
          onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace('/') })}
          className="text-muted-foreground hover:text-foreground"
        >
          {t('common.signOut')}
        </button>
      </div>
    </nav>
  );
}
