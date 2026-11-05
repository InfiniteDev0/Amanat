'use client';

import { useTranslations } from 'next-intl';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { pageKeyFor } from '@/features/workspaces/navigation';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Where you are, beside your account menu: "Home" on Home; in a shop, Home (a
 * link back), the shop, and the shop's page if you're on one.
 */
export function PageBreadcrumb({ shop }: { shop?: { id: string; name: string } }) {
  const t = useTranslations();
  const pathname = usePathname();
  const page = shop ? pageKeyFor(pathname, shop.id) : null;
  const pageLabel = page && t.has(`nav.${page}` as never) ? t(`nav.${page}` as never) : null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-sm">
        <BreadcrumbItem>
          {shop ? (
            <BreadcrumbLink render={<Link href="/home" />}>{t('nav.home')}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="font-medium">{t('nav.home')}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {shop ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              {pageLabel ? (
                <BreadcrumbLink render={<Link href={`/w/${shop.id}`} />} className="truncate">
                  {shop.name}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate font-medium">{shop.name}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        ) : null}
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
