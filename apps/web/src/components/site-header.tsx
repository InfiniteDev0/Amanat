'use client';

import { useTranslations } from 'next-intl';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { pageFor } from '@/features/workspaces/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The page's header: where you are, the shop, then the page. Home has none
 * (the top bar already names the shop). The rest of the header comes later.
 */
export function SiteHeader({ workspaceId, shopName }: { workspaceId: string; shopName: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const page = pageFor(pathname, workspaceId);

  if (pathname === `/w/${workspaceId}`) return null;

  return (
    <header className="border-border bg-background/70 sticky top-0 z-30 flex h-13 shrink-0 items-center gap-3 rounded-t-[inherit] border-b px-4 py-2 backdrop-blur-xl lg:px-6">
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="text-base">
          {page ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={`/w/${workspaceId}`} />}>{shopName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="rtl:rotate-180" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate text-lg tracking-tight">{t(page.key)}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate text-lg tracking-tight">{shopName}</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
