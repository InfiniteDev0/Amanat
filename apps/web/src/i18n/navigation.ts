import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// Locale-aware versions of Next's navigation: `<Link href="/w/123">` becomes
// /so/w/123 for a Somali user. Use these instead of next/link and next/navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
