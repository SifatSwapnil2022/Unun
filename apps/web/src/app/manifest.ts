import type { MetadataRoute } from 'next';

/**
 * What a phone needs to keep Unun on its home screen and open it like an app: without
 * the browser's address bar, with its own icon and its own colour behind the status bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Unun: food delivery in Dhaka',
    short_name: 'Unun',
    description:
      'Order from Dhaka kitchens and see the full cost and an honest arrival time before you pay.',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#16120e',
    theme_color: '#16120e',
    lang: 'en',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Kitchens', url: '/en/kitchens' },
      { name: 'Your orders', url: '/en/account' },
    ],
  };
}
