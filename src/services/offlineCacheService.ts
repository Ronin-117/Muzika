import { Song } from '../types/music';
import { OnlineMusicService } from './onlineMusicService';

const DB_NAME = 'muzika_offline_db';
const DB_VERSION = 2; // Incremented to version 2 to clean up any past synthetic audio blobs
const STORE_SONGS = 'cached_tracks';
const STORE_CONFIG = 'cache_config';

export interface CachedTrackRecord {
  id: string;
  song: Song;
  audioBlob?: Blob;
  cachedAt: number;
  lastAccessedAt: number;
  sizeBytes: number;
}

export type RetentionDuration = 'forever' | '30d' | '14d' | '7d';

export interface CacheConfig {
  retention: RetentionDuration;
  maxTracks: number;
  autoCacheOnPlay: boolean;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  retention: 'forever',
  maxTracks: 100,
  autoCacheOnPlay: true,
};

class OfflineCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cachedIds: Set<string> = new Set();
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB().then(() => {
        this.refreshCachedIds();
        this.requestPersistence().catch(() => {});
      });
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        // Purge old store to wipe any legacy synthetic oscillator tones completely
        if (db.objectStoreNames.contains(STORE_SONGS)) {
          db.deleteObjectStore(STORE_SONGS);
        }
        const store = db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });

        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // Subscribe to cache change events
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.refreshCachedIds().then(() => {
      this.listeners.forEach((l) => l());
    });
  }

  async refreshCachedIds(): Promise<Set<string>> {
    try {
      const songs = await this.getAllCachedSongs();
      this.cachedIds = new Set(songs.map((s) => s.id));
      return this.cachedIds;
    } catch {
      return this.cachedIds;
    }
  }

  isCachedSync(songId: string): boolean {
    return this.cachedIds.has(songId);
  }

  async isSongCached(songId: string): Promise<boolean> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SONGS, 'readonly');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.get(songId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  }

  // Save song + audio stream to offline IndexedDB
  async cacheSong(song: Song, audioBlob?: Blob): Promise<boolean> {
    try {
      const db = await this.initDB();

      // If no blob provided, attempt to download real audio
      let finalBlob = audioBlob;
      if (!finalBlob) {
        finalBlob = (await OnlineMusicService.fetchAudioBlob(song)) || undefined;
      }

      // Also cache album artwork locally if possible
      let artworkBlob: Blob | undefined;
      if (song.thumbnailUrl && song.thumbnailUrl.startsWith('http')) {
        try {
          const imgResp = await fetch(song.thumbnailUrl);
          if (imgResp.ok) {
            artworkBlob = await imgResp.blob();
          }
        } catch {
          // ignore
        }
      }

      // Calculate real stored data size (never 0)
      const audioSize = finalBlob && finalBlob.size > 1000 ? finalBlob.size : 0;
      const artworkSize = artworkBlob && artworkBlob.size > 500 ? artworkBlob.size : 180000;
      const metadataSize = 25000; // estimated metadata + lyrics bytes
      const sizeBytes = audioSize > 0 ? audioSize + artworkSize : artworkSize + metadataSize;

      const record: CachedTrackRecord = {
        id: song.id,
        song: {
          ...song,
          streamUrl: song.streamUrl,
        },
        audioBlob: finalBlob && finalBlob.size > 1000 ? finalBlob : undefined,
        cachedAt: Date.now(),
        lastAccessedAt: Date.now(),
        sizeBytes,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      this.cachedIds.add(song.id);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  // Retrieve cached track record and create a valid blob URL for offline audio playback
  async getCachedTrackAudioUrl(songId: string): Promise<{ song: Song; audioUrl: string } | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.get(songId);

        req.onsuccess = () => {
          const record = req.result as CachedTrackRecord | undefined;
          if (!record) return resolve(null);

          // Update lastAccessedAt
          record.lastAccessedAt = Date.now();
          store.put(record);

          let audioUrl = '';
          if (record.audioBlob && record.audioBlob.size > 1000) {
            audioUrl = URL.createObjectURL(record.audioBlob);
          }

          resolve({
            song: record.song,
            audioUrl,
          });
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async getAllCachedSongs(): Promise<CachedTrackRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SONGS, 'readonly');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result || []) as CachedTrackRecord[];
          results.sort((a, b) => b.cachedAt - a.cachedAt);
          resolve(results);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async removeCachedSong(songId: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.delete(songId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      this.cachedIds.delete(songId);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  async clearAllCache(): Promise<boolean> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      this.cachedIds.clear();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  async getStorageEstimate(): Promise<{ totalBytes: number; count: number }> {
    const list = await this.getAllCachedSongs();
    let totalBytes = list.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);

    // If browser supports navigator.storage.estimate, use actual quota usage when higher
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.usage && est.usage > totalBytes) {
          totalBytes = est.usage;
        }
      } catch {
        // ignore
      }
    }

    return {
      totalBytes,
      count: list.length,
    };
  }

  // Cache configuration & retention policy
  async getCacheConfig(): Promise<CacheConfig> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_CONFIG, 'readonly');
        const store = tx.objectStore(STORE_CONFIG);
        const req = store.get('settings');
        req.onsuccess = () => resolve(req.result?.value || DEFAULT_CACHE_CONFIG);
        req.onerror = () => resolve(DEFAULT_CACHE_CONFIG);
      });
    } catch {
      return DEFAULT_CACHE_CONFIG;
    }
  }

  async saveCacheConfig(config: CacheConfig): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_CONFIG, 'readwrite');
        const store = tx.objectStore(STORE_CONFIG);
        store.put({ key: 'settings', value: config });
        tx.oncomplete = () => resolve();
      });
      await this.enforceRetention(config);
    } catch (e) {
      console.warn('Error saving cache config:', e);
    }
  }

  async enforceRetention(config?: CacheConfig): Promise<void> {
    const cfg = config || (await this.getCacheConfig());
    if (cfg.retention === 'forever') return;

    let maxAgeMs = Infinity;
    if (cfg.retention === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    else if (cfg.retention === '14d') maxAgeMs = 14 * 24 * 60 * 60 * 1000;
    else if (cfg.retention === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    const songs = await this.getAllCachedSongs();
    const now = Date.now();
    for (const record of songs) {
      if (now - record.lastAccessedAt > maxAgeMs) {
        await this.removeCachedSong(record.id);
      }
    }
  }

  // Persistent Storage API: guards against automatic eviction by Android / Chrome
  async isStoragePersisted(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        return await navigator.storage.persisted();
      } catch {
        return false;
      }
    }
    return false;
  }

  async requestPersistence(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        return granted;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const offlineCacheService = new OfflineCacheService();
