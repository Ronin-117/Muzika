/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

const LEGACY_MEDIA_CACHE_KEY = 'muzika-media-v1';
const APP_SHELL_CACHE = 'muzika-app-shell-v1';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || [], {
  ignoreURLParametersMatching: [/.*/],
});

async function getOfflineAppShell(): Promise<Response | undefined> {
  const precached =
    (await matchPrecache('/index.html')) ||
    (await matchPrecache('index.html')) ||
    (await caches.match('/index.html', { ignoreSearch: true })) ||
    (await caches.match('/', { ignoreSearch: true }));
  if (precached) return precached;

  try {
    const shellCache = await caches.open(APP_SHELL_CACHE);
    const fallback = await shellCache.match('/index.html');
    return fallback || undefined;
  } catch {
    return undefined;
  }
}

const navigationHandler = async ({ request }: { request: Request }): Promise<Response> => {
  // Prefer precached app shell first so WebAPK / iOS standalone launches never fail offline or on flaky cellular.
  // App updates still roll out automatically via SW lifecycle + pwaUpdater.
  const cachedShell = await getOfflineAppShell();
  if (cachedShell) {
    return cachedShell;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && !networkResponse.redirected) {
      const shellCache = await caches.open(APP_SHELL_CACHE);
      shellCache.put('/index.html', networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    return new Response('Muzika is currently offline. Reconnect once to finish caching the app shell.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//, /^\/landing\.html/, /^\/landing-dist\//],
  })
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/index.html', { cache: 'reload' });
        if (res.ok && !res.redirected) {
          const shellCache = await caches.open(APP_SHELL_CACHE);
          await shellCache.put('/index.html', res);
        }
      } catch {
        // Ignore network errors during background install; precache handles shell caching
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove legacy unbounded media CacheStorage so audio streams are never double-cached
      // alongside IndexedDB (prevents quota bloat & OS/browser cache sweeps).
      await caches.delete(LEGACY_MEDIA_CACHE_KEY).catch(() => false);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
