export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number; // in seconds
  thumbnailUrl: string;
  source: 'youtube' | 'local' | 'stream';
  youtubeId?: string;
  streamUrl?: string;
  lyrics?: string;
  genre?: string;
  year?: number | string;
  liked?: boolean;
  playCount?: number;
  lastPlayedAt?: number;
  addedAt?: number;
}

export interface Artist {
  id: string;
  name: string;
  thumbnailUrl: string;
  bannerUrl?: string;
  subscribers?: string;
  bio?: string;
  topSongs: Song[];
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | string;
  coverUrl: string;
  songs: Song[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  color?: string;
  isBuiltIn?: boolean;
  type?: 'liked' | 'history' | 'downloaded' | 'custom';
  songs: Song[];
  createdAt: number;
}

export interface SyncedLyricLine {
  time: number; // seconds
  text: string;
}

export interface LyricsData {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: SyncedLyricLine[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface EqualizerBands {
  band60: number;   // -12 to +12 dB
  band230: number;  // -12 to +12 dB
  band910: number;  // -12 to +12 dB
  band3600: number; // -12 to +12 dB
  band14000: number;// -12 to +12 dB
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: EqualizerBands;
  bassBoost: number; // 0 to 100
}

export type ThemeName = 'riplay' | 'amoled' | 'spotify' | 'cyan' | 'purple';

export interface ThemeColors {
  name: ThemeName;
  label: string;
  accent: string;
  accentHover: string;
  background0: string; // main bg
  background1: string; // card bg
  background2: string; // active/hover bg
  text: string;
  textSecondary: string;
}

export interface UserStats {
  totalMinutes: number;
  totalPlays: number;
  playHistory: { songId: string; playedAt: number; duration: number }[];
  songPlayCounts: Record<string, number>;
  artistPlayCounts: Record<string, number>;
  rankBadge: 'Bronze Newbie' | 'Silver Explorer' | 'Gold Audiophile' | 'Diamond Legend';
}
