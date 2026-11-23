import { Song, Playlist, Artist, Album, EqualizerSettings, ThemeName, UserStats, NamedQueue } from '../types/music';

const STORAGE_KEYS = {
  LIKED_SONGS: 'muzika_liked_songs',
  PLAYLISTS: 'muzika_playlists',
  HISTORY: 'muzika_history',
  USER_STATS: 'muzika_user_stats',
  EQUALIZER: 'muzika_eq_settings',
  THEME: 'muzika_theme',
  BLACKLIST: 'muzika_blacklist',
  LOCAL_SONGS: 'muzika_local_songs',
  CUSTOM_ARTISTS: 'muzika_custom_artists',
  CUSTOM_ALBUMS: 'muzika_custom_albums',
  SAVED_ARTISTS: 'muzika_saved_artists',
  SAVED_ALBUMS: 'muzika_saved_albums',
  RIPLAY_IMPORT_STATS: 'muzika_riplay_import_summary',
  LAST_PLAYBACK_STATE: 'muzika_last_playback_state',
  ENABLE_MULTIPLE_QUEUES: 'muzika_enable_multiple_queues',
  NAMED_QUEUES: 'muzika_named_queues',
  ACTIVE_QUEUE_ID: 'muzika_active_queue_id',
  LAST_DEFAULT_QUEUE_ID: 'muzika_last_default_queue_id',
  SONG_SYNC_OVERRIDES: 'muzika_song_sync_overrides',
  AUTO_RESUME_ON_CALL: 'muzika_auto_resume_on_call',
};

export const DEFAULT_EQUALIZER: EqualizerSettings = {
  enabled: false,
  preset: 'Flat',
  bands: {
    band60: 0,
    band230: 0,
    band910: 0,
    band3600: 0,
    band14000: 0,
  },
  bassBoost: 0,
};

export const DEFAULT_USER_STATS: UserStats = {
  totalMinutes: 0,
  totalPlays: 0,
  playHistory: [],
  songPlayCounts: {},
  artistPlayCounts: {},
  rankBadge: 'Bronze Newbie',
};

export class StorageService {
  static getLikedSongs(): Song[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LIKED_SONGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveLikedSongs(songs: Song[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getPlaylists(): Playlist[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static savePlaylists(playlists: Playlist[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getHistory(): Song[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveHistory(songs: Song[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(songs.slice(0, 50)));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getBlacklist(): { id: string; name: string; type: 'song' | 'artist' }[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BLACKLIST);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveBlacklist(items: { id: string; name: string; type: 'song' | 'artist' }[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.BLACKLIST, JSON.stringify(items));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getUserStats(): UserStats {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_STATS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return DEFAULT_USER_STATS;
  }

  static saveUserStats(stats: UserStats): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getEqualizer(): EqualizerSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EQUALIZER);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return DEFAULT_EQUALIZER;
  }

  static saveEqualizer(eq: EqualizerSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EQUALIZER, JSON.stringify(eq));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getTheme(): ThemeName {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.THEME);
      if (data) return data as ThemeName;
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return 'riplay';
  }

  static saveTheme(theme: ThemeName): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getLocalSongs(): Song[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_SONGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveLocalSongs(songs: Song[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_SONGS, JSON.stringify(songs));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getCustomArtists(): Artist[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_ARTISTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveCustomArtists(artists: Artist[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_ARTISTS, JSON.stringify(artists));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getCustomAlbums(): Album[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_ALBUMS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveCustomAlbums(albums: Album[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_ALBUMS, JSON.stringify(albums));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getSavedArtists(): Artist[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_ARTISTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveSavedArtists(artists: Artist[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_ARTISTS, JSON.stringify(artists));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getSavedAlbums(): Album[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVED_ALBUMS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return [];
  }

  static saveSavedAlbums(albums: Album[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_ALBUMS, JSON.stringify(albums));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getLastImportSummary(): any | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RIPLAY_IMPORT_STATS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error:', e);
    }
    return null;
  }

  static saveLastImportSummary(summary: any): void {
    try {
      const compact = summary
        ? {
            songsCount: summary.songsCount || 0,
            playlistsCount: summary.playlistsCount || 0,
            artistsCount: summary.artistsCount || 0,
            albumsCount: summary.albumsCount || 0,
            historyCount: summary.historyCount || 0,
            blacklistCount: summary.blacklistCount || 0,
            likedSongsCount: summary.likedSongsCount || 0,
            tablesFound: Array.isArray(summary.tablesFound) ? summary.tablesFound : [],
            importedAt: summary.importedAt || Date.now(),
          }
        : null;
      localStorage.setItem(STORAGE_KEYS.RIPLAY_IMPORT_STATS, JSON.stringify(compact));
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  }

  static getLastPlaybackState(): {
    song: Song;
    currentTime: number;
    duration: number;
    queueIndex: number;
    queue: Song[];
  } | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_PLAYBACK_STATE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Storage read error for playback state:', e);
    }
    return null;
  }

  static saveLastPlaybackState(state: {
    song: Song;
    currentTime: number;
    duration: number;
    queueIndex: number;
    queue: Song[];
  }): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_PLAYBACK_STATE, JSON.stringify(state));
    } catch (e) {
      // quota or private mode
    }
  }

  static clearLastPlaybackState(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.LAST_PLAYBACK_STATE);
    } catch {}
  }

  static getEnableMultipleQueues(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.ENABLE_MULTIPLE_QUEUES) === 'true';
    } catch {
      return false;
    }
  }

  static saveEnableMultipleQueues(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ENABLE_MULTIPLE_QUEUES, String(enabled));
    } catch {}
  }

  static getNamedQueues(): NamedQueue[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NAMED_QUEUES);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  }

  static saveNamedQueues(queues: NamedQueue[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NAMED_QUEUES, JSON.stringify(queues));
    } catch {}
  }

  static getActiveQueueId(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_QUEUE_ID) || 'queue-main';
    } catch {
      return 'queue-main';
    }
  }

  static saveActiveQueueId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, id);
    } catch {}
  }

  static getLastDefaultQueueId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_DEFAULT_QUEUE_ID);
    } catch {
      return null;
    }
  }

  static saveLastDefaultQueueId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_DEFAULT_QUEUE_ID, id);
    } catch {}
  }

  static getAutoResumeOnCall(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUTO_RESUME_ON_CALL);
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  }

  static saveAutoResumeOnCall(enabled: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_RESUME_ON_CALL, String(enabled));
    } catch {}
  }

  static getSongSyncOverrides(): Record<string, Song> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SONG_SYNC_OVERRIDES);
      if (data) return JSON.parse(data);
    } catch {}
    return {};
  }

  static saveSongSyncOverride(originalId: string, syncedSong: Song): void {
    try {
      const existing = this.getSongSyncOverrides();
      existing[originalId] = syncedSong;
      localStorage.setItem(STORAGE_KEYS.SONG_SYNC_OVERRIDES, JSON.stringify(existing));
    } catch {}
  }

  static applySongSyncOverride(song: Song): Song {
    const overrides = this.getSongSyncOverrides();
    const override = overrides[song.id];
    if (!override) return song;
    const merged: Song = {
      ...song,
      ...override,
      id: song.id,
      liked: song.liked ?? override.liked,
      playCount: song.playCount ?? override.playCount,
      addedAt: song.addedAt ?? override.addedAt,
    };
    if (override.source !== 'stream' && !override.streamUrl) {
      delete merged.streamUrl;
    }
    if (override.source === 'stream' && !override.youtubeId) {
      delete merged.youtubeId;
    }
    return merged;
  }

  // RiPlay Backup & Restore mechanism (Export & Import JSON)
  static exportBackup(): string {
    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      likedSongs: this.getLikedSongs(),
      playlists: this.getPlaylists(),
      history: this.getHistory(),
      userStats: this.getUserStats(),
      blacklist: this.getBlacklist(),
      theme: this.getTheme(),
      equalizer: this.getEqualizer(),
    };
    return JSON.stringify(backup, null, 2);
  }

  static importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.likedSongs) this.saveLikedSongs(data.likedSongs);
      if (data.playlists) this.savePlaylists(data.playlists);
      if (data.history) this.saveHistory(data.history);
      if (data.userStats) this.saveUserStats(data.userStats);
      if (data.blacklist) this.saveBlacklist(data.blacklist);
      if (data.theme) this.saveTheme(data.theme);
      if (data.equalizer) this.saveEqualizer(data.equalizer);
      return true;
    } catch (e) {
      console.error('Backup import error:', e);
      return false;
    }
  }
}
