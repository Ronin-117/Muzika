import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Innertube, ClientType, UniversalCache } from 'youtubei.js';
import { APP_VERSION, APP_BUILD, APP_RELEASE_NAME } from './src/version';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : (isProd ? 80 : 3000);

app.use(express.json());

// Request logger for container diagnostic transparency
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Don't flood healthchecks if healthy, but log all page views and API requests
    if (req.path !== '/api/health' || res.statusCode >= 400) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Silence verbose [YOUTUBEJS] internal parser warnings in production logs
const origWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('[YOUTUBEJS]')) return;
  origWarn(...args);
};

// In-memory cache for search queries and stream metadata
const searchCache = new Map<string, { data: any[]; timestamp: number }>();
const streamCache = new Map<string, { url: string; mimeType: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let innertubeInstance: Innertube | null = null;
let innertubePromise: Promise<Innertube> | null = null;

async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).then((yt) => {
      innertubeInstance = yt;
      return yt;
    });
  }
  return innertubePromise;
}

// 1. Healthcheck
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Muzika',
    version: APP_VERSION,
    build: APP_BUILD,
    release: APP_RELEASE_NAME,
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now(),
  });
});

// 2. YouTube Music / YouTube Search Endpoint (Returns full-length tracks with exact 11-char IDs)
app.get('/api/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));

  if (!query) {
    return res.json([]);
  }

  const cacheKey = `${query.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const yt = await getInnertube();
    const results: any[] = [];
    const seen = new Set<string>();

    // 1. Primary search: YouTube Music dedicated songs catalog
    try {
      const songRes = await yt.music.search(query, { type: 'song' });
      const songs = (songRes.songs as any)?.contents || [];
      for (const item of songs) {
        const vidId = String(item.id || '');
        if (!vidId || seen.has(vidId)) continue;
        seen.add(vidId);

        const artist = Array.isArray(item.artists)
          ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
          : (item.artist?.name || 'Unknown Artist');
        const durationSeconds = item.duration?.seconds || 210;
        const title = item.title || 'Untitled Song';
        const thumbnailUrl =
          item.thumbnails?.[item.thumbnails.length - 1]?.url ||
          `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

        results.push({
          id: `yt-${vidId}`,
          title,
          artist,
          album: item.album?.name || undefined,
          duration: durationSeconds,
          thumbnailUrl,
          source: 'youtube',
          youtubeId: vidId,
          playCount: 0,
        });

        if (results.length >= limit) break;
      }
    } catch (songErr: any) {
      console.warn('YouTube Music songs search notice:', songErr?.message || songErr);
    }

    // 2. Secondary search: YouTube Music official music videos if results < limit
    if (results.length < limit) {
      try {
        const vidRes = await yt.music.search(query, { type: 'video' });
        const videos = (vidRes.videos as any)?.contents || [];
        for (const item of videos) {
          const vidId = String(item.id || '');
          if (!vidId || seen.has(vidId)) continue;
          seen.add(vidId);

          const artist = Array.isArray(item.artists)
            ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
            : (item.author?.name || 'Unknown Artist');
          const durationSeconds = item.duration?.seconds || 210;
          const title = item.title || 'Untitled Song';
          const thumbnailUrl =
            item.thumbnails?.[item.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;

          results.push({
            id: `yt-${vidId}`,
            title,
            artist,
            duration: durationSeconds,
            thumbnailUrl,
            source: 'youtube',
            youtubeId: vidId,
            playCount: 0,
          });

          if (results.length >= limit) break;
        }
      } catch (vidErr: any) {
        console.warn('YouTube Music videos search notice:', vidErr?.message || vidErr);
      }
    }

    // 3. Last fallback: General YouTube search only if YouTube Music returned 0 tracks
    if (results.length === 0) {
      const searchRes = await yt.search(query);
      const items = (searchRes.videos || []).slice(0, limit);
      for (const item of items) {
        const v = item as any;
        const vidId = String(v.id || '');
        if (!vidId || seen.has(vidId)) continue;
        seen.add(vidId);

        results.push({
          id: `yt-${vidId}`,
          title: v.title?.text || v.title || 'Untitled Song',
          artist: v.author?.name || v.author || 'Unknown Artist',
          duration: v.duration?.seconds || 210,
          thumbnailUrl:
            v.thumbnails?.[v.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
          source: 'youtube',
          youtubeId: vidId,
          playCount: 0,
        });
      }
    }

    console.log(`[Search] Query: "${query}" -> ${results.length} pure music tracks found`);
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return res.json(results);
  } catch (err: any) {
    console.error('Error during /api/search:', err?.message || err);
    // Fallback: Return empty array so frontend can gracefully show empty state or fallback
    return res.json([]);
  }
});

// 3. Audio Stream Resolution & Proxying Endpoint (Supports HTTP Range Requests for Scrubbing & Background Play)
app.get('/api/stream', async (req: Request, res: Response) => {
  const rawId = String(req.query.id || '').trim();
  const vidId = rawId.replace(/^yt-/, '');

  if (!vidId) {
    return res.status(400).send('Missing video ID parameter');
  }

  // Set permissive CORS headers for media streaming
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  try {
    // Check stream URL cache
    let streamInfo = streamCache.get(vidId);

    if (!streamInfo || Date.now() - streamInfo.timestamp > CACHE_TTL) {
      // Resolve direct stream URL via fallback providers
      let resolvedUrl: string | null = null;
      let mimeType = 'audio/webm';

      // Provider A: Piped / Invidious fallback gateways
      const providers = [
        `https://pipedapi.adminforge.de/streams/${vidId}`,
        `https://api.piped.privacydev.net/streams/${vidId}`,
        `https://pipedapi.kavin.rocks/streams/${vidId}`,
      ];

      for (const endpoint of providers) {
        try {
          const resp = await fetch(endpoint, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const audioStream = (data.audioStreams || []).find((s: any) => s.url);
            if (audioStream && audioStream.url) {
              resolvedUrl = audioStream.url;
              mimeType = audioStream.mimeType || 'audio/webm';
              break;
            }
          }
        } catch {
          // continue to next provider
        }
      }

      if (resolvedUrl) {
        streamInfo = { url: resolvedUrl, mimeType, timestamp: Date.now() };
        streamCache.set(vidId, streamInfo);
      }
    }

    if (streamInfo && streamInfo.url) {
      // Forward HTTP Range headers to remote stream for responsive audio seeking
      const range = req.headers.range;
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };
      if (range) {
        fetchHeaders['Range'] = range;
      }

      const streamResp = await fetch(streamInfo.url, { headers: fetchHeaders });
      if (streamResp.ok || streamResp.status === 206) {
        res.status(streamResp.status);
        res.setHeader('Content-Type', streamInfo.mimeType);
        res.setHeader('Accept-Ranges', 'bytes');
        const contentRange = streamResp.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);
        const contentLength = streamResp.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        if (streamResp.body) {
          const reader = streamResp.body.getReader();
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (!res.writableEnded) {
                res.write(value);
              } else {
                break;
              }
            }
            res.end();
          };
          pump().catch(() => res.end());
          return;
        }
      }
    }

    // Return 404 so client cleanly uses the official YouTube engine instead of crashing on a redirected webpage
    return res.status(404).json({ error: 'Direct audio stream not available, use official player' });
  } catch (err: any) {
    console.error('Error in /api/stream:', err?.message || err);
    return res.status(500).json({ error: 'Stream resolution failed' });
  }
});

// 4. Synchronized LRC Lyrics Endpoint via LRCLIB (Free, Open, Millions of synced songs)
app.get('/api/lyrics', async (req: Request, res: Response) => {
  const title = String(req.query.title || '').trim();
  const artist = String(req.query.artist || '').trim();
  const duration = parseInt(String(req.query.duration || '0'), 10);

  if (!title) {
    return res.json({ syncedLyrics: null, plainLyrics: null });
  }

  try {
    const cleanTitle = title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
    let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}`;
    if (artist && artist !== 'Unknown Artist') {
      url += `&artist_name=${encodeURIComponent(artist)}`;
    }
    if (duration > 0) {
      url += `&duration=${duration}`;
    }

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MuzikaApp/2.5.0 (https://github.com)' },
      signal: AbortSignal.timeout(4000),
    });

    if (resp.ok) {
      const data: any = await resp.json();
      return res.json({
        syncedLyrics: data.syncedLyrics || null,
        plainLyrics: data.plainLyrics || null,
      });
    }
  } catch {
    // ignore
  }

  return res.json({ syncedLyrics: null, plainLyrics: null });
});

// Start Server: In development mode, mount Vite middleware; in production, serve built dist/
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in dev mode');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Server] Serving static production bundle from ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Muzika Server v${APP_VERSION} (${APP_BUILD})] Running on http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Failed to start:', err);
  process.exit(1);
});
