import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@sarrif/core'],
};

export default withNextIntl(nextConfig);
