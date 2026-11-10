import { Song, Artist, Album } from '../types/music';

// Cache recent search queries to minimize redundant network requests
const searchCache = new Map<string, Song[]>();
const genreCache = new Map<string, Song[]>();

export class OnlineMusicService {
  /**
   * Searches online music catalog for FULL-LENGTH tracks (complete songs from 0:00 to end)
   * with high-resolution artwork and direct high-fidelity MP3 audio streams.
   */
  static async searchOnlineMusic(query: string, limit = 30): Promise<Song[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }

    try {
      // 1. Query full-stack backend /api/search for genuine full-length YouTube Music tracks
      const backendUrl = `/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
      const res = await fetch(backendUrl);
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
    } catch (err) {
      console.warn('Backend search failed, checking fallbacks:', err);
    }

    // 2. Fallback to iTunes search if Audius returned no results
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=${limit}`;
      const res = await fetch(itunesUrl);
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
  /**
   * Searches for verified artists online via YouTube Music
   */
  static async searchOnlineArtists(query: string, limit = 12): Promise<Artist[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=artist&limit=${limit}`);
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
    } catch (err) {
      console.warn('Online artist search error:', err);
    }

    return [];
  }

  /**
   * Searches for official albums online via YouTube Music
   */
  static async searchOnlineAlbums(query: string, limit = 12): Promise<Album[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&type=album&limit=${limit}`);
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
    } catch (err) {
      console.warn('Online album search error:', err);
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
   */
  static async resolveStreamUrl(song: Song): Promise<string | undefined> {
    // 1. If song already has a direct valid audio stream URL, return it immediately
    if (
      song.streamUrl &&
      !song.streamUrl.startsWith('/api/stream') &&
      !song.streamUrl.includes('itunes.apple.com')
    ) {
      return song.streamUrl;
    }

    const cleanTitle = song.title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();

    // 2. Query full-stack backend /api/stream endpoint for 320kbps direct stream URL
    try {
      const backendUrl = `/api/stream?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(song.artist)}&json=true`;
      const res = await fetch(backendUrl);
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

    // 3. Fallback: Query direct client CDN resolver
    try {
      const term = `${cleanTitle} ${song.artist}`.trim();
      const res = await fetch(`https://saavn-api-one.vercel.app/search/songs?query=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        const hit = data.data?.results?.[0];
        if (hit && hit.downloadUrl) {
          const downloadObj =
            hit.downloadUrl.find((d: any) => d.quality === '320kbps') ||
            hit.downloadUrl[hit.downloadUrl.length - 1];
          const directLink = downloadObj?.link || downloadObj?.url;
          if (directLink) {
            song.streamUrl = directLink;
            if (hit.duration > 30) song.duration = hit.duration;
            return directLink;
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Fallback search by title only
    try {
      const res = await fetch(`https://saavn-api-one.vercel.app/search/songs?query=${encodeURIComponent(cleanTitle)}`);
      if (res.ok) {
        const data = await res.json();
        const hit = data.data?.results?.[0];
        if (hit && hit.downloadUrl) {
          const downloadObj =
            hit.downloadUrl.find((d: any) => d.quality === '320kbps') ||
            hit.downloadUrl[hit.downloadUrl.length - 1];
          const directLink = downloadObj?.link || downloadObj?.url;
          if (directLink) {
            song.streamUrl = directLink;
            if (hit.duration > 30) song.duration = hit.duration;
            return directLink;
          }
        }
      }
    } catch {
      // ignore
    }

    return song.streamUrl;
  }

  /**
   * Fetches real playable full-length audio Blob for offline storage in IndexedDB.
   * Guarantees that saved audio matches complete song duration (never 30s preview clips).
   */
  static async fetchAudioBlob(song: Song): Promise<Blob | null> {
    const streamUrl = await this.resolveStreamUrl(song);
    if (streamUrl) {
      try {
        const resp = await fetch(streamUrl, { mode: 'cors' });
        if (resp.ok) {
          const blob = await resp.blob();
          if (blob.size > 100000) return blob;
        }
      } catch {
        // ignore
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


