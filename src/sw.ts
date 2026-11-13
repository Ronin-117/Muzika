/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

const MEDIA_CACHE_KEY = 'muzika-media-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Intercept audio stream playback requests for background and offline Range support,
  // but bypass SW for metadata lookups (?json=true) and explicit IndexedDB blob downloads (?download=1).
  if (
    url.pathname.startsWith('/api/stream') &&
    url.searchParams.get('json') !== 'true' &&
    url.searchParams.get('download') !== '1'
  ) {
    event.respondWith(handleAudioStreamFetch(event));
  }
});

async function handleAudioStreamFetch(event: FetchEvent): Promise<Response> {
  const request = event.request;
  const rangeHeader = request.headers.get('Range');

  // 1. Try Network First Strategy
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.status === 206) {
      // Cache full stream response when fetched from start
      if (!rangeHeader || rangeHeader === 'bytes=0-') {
        const cache = await caches.open(MEDIA_CACHE_KEY);
        cache.put(request.url, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    }
  } catch (err) {
    // Network offline or failed, proceed to cache fallback
  }

  // 2. Cache Fallback Strategy
  const cache = await caches.open(MEDIA_CACHE_KEY);
  const cachedResponse = await cache.match(request.url);

  if (!cachedResponse) {
    return new Response('Audio stream payload not available offline', { status: 404 });
  }

  const blob = await cachedResponse.blob();
  const totalByteLength = blob.size;

  // 3. Handle Standard Non-Ranged Request
  if (!rangeHeader) {
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mp4',
        'Content-Length': totalByteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  }

  // 4. Synthesize HTTP 206 Partial Content Response for Byte-Ranged Request
  const byteRangeParts = rangeHeader.replace(/bytes=/, '').split('-');
  const startByte = parseInt(byteRangeParts[0], 10) || 0;
  const endByte = byteRangeParts[1] ? parseInt(byteRangeParts[1], 10) : totalByteLength - 1;

  const validStart = Math.min(startByte, totalByteLength - 1);
  const validEnd = Math.min(endByte, totalByteLength - 1);
  const chunkLength = validEnd - validStart + 1;

  const slicedBlob = blob.slice(validStart, validEnd + 1);

  return new Response(slicedBlob, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${validStart}-${validEnd}/${totalByteLength}`,
      'Content-Length': chunkLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
