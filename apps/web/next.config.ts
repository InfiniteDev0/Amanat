import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// The demo sign-in (owner@amanat.demo, password in the README) is public, so
// it must never run in production. Without Supabase settings the app falls
// back to it (lib/supabase/env.ts), so a production build without them stops
// here instead of going live with the demo. Production = Vercel's production
// deployment, unless APP_ENV says otherwise, or APP_ENV=production anywhere.
const appEnv = process.env.APP_ENV ?? (process.env.VERCEL_ENV === 'production' ? 'production' : 'development');
const supabaseSet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (appEnv === 'production' && !supabaseSet) {
  throw new Error(
    'Refusing to build production with the demo sign-in: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ' +
      '(or APP_ENV=staging for a staging deployment). See README, "Environments".',
  );
}

/** Pages that show someone's own data: never kept by the browser or a cache, so Back after signing out can't show them. */
const PRIVATE_PAGES = ['/:locale/w/:path*', '/:locale/all-shops', '/:locale/complete-profile', '/:locale/reset-password'];

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@sarrif/core'],
  turbopack: {
    rules: {
      // Markdown imports as its text: the Terms page shows docs/legal/*.md as they are in git.
      '*.md': { loaders: ['raw-loader'], as: '*.js' },
    },
  },
  headers() {
    return PRIVATE_PAGES.map((source) => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
    }));
  },
};

export default withNextIntl(nextConfig);
