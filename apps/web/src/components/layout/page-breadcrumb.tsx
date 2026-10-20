'use client';

import { useTranslations } from 'next-intl';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { pageKeyFor } from '@/features/workspaces/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Where you are, at the start of the page's top row: "Home" on Home; on any
 * other page, Home (a link back) then the page you're on.
 */
export function PageBreadcrumb({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations();
  const page = pageKeyFor(usePathname(), workspaceId);
  const pageLabel = page && t.has(`nav.${page}` as never) ? t(`nav.${page}` as never) : null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-[15px]">
        <BreadcrumbItem>
          {pageLabel ? (
            <BreadcrumbLink render={<Link href={`/w/${workspaceId}`} />}>{t('nav.home')}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="font-medium">{t('nav.home')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {pageLabel ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate font-medium">{pageLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
