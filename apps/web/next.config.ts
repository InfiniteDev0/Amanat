import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@sarrif/core'],
  turbopack: {
    rules: {
      // Markdown imports as its text: the Terms page shows docs/legal/*.md as they are in git.
      '*.md': { loaders: ['raw-loader'], as: '*.js' },
    },
  },
};

export default withNextIntl(nextConfig);
