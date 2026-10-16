import type { MetadataRoute } from 'next';

// Makes the app installable on a phone (PWA). The browser-tab icons are files
// next to this one (favicon.ico, icon.png, apple-icon.png); these are the
// home-screen icons. The same images serve as "maskable" (Android crops them
// to its own shape).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Amanat',
    short_name: 'Amanat',
    description: 'Daily operations for currency exchange shops.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
