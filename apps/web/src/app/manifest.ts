import type { MetadataRoute } from 'next';

// Makes the app installable on a phone (PWA). Proper 192/512px icons and
// splash screens go in public/ once the brand mark is final.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Amanat',
    short_name: 'Amanat',
    description: 'Daily operations for currency exchange shops.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
