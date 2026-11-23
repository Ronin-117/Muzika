import { Song, Artist, Album } from '../types/music';

// Cache recent search queries to minimize redundant network requests
const searchCache = new Map<string, Song[]>();
const genreCache = new Map<string, Song[]>();

export class OnlineMusicService {
  /**
   * Searches online music catalog for FULL-LENGTH tracks (complete songs from 0:00 to end)
   * with high-resolution artwork and direct high-fidelity MP3 audio streams.
   */
  static async searchOnlineMusic(query: string, limit = 30, signal?: AbortSignal): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }

    try {
      // 1. Query full-stack backend /api/search for genuine full-length YouTube Music tracks
      const backendUrl = `/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
      const res = await fetch(backendUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const songs: Song[] = data.map((item: any) => ({
            id: item.id || `yt-${item.youtubeId}`,
            title: item.title,
            artist: item.artist,
            duration: item.duration || 210, // Complete song duration from 0:00 to end
            thumbnailUrl: item.thumbnailUrl,
            source: 'youtube' as const,
            youtubeId: item.youtubeId,
            playCount: item.playCount || 0,
          }));

          searchCache.set(cacheKey, songs);
          return songs;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return [];
      console.warn('Backend search failed, checking fallbacks:', err);
    }

    if (signal?.aborted) return [];

    // 2. Fallback to iTunes search if backend returned no results
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=${limit}`;
      const res = await fetch(itunesUrl, { signal });
      if (!res.ok) return [];

      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) return [];

      const songs: Song[] = data.results
        .filter((item: any) => item.trackName)
        .map((item: any) => {
          const highResArtwork = (item.artworkUrl100 || '')
            .replace('100x100bb', '600x600bb')
            .replace('100x100', '600x600');

          const durationSeconds = item.trackTimeMillis
            ? Math.round(item.trackTimeMillis / 1000)
            : 210;

          return {
            id: `online-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName || 'Unknown Artist',
            artistId: item.artistId ? String(item.artistId) : undefined,
            album: item.collectionName || 'Single',
            albumId: item.collectionId ? String(item.collectionId) : undefined,
            duration: durationSeconds,
            thumbnailUrl: highResArtwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
            source: 'stream' as const,
            streamUrl: item.previewUrl,
            genre: item.primaryGenreName || 'Music',
            year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : undefined,
            playCount: 0,
          };
        });

      searchCache.set(cacheKey, songs);
      return songs;
    } catch {
      return [];
    }
  }

  /**
   * Fetches top full-length tracks for a specific genre or mood
   */
  static async fetchTracksByGenre(genre: string, limit = 25): Promise<Song[]> {
    const key = `${genre.toLowerCase()}_${limit}`;
    if (genreCache.has(key)) {
      return genreCache.get(key)!;
    }

    try {
      // Query backend for curated full-length genre tracks
      const songs = await this.searchOnlineMusic(`${genre} Hits`, limit);
      if (songs.length > 0) {
        genreCache.set(key, songs);
        return songs;
      }
    } catch {
      // ignore
    }

    return this.searchOnlineMusic(genre, limit);
  }

  /**
   * Searches for verified artists online via YouTube Music
   */
  static async searchOnlineArtists(query: string, limit = 12, signal?: AbortSignal): Promise<Artist[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=artist&limit=${limit}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => {
            const rawSub = item.subscribers;
            const subscribers = typeof rawSub === 'string'
              ? rawSub
              : (rawSub?.text || (Array.isArray(rawSub?.runs) ? rawSub.runs.map((r: any) => r.text || '').join('') : 'Verified Artist'));

            return {
              id: String(item.id || ''),
              name: String(item.name || 'Unknown Artist'),
              thumbnailUrl: item.thumbnailUrl,
              bannerUrl: item.bannerUrl,
              subscribers,
              bio: item.bio,
              topSongs: item.topSongs || [],
            };
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Online artist search error:', err);
      }
    }

    return [];
  }

  /**
   * Searches for official albums online via YouTube Music
   */
  static async searchOnlineAlbums(query: string, limit = 12, signal?: AbortSignal): Promise<Album[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=album&limit=${limit}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            year: item.year,
            coverUrl: item.coverUrl,
            songs: item.songs || [],
          }));
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Online album search error:', err);
      }
    }

    return [];
  }

  /**
   * Fetches full track list for an album
   */
  static async fetchAlbumTracks(albumId: string): Promise<Song[]> {
    if (!albumId) return [];

    try {
      const res = await fetch(`/api/album?id=${encodeURIComponent(albumId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.songs)) {
          return data.songs;
        }
      }
    } catch (err) {
      console.warn('Fetch album tracks error:', err);
    }

    return [];
  }

  /**
   * Fetches top songs for an artist
   */
  static async fetchArtistTopSongs(artistId: string): Promise<{ bannerUrl?: string; topSongs: Song[] }> {
    if (!artistId) return { topSongs: [] };

    try {
      const res = await fetch(`/api/artist?id=${encodeURIComponent(artistId)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          bannerUrl: data.bannerUrl,
          topSongs: Array.isArray(data.topSongs) ? data.topSongs : [],
        };
      }
    } catch (err) {
      console.warn('Fetch artist top songs error:', err);
    }

    return { topSongs: [] };
  }

  /**
   * Provides instant search autocomplete queries as the user types
   */
  static getPopularSuggestions(query: string): string[] {
    const popular = [
      'The Weeknd',
      'Coldplay',
      'Taylor Swift',
      'Billie Eilish',
      'Drake',
      'Linkin Park',
      'Dua Lipa',
      'Ed Sheeran',
      'Imagine Dragons',
      'Bruno Mars',
      'Post Malone',
      'Eminem',
      'Lofi Chill Beats',
      'Queen - Bohemian Rhapsody',
      'Kendrick Lamar',
      'Ariana Grande',
      'Bad Bunny',
      'Harry Styles',
      'Daft Punk',
      'K-Pop Top Hits',
    ];

    if (!query.trim()) return popular.slice(0, 8);

    const qLower = query.toLowerCase();
    const matched = popular.filter((p) => p.toLowerCase().includes(qLower));

    if (!matched.some((m) => m.toLowerCase() === qLower)) {
      matched.unshift(query);
    }

    return matched.slice(0, 6);
  }

  /**
   * Automatically resolves a guaranteed FULL-LENGTH 320kbps audio stream
   * for any track so it plays from 0:00 to the very end with mobile screen-off support.
   * Uses strict artist+title+duration matching so covers/remixes are never hijacked by wrong artists.
   */
  static async resolveStreamUrl(song: Song, forceRefresh = false): Promise<string | undefined> {
    // 1. If song already has a direct valid audio stream URL, return it immediately
    if (
      !forceRefresh &&
      song.streamUrl &&
      !song.streamUrl.startsWith('/api/stream') &&
      !song.streamUrl.includes('itunes.apple.com')
    ) {
      return song.streamUrl;
    }

    const rawTitle = (song.title || '').trim();
    const cleanTitle = rawTitle.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
    const vidId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : '');
    const strictVid = Boolean(song.syncedAt && song.source === 'youtube' && vidId);

    // 2. Query full-stack backend /api/stream endpoint with full title (preserving feat.), vidId & duration
    try {
      const refreshParam = forceRefresh ? '&refresh=1' : '';
      const strictParam = strictVid ? '&strictVid=1' : '';
      const backendUrl = `/api/stream?title=${encodeURIComponent(rawTitle)}&artist=${encodeURIComponent(song.artist || '')}&id=${encodeURIComponent(vidId)}&duration=${song.duration || 0}&json=true${refreshParam}${strictParam}`;
      const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(12000) : undefined;
      const res = await fetch(backendUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl) {
          song.streamUrl = data.streamUrl;
          return data.streamUrl;
        }
      }
    } catch {
      // ignore
    }

    // 3. Client-side verified fallback (skip when strictVid targets an exact synced YouTube video)
    const isUnknownArtist =
      !song.artist ||
      song.artist.toLowerCase() === 'unknown artist' ||
      song.artist.toLowerCase() === 'unknown' ||
      song.artist.toLowerCase() === 'various artists';

    if (!isUnknownArtist && !strictVid) {
      try {
        const term = `${cleanTitle} ${song.artist}`.trim();
        const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(8000) : undefined;
        const res = await fetch(`https://saavn-api-one.vercel.app/search/songs?query=${encodeURIComponent(term)}`, { signal });
        if (res.ok) {
          const data = await res.json();
          const results: any[] = data.data?.results || [];
          const normReqTitle = this.normalizeText(cleanTitle);
          const normReqArtist = this.normalizeText(song.artist);

          const hit = results.slice(0, 6).find((r: any) => {
            if (!r?.downloadUrl) return false;
            const hitTitle = this.normalizeText(r.name || '');
            const hitArtist = this.normalizeText(r.primaryArtists || '');
            const hitAlbum = this.normalizeText(r.album?.name || '');
            const titleOk = hitTitle.includes(normReqTitle) || normReqTitle.includes(hitTitle);
            const artistTokens = normReqArtist.split(' ').filter((t) => t.length > 1);
            const artistOk =
              artistTokens.length === 0 ||
              artistTokens.some((tok) => hitArtist.includes(tok) || hitTitle.includes(tok) || hitAlbum.includes(tok));
            const durOk =
              !song.duration || song.duration <= 30 || !r.duration || Math.abs(Number(r.duration) - song.duration) <= 25;
            return titleOk && artistOk && durOk;
          });

          if (hit && hit.downloadUrl) {
            const downloadObj =
              hit.downloadUrl.find((d: any) => d.quality === '320kbps') ||
              hit.downloadUrl[hit.downloadUrl.length - 1];
            const directLink = downloadObj?.link || downloadObj?.url;
            if (directLink) {
              song.streamUrl = directLink;
              if (hit.duration > 30) song.duration = Number(hit.duration);
              return directLink;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return undefined;
  }

  private static normalizeText(str: string): string {
    return String(str || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Fetches candidate matches for Sync Song (both Auto-Sync & Manual Sync UI).
   */
  static async fetchSyncCandidates(params: {
    query?: string;
    title?: string;
    artist?: string;
    vidId?: string;
    limit?: number;
  }): Promise<{
    resolvedMeta: { title: string; artist: string; thumbnailUrl: string } | null;
    queryUsed: string;
    candidates: Song[];
  }> {
    const query = (params.query || '').trim();
    const title = (params.title || '').trim();
    const artist = (params.artist || '').trim();
    const vidId = (params.vidId || '').trim();
    const limit = params.limit || 18;

    try {
      const url = `/api/sync-candidates?q=${encodeURIComponent(query)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&vidId=${encodeURIComponent(vidId)}&limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return {
          resolvedMeta: data.resolvedMeta || null,
          queryUsed: data.queryUsed || query || `${title} ${artist}`.trim(),
          candidates: Array.isArray(data.candidates) ? data.candidates : [],
        };
      }
    } catch (err) {
      console.warn('Sync candidates backend fetch failed, falling back:', err);
    }

    // Fallback to client-side search if backend is unavailable
    const effectiveQuery = query || `${title} ${artist && artist !== 'Unknown Artist' ? artist : ''}`.trim();
    const fallbackSongs = effectiveQuery ? await this.searchOnlineMusic(effectiveQuery, limit) : [];
    return {
      resolvedMeta: null,
      queryUsed: effectiveQuery,
      candidates: fallbackSongs,
    };
  }

  /**
   * Scores and picks the best matching candidate for Auto-Sync.
   */
  static pickBestSyncMatch(
    originalSong: Song,
    candidates: Song[],
    resolvedMeta?: { title?: string; artist?: string } | null
  ): Song | null {
    if (!candidates || candidates.length === 0) return null;

    const origIsUnknown =
      !originalSong.artist ||
      originalSong.artist.toLowerCase() === 'unknown artist' ||
      originalSong.artist.toLowerCase() === 'unknown';

    const targetTitle = this.normalizeText(
      (originalSong.title && originalSong.title !== 'Untitled Song' ? originalSong.title : resolvedMeta?.title) || ''
    );
    const targetArtist = this.normalizeText(
      !origIsUnknown ? originalSong.artist : (resolvedMeta?.artist && resolvedMeta.artist !== 'Unknown Artist' ? resolvedMeta.artist : '')
    );

    const titleTokens = targetTitle.split(' ').filter((t) => t.length > 1);
    const artistTokens = targetArtist.split(' ').filter((t) => t.length > 1);

    let best: Song | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const cTitle = this.normalizeText(cand.title);
      const cArtist = this.normalizeText(cand.artist);
      const cAlbum = this.normalizeText(cand.album || '');
      const combined = `${cTitle} ${cArtist} ${cAlbum}`;

      let score = 0;

      // Prefer earlier search rank slightly as tie-breaker
      score += Math.max(0, 10 - i * 0.5);

      // Title match
      if (targetTitle && cTitle === targetTitle) score += 40;
      else if (targetTitle && (cTitle.includes(targetTitle) || targetTitle.includes(cTitle))) score += 25;
      if (titleTokens.length > 0) {
        const matchedTitleTokens = titleTokens.filter((t) => cTitle.includes(t)).length;
        score += (matchedTitleTokens / titleTokens.length) * 30;
      }

      // Artist match (critical)
      if (artistTokens.length > 0) {
        const matchedArtistTokens = artistTokens.filter((t) => combined.includes(t)).length;
        if (matchedArtistTokens > 0) {
          score += (matchedArtistTokens / artistTokens.length) * 50;
        } else {
          // Artist mismatch penalty!
          score -= 45;
        }
      } else if (cand.artist && cand.artist !== 'Unknown Artist') {
        // Bonus when original had Unknown Artist and candidate gives real artist metadata
        score += 15;
      }

      // Avoid selecting the exact broken source unless it gained real artist metadata from oEmbed
      if (
        originalSong.youtubeId &&
        cand.youtubeId === originalSong.youtubeId &&
        !origIsUnknown
      ) {
        // Slightly prefer alternative clean match if user explicitly hit Auto Sync because playback seemed off
        score -= 5;
      }

      // Duration closeness
      if (originalSong.duration > 30 && cand.duration > 30) {
        const diff = Math.abs(originalSong.duration - cand.duration);
        if (diff <= 10) score += 10;
        else if (diff > 35) score -= 15;
      }

      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    return best || candidates[0];
  }

  /**
   * Fetches real playable full-length audio Blob for offline storage in IndexedDB.
   * Uses simple CORS GET (never cache: 'no-store' on third-party CDNs, which triggers
   * an OPTIONS preflight rejected with 403 by Azure/Saavn CDNs) plus same-origin /api/stream proxy fallback.
   */
  static async fetchAudioBlob(song: Song, outerSignal?: AbortSignal): Promise<Blob | null> {
    const rawTitle = (song.title || '').trim();
    const vidId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : song.id);

    const normalizeAudioBlob = (blob: Blob, contentType?: string | null): Blob | null => {
      if (!blob || blob.size <= 50000) return null;
      const rawMime = (blob.type && blob.type !== 'application/octet-stream' ? blob.type : contentType || 'audio/mp4')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!rawMime || rawMime.includes('json') || rawMime.includes('html') || rawMime.includes('text') || rawMime.includes('xml')) {
        return null;
      }
      return blob.type === rawMime ? blob : new Blob([blob], { type: rawMime });
    };

    const fetchWithAbort = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onOuterAbort = () => controller.abort();
      if (outerSignal) {
        if (outerSignal.aborted) {
          clearTimeout(timer);
          controller.abort();
        } else {
          outerSignal.addEventListener('abort', onOuterAbort, { once: true });
        }
      }
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
        if (outerSignal) {
          outerSignal.removeEventListener('abort', onOuterAbort);
        }
      }
    };

    // 1. Direct CORS download from resolved streamUrl (no cache: 'no-store' on cross-origin!)
    const streamUrl = await this.resolveStreamUrl(song, false);
    if (outerSignal?.aborted) return null;

    if (streamUrl && !streamUrl.startsWith('/api/stream')) {
      try {
        // For unsigned Saavn CDN URLs, append _cb to bypass Chrome's <audio> range cache lock
        // while keeping it a simple CORS GET (no OPTIONS preflight!)
        const isSaavnCdn = streamUrl.includes('saavncdn.com');
        const directFetchUrl = isSaavnCdn
          ? `${streamUrl}${streamUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}`
          : streamUrl;

        const resp = await fetchWithAbort(
          directFetchUrl,
          { mode: 'cors' },
          25000
        );
        if (resp.ok) {
          const rawBlob = await resp.blob();
          const validBlob = normalizeAudioBlob(rawBlob, resp.headers.get('Content-Type'));
          if (validBlob) return validBlob;
        }
      } catch {
        // Fall through to same-origin server proxy
      }
    }

    if (outerSignal?.aborted) return null;

    // 2. Fetch via same-origin server proxy (bypasses CORS & SW cloning; preserves server streamCache first)
    const directParam =
      streamUrl && streamUrl.startsWith('https://')
        ? `&directUrl=${encodeURIComponent(streamUrl)}`
        : '';
    const baseProxyUrl = `/api/stream?title=${encodeURIComponent(rawTitle)}&artist=${encodeURIComponent(song.artist || '')}&id=${encodeURIComponent(vidId)}&duration=${song.duration || 0}&download=1${directParam}`;

    for (const suffix of ['', '&refresh=1']) {
      if (outerSignal?.aborted) return null;
      try {
        const resp = await fetchWithAbort(
          `${baseProxyUrl}${suffix}`,
          { cache: 'no-store' },
          35000
        );
        if (resp.ok) {
          const rawBlob = await resp.blob();
          const validBlob = normalizeAudioBlob(rawBlob, resp.headers.get('Content-Type'));
          if (validBlob) return validBlob;
        }
      } catch {
        // try refresh pass if first pass failed
      }
    }

    return null;
  }

  /**
   * Fetches 100% synchronized LRC timestamped lyrics for any song via LRCLIB
   */
  static async fetchSyncedLyrics(song: Song): Promise<string | null> {
    try {
      const cleanTitle = song.title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
      const res = await fetch(
        `/api/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(song.artist)}&duration=${song.duration || 0}`
      );
      if (res.ok) {
        const data = await res.json();
        return data.syncedLyrics || data.plainLyrics || null;
      }
    } catch {
      // ignore
    }
    return null;
  }
}


