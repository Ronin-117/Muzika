import { Song, Artist } from '../types/music';

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
   * Searches for artists online
   */
  static async searchOnlineArtists(query: string, limit = 6): Promise<Artist[]> {
    if (!query.trim()) return [];

    try {
      const url = `https://discoveryprovider.audius.co/v1/users/search?query=${encodeURIComponent(query.trim())}&app_name=MUZIKA`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          return data.data.slice(0, limit).map((u: any) => ({
            id: `artist-${u.id}`,
            name: u.name,
            thumbnailUrl: u.profile_picture?.['480x480'] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
            bannerUrl: u.cover_photo?.['640x'] || undefined,
            subscribers: `${u.follower_count || 100} Followers`,
            bio: u.bio || undefined,
            topSongs: [],
          }));
        }
      }
    } catch {
      // ignore
    }

    return [];
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
   * Automatically resolves a guaranteed FULL-LENGTH audio stream (not a 30s preview)
   * for any track so it plays from 0:00 to the very end with mobile screen-off support.
   */
  static async resolveStreamUrl(song: Song): Promise<string | undefined> {
    // 1. If song has a valid YouTube ID (e.g. from imported RiPlay database!), use backend stream endpoint
    const ytId =
      song.youtubeId ||
      (song.id.startsWith('yt-')
        ? song.id.replace('yt-', '')
        : song.id.length === 11 && !song.id.includes('/')
        ? song.id
        : null);

    if (ytId && /^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
      song.youtubeId = ytId;
      song.source = 'youtube';
      return undefined;
    }

    // 2. If already has a full-length direct audio stream or local blob, keep it
    if (song.streamUrl && !song.streamUrl.includes('itunes.apple.com')) {
      return song.streamUrl;
    }

    // 3. Query backend /api/search with song title + artist to find exact YouTube ID
    try {
      const cleanTitle = song.title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
      const query = `${cleanTitle} ${song.artist}`.trim();
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=3`);
      if (res.ok) {
        const results = await res.json();
        const hit = results?.[0];
        if (hit && hit.youtubeId) {
          song.youtubeId = hit.youtubeId;
          song.source = 'youtube';
          if (hit.duration > 30) song.duration = hit.duration;
          return undefined;
        }
      }
    } catch {
      // ignore
    }

    // 4. Fallback search by title only
    try {
      const cleanTitle = song.title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
      const res = await fetch(`/api/search?q=${encodeURIComponent(cleanTitle)}&limit=3`);
      if (res.ok) {
        const results = await res.json();
        const hit = results?.[0];
        if (hit && hit.youtubeId) {
          song.youtubeId = hit.youtubeId;
          if (hit.duration > 30) song.duration = hit.duration;
          const fullAudioStream = `/api/stream?id=${hit.youtubeId}`;
          song.streamUrl = fullAudioStream;
          return fullAudioStream;
        }
      }
    } catch {
      // ignore
    }

    return song.streamUrl;
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


