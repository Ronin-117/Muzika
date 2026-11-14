import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Innertube, ClientType, UniversalCache } from 'youtubei.js';
import { Ytdl, chooseFormat } from '@distube/ytdl-core';
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

// 2. YouTube Music Search Endpoint (Supports songs, verified artists, and official albums)
app.get('/api/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim();
  const searchType = String(req.query.type || 'song').toLowerCase().trim();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));

  if (!query) {
    return res.json([]);
  }

  const cacheKey = `${searchType}_${query.toLowerCase()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    const yt = await getInnertube();
    const results: any[] = [];
    const seen = new Set<string>();

    // A. Artists Search
    if (searchType === 'artist') {
      try {
        const artistRes = await yt.music.search(query, { type: 'artist' });
        const artists = (artistRes.artists as any)?.contents || [];
        for (const item of artists) {
          const aId = String(item.id || '');
          if (!aId || seen.has(aId)) continue;
          seen.add(aId);

          const name = String(item.name || item.title || 'Unknown Artist');
          const thumbs = item.thumbnails || [];
          const thumbnailUrl =
            thumbs[thumbs.length - 1]?.url ||
            thumbs[0]?.url ||
            `https://i.ytimg.com/i/${aId}/1.jpg`;

          const rawSub = item.subscribers || item.subtitle;
          let subscribers = 'Verified Artist';
          if (typeof rawSub === 'string') {
            subscribers = rawSub;
          } else if (rawSub && typeof rawSub === 'object') {
            if (typeof rawSub.text === 'string') {
              subscribers = rawSub.text;
            } else if (Array.isArray(rawSub.runs)) {
              subscribers = rawSub.runs.map((r: any) => r.text || '').join('');
            }
          }

          results.push({
            id: aId,
            name,
            thumbnailUrl,
            subscribers,
            topSongs: [],
          });

          if (results.length >= limit) break;
        }
      } catch (aErr: any) {
        console.warn('YouTube Music artist search error:', aErr?.message || aErr);
      }

      searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
      return res.json(results);
    }

    // B. Albums Search
    if (searchType === 'album') {
      try {
        const albumRes = await yt.music.search(query, { type: 'album' });
        const albums = (albumRes.albums as any)?.contents || [];
        for (const item of albums) {
          const albId = String(item.id || '');
          if (!albId || seen.has(albId)) continue;
          seen.add(albId);

          const title = String(item.title || 'Untitled Album');
          const artist = String(item.author?.name || item.artists?.[0]?.name || 'Unknown Artist');
          const year = item.year ? String(item.year) : undefined;
          const thumbs = item.thumbnails || [];
          const coverUrl =
            thumbs[thumbs.length - 1]?.url ||
            thumbs[0]?.url ||
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80';

          results.push({
            id: albId,
            title,
            artist,
            year,
            coverUrl,
            songs: [],
          });

          if (results.length >= limit) break;
        }
      } catch (albErr: any) {
        console.warn('YouTube Music album search error:', albErr?.message || albErr);
      }

      searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
      return res.json(results);
    }

    // C. Songs Search
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

    // 3. Fallback: General YouTube search only if YouTube Music returned 0 tracks
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

    console.log(`[Search] Query: "${query}" (${searchType}) -> ${results.length} items found`);
    searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return res.json(results);
  } catch (err: any) {
    console.error('Error during /api/search:', err?.message || err);
    return res.json([]);
  }
});

// 2b. YouTube Music Album Tracks Endpoint
app.get('/api/album', async (req: Request, res: Response) => {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Album ID required' });

  try {
    const yt = await getInnertube();
    const alb = await yt.music.getAlbum(id);
    const header = alb.header as any;
    const title = header?.title?.text || header?.title || 'Album';
    const artist =
      header?.strapline_text_one?.text ||
      header?.author?.name ||
      header?.artists?.[0]?.name ||
      'Artist';
    const coverUrl =
      header?.thumbnail?.contents?.[0]?.url ||
      (alb as any).thumbnails?.[0]?.url ||
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80';
    const year = header?.subtitle?.text ? header.subtitle.text.replace(/[^0-9]/g, '') : undefined;

    const songs: any[] = [];
    for (const item of (alb.contents || [])) {
      const track = item as any;
      const vidId = track.id;
      if (!vidId) continue;

      songs.push({
        id: `yt-${vidId}`,
        title: track.title || 'Untitled Track',
        artist: track.author?.name || track.artists?.[0]?.name || artist,
        album: title,
        duration: track.duration?.seconds || 210,
        thumbnailUrl: coverUrl,
        source: 'youtube',
        youtubeId: vidId,
        playCount: 0,
      });
    }

    return res.json({
      id,
      title,
      artist,
      coverUrl,
      year,
      songs,
    });
  } catch (err: any) {
    console.error('Error in /api/album:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch album tracks' });
  }
});

// 2c. YouTube Music Artist Top Songs & Info Endpoint
app.get('/api/artist', async (req: Request, res: Response) => {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Artist ID required' });

  try {
    const yt = await getInnertube();
    const art = await yt.music.getArtist(id);
    const header = art.header as any;
    const name = header?.title?.text || header?.title || 'Artist';
    const subscribers = header?.subscribers?.text || header?.subscribers || 'Verified Artist';
    const bannerUrl = header?.thumbnails?.[header.thumbnails.length - 1]?.url;

    const topSongsSection = art.sections.find(
      (s: any) =>
        (s.title?.text || '').toLowerCase().includes('top') ||
        (s.title?.text || '').toLowerCase().includes('song')
    );

    const topSongs: any[] = [];
    if (topSongsSection && topSongsSection.contents) {
      for (const item of (topSongsSection.contents as any[])) {
        const vidId = item.id;
        if (!vidId) continue;

        topSongs.push({
          id: `yt-${vidId}`,
          title: item.title || 'Untitled Song',
          artist: item.artists?.[0]?.name || name,
          album: item.album?.name || undefined,
          duration: item.duration?.seconds || 210,
          thumbnailUrl:
            item.thumbnails?.[item.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
          source: 'youtube',
          youtubeId: vidId,
          playCount: 0,
        });
      }
    }

    return res.json({
      id,
      name,
      subscribers,
      bannerUrl,
      topSongs,
    });
  } catch (err: any) {
    console.error('Error in /api/artist:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch artist info' });
  }
});

function decodeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeMatchText(str: string): string {
  return decodeHtmlEntities(str)
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)|\(ft\.?[^)]*\)|\[[^\]]*\]/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(official|music video|lyric video|audio|hd|4k|topic|vevo)\b/gi, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(str: string): string[] {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'feat', 'ft', 'by', 'with', 'in', 'on']);
  return normalizeMatchText(str)
    .split(' ')
    .filter((t) => t.length > 0 && !stop.has(t));
}

function tokenOverlap(queryStr: string, targetStr: string): number {
  const qTokens = getTokens(queryStr);
  const tTokens = new Set(getTokens(targetStr));
  if (qTokens.length === 0 || tTokens.size === 0) return 0;
  let hits = 0;
  for (const t of qTokens) {
    if (tTokens.has(t)) hits++;
  }
  return hits / qTokens.length;
}

function extractSaavnArtistText(hit: any): string {
  if (typeof hit.primaryArtists === 'string' && hit.primaryArtists.trim()) {
    return decodeHtmlEntities(hit.primaryArtists);
  }
  if (Array.isArray(hit.artists?.primary)) {
    return decodeHtmlEntities(hit.artists.primary.map((a: any) => a.name).filter(Boolean).join(', '));
  }
  if (typeof hit.featuredArtists === 'string' && hit.featuredArtists.trim()) {
    return decodeHtmlEntities(hit.featuredArtists);
  }
  return '';
}

function isStrictTrackMatch(
  hit: any,
  reqTitle: string,
  reqArtist: string,
  reqDurationSec?: number
): boolean {
  const hitTitle = decodeHtmlEntities(hit.name || hit.title || '');
  const hitArtists = extractSaavnArtistText(hit);
  const hitAlbum = decodeHtmlEntities(hit.album?.name || '');

  const normReqTitle = normalizeMatchText(reqTitle);
  const normHitTitle = normalizeMatchText(hitTitle);

  if (!normReqTitle || !normHitTitle) return false;

  // 1. Title similarity check
  const titleExactOrContains =
    normHitTitle === normReqTitle ||
    normHitTitle.includes(normReqTitle) ||
    normReqTitle.includes(normHitTitle);
  const titleOverlap = tokenOverlap(normReqTitle, normHitTitle);
  const reverseTitleOverlap = tokenOverlap(normHitTitle, normReqTitle);

  if (!titleExactOrContains && (titleOverlap < 0.7 || reverseTitleOverlap < 0.5)) {
    return false;
  }

  // Prevent accidentally matching karaoke/instrumental/cover/slowed versions unless requested
  const modifierWords = ['instrumental', 'karaoke', 'lofi', 'slowed', 'reverb', 'remix', '8d', 'sped up', 'nightcore'];
  for (const mod of modifierWords) {
    if (normHitTitle.includes(mod) && !normReqTitle.includes(mod)) {
      return false;
    }
  }

  // 2. Artist verification (CRITICAL so covers like KHS never resolve to Ed Sheeran original)
  const cleanArtist = normalizeMatchText(reqArtist);
  const isUnknownArtist =
    !cleanArtist ||
    cleanArtist === 'unknown artist' ||
    cleanArtist === 'unknown' ||
    cleanArtist === 'various artists';

  if (!isUnknownArtist) {
    const combinedHitMeta = `${hitArtists} ${hitTitle} ${hitAlbum}`;
    const artistOverlap = tokenOverlap(cleanArtist, combinedHitMeta);
    const reverseArtistOverlap = tokenOverlap(hitArtists, cleanArtist);
    const directSub =
      normalizeMatchText(hitArtists).includes(cleanArtist) ||
      cleanArtist.includes(normalizeMatchText(hitArtists));

    if (!directSub && artistOverlap < 0.5 && reverseArtistOverlap < 0.5) {
      return false;
    }
  }

  // 3. Duration similarity check (prevents matching a 2:40 cover with a 3:55 original)
  const hitDur = Number(hit.duration || 0);
  if (reqDurationSec && reqDurationSec > 30 && hitDur > 30) {
    if (Math.abs(hitDur - reqDurationSec) > 25) {
      return false;
    }
  }

  return true;
}

let ytdlInstance: Ytdl | null = null;
function getYtdl(): Ytdl {
  if (!ytdlInstance) {
    ytdlInstance = new Ytdl();
  }
  return ytdlInstance;
}

function buildStreamSearchQueries(rawTitle: string, rawArtist: string): string[] {
  const queries: string[] = [];
  const pushUnique = (q: string) => {
    const clean = q.replace(/\s+/g, ' ').trim();
    if (clean && !queries.includes(clean)) queries.push(clean);
  };

  // Extract featured artist names from "(feat. X)" / "[ft. X]" before stripping brackets
  const featMatches = Array.from(
    rawTitle.matchAll(/[\(\[]\s*(?:feat\.?|ft\.?|with)\s+([^\)\]]+)[\)\]]/gi)
  )
    .map((m) => m[1].replace(/[&,]/g, ' ').trim())
    .filter(Boolean);

  const baseTitle = rawTitle
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(official\s*(?:music\s*)?video|lyric\s*video|lyrics|audio|hd|4k)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const primaryArtist = rawArtist
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    ?.trim() || rawArtist;

  if (featMatches.length > 0 && baseTitle) {
    pushUnique(`${baseTitle} ${featMatches.join(' ')} ${primaryArtist}`.trim());
  }
  if (baseTitle && rawArtist) {
    pushUnique(`${baseTitle} ${rawArtist}`.trim());
  }
  if (baseTitle && primaryArtist && primaryArtist !== rawArtist) {
    pushUnique(`${baseTitle} ${primaryArtist}`.trim());
  }
  if (rawTitle && rawArtist) {
    pushUnique(`${rawTitle} ${rawArtist}`.trim());
  }
  if (!rawArtist && baseTitle) {
    pushUnique(baseTitle);
  }

  return queries.slice(0, 3);
}

async function fetchYouTubeOembedMeta(vidId: string): Promise<{ title: string; artist: string; thumbnailUrl: string } | null> {
  if (!vidId || vidId.length < 6) return null;
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(vidId)}&format=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    if (!data?.title) return null;

    let parsedTitle = String(data.title).trim();
    let parsedArtist = String(data.author_name || '')
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/VEVO$/i, '')
      .trim();

    // Parse "Artist - Song Title" format common on YouTube official & label uploads
    const dashParts = parsedTitle.split(/\s+[-–—]\s+/);
    if (dashParts.length >= 2 && dashParts[0].length >= 2 && dashParts[0].length <= 45) {
      const candidateArtist = dashParts[0].trim();
      const candidateTitle = dashParts.slice(1).join(' - ').trim();
      const isGenericChannel =
        !parsedArtist ||
        /records|music|t-series|sony|zee|warner|atlantic|universal|official|lyrics|nation|channel|topic/i.test(
          parsedArtist
        );
      if (isGenericChannel || candidateArtist.toLowerCase().includes(parsedArtist.toLowerCase().slice(0, 4))) {
        parsedArtist = candidateArtist;
        parsedTitle = candidateTitle;
      }
    }

    return {
      title: parsedTitle,
      artist: parsedArtist || 'Unknown Artist',
      thumbnailUrl: String(data.thumbnail_url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`),
    };
  } catch {
    return null;
  }
}

// 3. High-Fidelity Audio Stream Resolution & Proxying Endpoint (320kbps AAC/MP4 full-length streams)
app.get('/api/stream', async (req: Request, res: Response) => {
  let title = String(req.query.title || '').trim();
  let artist = String(req.query.artist || '').trim();
  const rawId = String(req.query.id || '').trim();
  const vidId = rawId.replace(/^yt-/, '');
  const reqDuration = parseInt(String(req.query.duration || '0'), 10) || 0;
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  // Set permissive CORS headers for media streaming & range scrubbing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  const isArtistUnknown =
    !artist ||
    artist.toLowerCase() === 'unknown artist' ||
    artist.toLowerCase() === 'unknown' ||
    artist.toLowerCase() === 'various artists';

  // If artist is missing (e.g. .db import) and we have a YouTube video ID, enrich metadata via oEmbed first!
  if (isArtistUnknown && vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
    const meta = await fetchYouTubeOembedMeta(vidId);
    if (meta) {
      if (!title || title === 'Untitled Song') title = meta.title;
      if (meta.artist && meta.artist !== 'Unknown Artist') {
        artist = meta.artist;
      }
    }
  }

  const effectiveArtist =
    artist &&
    artist.toLowerCase() !== 'unknown artist' &&
    artist.toLowerCase() !== 'unknown'
      ? artist
      : '';
  const searchQuery = `${title} ${effectiveArtist}`.trim();
  const cacheKey = `${vidId || 'noid'}::${searchQuery.toLowerCase()}::${reqDuration}`;

  if (!searchQuery && !vidId) {
    return res.status(400).json({ error: 'Missing stream parameters (title, artist, or id required)' });
  }

  try {
    let streamInfo = forceRefresh ? undefined : streamCache.get(cacheKey);

    if (!streamInfo || Date.now() - streamInfo.timestamp > CACHE_TTL) {
      let resolvedUrl: string | null = null;
      let mimeType = 'audio/mp4';

      // 1. Strict 320kbps JioSaavn lookup ONLY when we verify artist+title+duration
      if (title) {
        const queryVariants = buildStreamSearchQueries(title, effectiveArtist);
        const allowLooseWithoutArtist = !effectiveArtist && !vidId;

        for (const queryTerm of queryVariants) {
          if (resolvedUrl) break;
          try {
            const endpoint = `https://saavn-api-one.vercel.app/search/songs?query=${encodeURIComponent(queryTerm)}`;
            const resp = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
            if (resp.ok) {
              const data: any = await resp.json();
              const results = data.data?.results || data.results;
              if (Array.isArray(results)) {
                const matchedHit = results.slice(0, 8).find((hit: any) => {
                  if (!hit || !hit.downloadUrl) return false;
                  if (!effectiveArtist && !allowLooseWithoutArtist) {
                    return false;
                  }
                  return isStrictTrackMatch(hit, title, effectiveArtist, reqDuration);
                });

                if (matchedHit && matchedHit.downloadUrl) {
                  const downloadObj =
                    matchedHit.downloadUrl.find((d: any) => d.quality === '320kbps') ||
                    matchedHit.downloadUrl[matchedHit.downloadUrl.length - 1];
                  const directLink = downloadObj?.link || downloadObj?.url;
                  if (directLink) {
                    resolvedUrl = directLink;
                    mimeType = 'audio/mp4';
                    break;
                  }
                }
              }
            }
          } catch {
            // continue next query variant
          }
        }
      }

      // 2. Direct YouTube Music stream resolution via InnerTube if vidId exists (6s fast timeout)
      if (!resolvedUrl && vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
        try {
          const yt = await Promise.race([
            getInnertube(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Innertube timeout')), 4500)),
          ]);
          for (const client of ['IOS', 'ANDROID', 'WEB'] as const) {
            try {
              const info = await Promise.race([
                yt.getBasicInfo(vidId, { client }),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error('getBasicInfo timeout')), 3500)),
              ]);
              const format = info.chooseFormat({ quality: 'best', type: 'audio' });
              if (format) {
                const deciphered = format.url || (await format.decipher(yt.session.player));
                if (deciphered) {
                  resolvedUrl = deciphered;
                  mimeType = format.mime_type || 'audio/mp4';
                  break;
                }
              }
            } catch {
              // try next client
            }
          }
        } catch (ytErr: any) {
          console.warn('YouTube Music decipher notice:', ytErr?.message || ytErr);
        }
      }

      // 3. Fallback: @distube/ytdl-core extraction (works cleanly on residential/self-hosted IPs, 5s timeout)
      if (!resolvedUrl && vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
        try {
          const ytdl = getYtdl();
          const info = await Promise.race([
            ytdl.getInfo(vidId),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('ytdl timeout')), 5000)),
          ]);
          const format = chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: (f) => f.hasAudio && !f.hasVideo,
          });
          if (format?.url) {
            resolvedUrl = format.url;
            mimeType = format.mimeType?.split(';')[0] || 'audio/mp4';
          }
        } catch {
          // ignore if YouTube blocks datacenter IP or times out
        }
      }

      if (resolvedUrl) {
        streamInfo = { url: resolvedUrl, mimeType, timestamp: Date.now() };
        streamCache.set(cacheKey, streamInfo);
      }
    }

    if (streamInfo && streamInfo.url) {
      // If client requests JSON payload with resolved stream URL
      if (req.query.json === 'true') {
        return res.json({ streamUrl: streamInfo.url, mimeType: streamInfo.mimeType });
      }

      // Proxy remote stream with HTTP Range support for HTML5 <audio> tag
      const range = req.headers.range;
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      };
      if (range) {
        fetchHeaders['Range'] = range;
      }

      const streamResp = await fetch(streamInfo.url, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(22000),
      });
      if (streamResp.ok || streamResp.status === 206) {
        const statusCode = range || streamResp.status === 206 ? 206 : streamResp.status;
        res.status(statusCode);
        res.setHeader('Content-Type', streamInfo.mimeType || 'audio/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        const isDownload = req.query.download === '1' || req.query.refresh === '1';
        res.setHeader('Cache-Control', isDownload ? 'no-store' : 'public, max-age=3600');

        const contentRange = streamResp.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);

        const contentLength = streamResp.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);

        if (streamResp.body) {
          const reader = streamResp.body.getReader();
          req.on('close', () => {
            reader.cancel().catch(() => {});
          });
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
            if (!res.writableEnded) res.end();
          };
          pump().catch(() => {
            if (!res.writableEnded) res.end();
          });
          return;
        }
      } else {
        // Evict stale upstream URL from cache if CDN rejected it
        streamCache.delete(cacheKey);
      }
    }

    return res.status(404).json({ error: 'Direct audio stream not available' });
  } catch (err: any) {
    console.error('Error in /api/stream:', err?.message || err);
    return res.status(500).json({ error: 'Stream resolution failed' });
  }
});

// 3b. Sync Song Candidates Endpoint (Resolves metadata + potential YouTube & 320kbps direct matches)
app.get('/api/sync-candidates', async (req: Request, res: Response) => {
  const customQuery = String(req.query.q || '').trim();
  const title = String(req.query.title || '').trim();
  const artist = String(req.query.artist || '').trim();
  const rawId = String(req.query.vidId || '').trim();
  const vidId = rawId.replace(/^yt-/, '');
  const limit = Math.min(30, Math.max(5, parseInt(String(req.query.limit || '18'), 10)));

  try {
    let resolvedMeta: { title: string; artist: string; thumbnailUrl: string } | null = null;
    if (vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
      resolvedMeta = await fetchYouTubeOembedMeta(vidId);
    }

    const isArtistUnknown =
      !artist ||
      artist.toLowerCase() === 'unknown artist' ||
      artist.toLowerCase() === 'unknown' ||
      artist.toLowerCase() === 'various artists';

    let searchQuery = customQuery;
    if (!searchQuery) {
      if (!isArtistUnknown && title) {
        searchQuery = `${title} ${artist}`.trim();
      } else if (resolvedMeta) {
        const cleanMetaArtist =
          resolvedMeta.artist && resolvedMeta.artist !== 'Unknown Artist' ? resolvedMeta.artist : '';
        searchQuery = `${resolvedMeta.title || title} ${cleanMetaArtist}`.trim();
      } else {
        searchQuery = title;
      }
    }

    if (!searchQuery) {
      return res.json({ resolvedMeta, candidates: [] });
    }

    const candidates: any[] = [];
    const seenKeys = new Set<string>();

    // Include enriched oEmbed track as first candidate when vidId exists & not explicitly searching custom text
    if (resolvedMeta && vidId && !customQuery) {
      const key = `yt-${vidId}`;
      seenKeys.add(key);
      candidates.push({
        id: key,
        title: resolvedMeta.title || title,
        artist: resolvedMeta.artist,
        duration: 210,
        thumbnailUrl: resolvedMeta.thumbnailUrl,
        source: 'youtube',
        youtubeId: vidId,
        playCount: 0,
      });
    }

    // Search YouTube Music songs + videos & JioSaavn 320kbps in parallel
    const [ytResults, saavnResults] = await Promise.all([
      (async () => {
        const list: any[] = [];
        try {
          const yt = await getInnertube();
          const songRes = await yt.music.search(searchQuery, { type: 'song' });
          const songs = (songRes.songs as any)?.contents || [];
          for (const item of songs.slice(0, 10)) {
            const yId = String(item.id || '');
            if (!yId) continue;
            const art = Array.isArray(item.artists)
              ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
              : (item.artist?.name || 'Unknown Artist');
            list.push({
              id: `yt-${yId}`,
              title: item.title || 'Untitled Song',
              artist: art,
              album: item.album?.name || undefined,
              duration: item.duration?.seconds || 210,
              thumbnailUrl:
                item.thumbnails?.[item.thumbnails.length - 1]?.url ||
                `https://i.ytimg.com/vi/${yId}/hqdefault.jpg`,
              source: 'youtube',
              youtubeId: yId,
              playCount: 0,
            });
          }

          // Also check official videos / covers (important for e.g. KHS, acoustic covers, remixes)
          const vidRes = await yt.music.search(searchQuery, { type: 'video' });
          const videos = (vidRes.videos as any)?.contents || [];
          for (const item of videos.slice(0, 8)) {
            const yId = String(item.id || '');
            if (!yId) continue;
            const art = Array.isArray(item.artists)
              ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ')
              : (item.author?.name || 'Unknown Artist');
            list.push({
              id: `yt-${yId}`,
              title: item.title || 'Untitled Song',
              artist: art,
              duration: item.duration?.seconds || 210,
              thumbnailUrl:
                item.thumbnails?.[item.thumbnails.length - 1]?.url ||
                `https://i.ytimg.com/vi/${yId}/hqdefault.jpg`,
              source: 'youtube',
              youtubeId: yId,
              playCount: 0,
            });
          }
        } catch (err) {
          console.warn('Sync candidates YT search error:', err);
        }
        return list;
      })(),
      (async () => {
        const list: any[] = [];
        try {
          const resp = await fetch(
            `https://saavn-api-one.vercel.app/search/songs?query=${encodeURIComponent(searchQuery)}`,
            { signal: AbortSignal.timeout(3500) }
          );
          if (resp.ok) {
            const data: any = await resp.json();
            const hits = data.data?.results || data.results || [];
            for (const hit of hits.slice(0, 6)) {
              if (!hit?.downloadUrl) continue;
              const downloadObj =
                hit.downloadUrl.find((d: any) => d.quality === '320kbps') ||
                hit.downloadUrl[hit.downloadUrl.length - 1];
              const directLink = downloadObj?.link || downloadObj?.url;
              if (!directLink) continue;

              const imgObj =
                hit.image?.[hit.image.length - 1] || hit.image?.[0];
              const thumbUrl = imgObj?.link || imgObj?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80';
              list.push({
                id: `saavn-${hit.id}`,
                title: decodeHtmlEntities(hit.name || 'Untitled Song'),
                artist: extractSaavnArtistText(hit) || 'Unknown Artist',
                album: hit.album?.name ? decodeHtmlEntities(hit.album.name) : undefined,
                duration: Number(hit.duration) || 210,
                thumbnailUrl: thumbUrl,
                source: 'stream',
                streamUrl: directLink,
                year: hit.year || undefined,
                playCount: 0,
              });
            }
          }
        } catch {
          // ignore
        }
        return list;
      })(),
    ]);

    for (const item of [...ytResults, ...saavnResults]) {
      if (!seenKeys.has(item.id)) {
        seenKeys.add(item.id);
        candidates.push(item);
      }
      if (candidates.length >= limit) break;
    }

    return res.json({
      resolvedMeta,
      queryUsed: searchQuery,
      candidates,
    });
  } catch (err: any) {
    console.error('Error in /api/sync-candidates:', err?.message || err);
    return res.json({ resolvedMeta: null, candidates: [] });
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
    const distPath = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
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
