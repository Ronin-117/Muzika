import { LyricsData, SyncedLyricLine } from '../types/music';

// Cache to prevent duplicate network calls
const lyricsCache = new Map<string, LyricsData>();

export function parseLrcString(lrcContent: string): SyncedLyricLine[] {
  if (!lrcContent) return [];
  const lines = lrcContent.split('\n');
  const result: SyncedLyricLine[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    timeRegex.lastIndex = 0;
    const matches: number[] = [];
    let match;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
      matches.push(totalSeconds);
    }

    const text = trimmed.replace(timeRegex, '').trim();

    for (const time of matches) {
      result.push({ time, text });
    }
  }

  // Sort chronologically
  return result.sort((a, b) => a.time - b.time);
}

export async function fetchLyricsFromLrcLib(
  title: string,
  artist: string,
  duration?: number
): Promise<LyricsData | null> {
  const cacheKey = `${artist.toLowerCase()}_${title.toLowerCase()}`;
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });

    const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Pick closest match by duration if provided, otherwise first result
    let best = data[0];
    if (duration && duration > 0) {
      const matches = [...data].sort((a, b) => {
        const diffA = Math.abs((a.duration || 0) - duration);
        const diffB = Math.abs((b.duration || 0) - duration);
        return diffA - diffB;
      });
      best = matches[0];
    }

    const parsedSynced = best.syncedLyrics ? parseLrcString(best.syncedLyrics) : undefined;

    const lyricsData: LyricsData = {
      trackName: best.trackName || title,
      artistName: best.artistName || artist,
      albumName: best.albumName,
      duration: best.duration,
      instrumental: best.instrumental || false,
      plainLyrics: best.plainLyrics,
      syncedLyrics: parsedSynced && parsedSynced.length > 0 ? parsedSynced : undefined,
    };

    lyricsCache.set(cacheKey, lyricsData);
    return lyricsData;
  } catch (err) {
    console.warn('LRCLIB fetch error:', err);
    return null;
  }
}
