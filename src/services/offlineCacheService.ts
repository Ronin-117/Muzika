import { Song } from '../types/music';
import { OnlineMusicService } from './onlineMusicService';

const DB_NAME = 'muzika_offline_db';
const DB_VERSION = 2;
const STORE_SONGS = 'cached_tracks';
const STORE_CONFIG = 'cache_config';

const MANIFEST_STORAGE_KEY = 'muzika_cached_manifest_v1';
const CONFIG_STORAGE_KEY = 'muzika_cache_config_v1';
const LEGACY_MEDIA_CACHE_KEY = 'muzika-media-v1';

export interface CachedTrackRecord {
  id: string;
  song: Song;
  audioBlob?: Blob;
  artworkBlob?: Blob;
  cachedAt: number;
  lastAccessedAt: number;
  sizeBytes: number;
}

interface CachedManifestEntry {
  id: string;
  cachedAt: number;
  song: Song;
}

export interface CacheRestoreEvent {
  phase: 'start' | 'progress' | 'done';
  total: number;
  completed: number;
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

function sanitizeSongMetadata(song: Song, fallbackThumb?: string): Song {
  let thumbnailUrl = song.thumbnailUrl;
  if (!thumbnailUrl || thumbnailUrl.startsWith('blob:') || thumbnailUrl.startsWith('data:')) {
    if (fallbackThumb && fallbackThumb.startsWith('http')) {
      thumbnailUrl = fallbackThumb;
    } else {
      const vidId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : '');
      if (vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
        thumbnailUrl = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
      } else {
        thumbnailUrl = '';
      }
    }
  }

  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    thumbnailUrl,
    youtubeId: song.youtubeId,
    source: song.source,
    artistId: song.artistId,
    albumId: song.albumId,
  };
}

class OfflineCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cachedIds: Set<string> = new Set();
  private cachingIds: Set<string> = new Set();
  private inFlightCaches: Map<string, Promise<boolean>> = new Map();
  private coverUrlCache: Map<string, string> = new Map();
  private listeners: (() => void)[] = [];
  private cachingListeners: ((ids: Set<string>) => void)[] = [];
  private restoreListeners: ((event: CacheRestoreEvent) => void)[] = [];

  private intentionallyRemovedIds: Set<string> = new Set();
  private restoreAttemptedSessionIds: Set<string> = new Set();
  private lastRestoreAttemptAt = 0;
  private restoreInFlight: Promise<number> | null = null;
  private persistenceRequestedThisSession = false;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB()
        .then(async () => {
          await this.refreshCachedIds();
          this.requestPersistence().catch(() => {});
          setTimeout(() => {
            this.restoreMissingTracksFromManifest().catch(() => {});
            this.autoRepairCorruptedTracks().catch(() => {});
            this.backfillMissingCovers().catch(() => {});
          }, 2500);
        })
        .catch(() => {});

      window.addEventListener('online', () => {
        if (Date.now() - this.lastRestoreAttemptAt > 60_000) {
          this.restoreAttemptedSessionIds.clear();
        }
        setTimeout(() => {
          this.restoreMissingTracksFromManifest().catch(() => {});
          this.autoRepairCorruptedTracks().catch(() => {});
          this.backfillMissingCovers().catch(() => {});
        }, 1200);
      });
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        // Only migrate legacy v1 stores (pre-real-audio-blob schema); preserve v2+ records
        if (e.oldVersion > 0 && e.oldVersion < 2 && db.objectStoreNames.contains(STORE_SONGS)) {
          db.deleteObjectStore(STORE_SONGS);
        }
        if (!db.objectStoreNames.contains(STORE_SONGS)) {
          const store = db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          this.dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // ---- Durable localStorage Manifest (survives OS/browser Quota/IndexedDB sweeps) ----

  private readManifest(): Record<string, CachedManifestEntry> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(MANIFEST_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, CachedManifestEntry>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private writeManifest(manifest: Record<string, CachedManifestEntry>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
    } catch {
      // Ignore Safari private mode or localStorage quota edge errors
    }
  }

  private upsertManifestEntry(song: Song, cachedAt: number): void {
    if (!song?.id || song.source === 'local' || song.id.startsWith('local-')) return;
    const manifest = this.readManifest();
    const prevThumb = manifest[song.id]?.song?.thumbnailUrl;
    manifest[song.id] = {
      id: song.id,
      cachedAt: manifest[song.id]?.cachedAt || cachedAt || Date.now(),
      song: sanitizeSongMetadata(song, prevThumb),
    };
    this.writeManifest(manifest);
  }

  private removeManifestEntry(songId: string): void {
    const manifest = this.readManifest();
    if (songId in manifest) {
      delete manifest[songId];
      this.writeManifest(manifest);
    }
  }

  private clearManifest(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(MANIFEST_STORAGE_KEY);
    } catch {}
  }

  private syncManifestWithRecords(records: CachedTrackRecord[]): void {
    if (records.length === 0) return;
    const manifest = this.readManifest();
    let changed = false;
    for (const rec of records) {
      if (!rec.audioBlob || rec.audioBlob.size <= 1000) continue;
      if (rec.song?.source === 'local' || rec.id.startsWith('local-')) continue;
      if (!manifest[rec.id]) {
        manifest[rec.id] = {
          id: rec.id,
          cachedAt: rec.cachedAt || Date.now(),
          song: sanitizeSongMetadata(rec.song),
        };
        changed = true;
      }
    }
    if (changed) {
      this.writeManifest(manifest);
    }
  }

  private readConfigMirror(): CacheConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CacheConfig>;
      if (parsed && typeof parsed === 'object' && parsed.retention) {
        return {
          retention: parsed.retention,
          maxTracks: typeof parsed.maxTracks === 'number' ? parsed.maxTracks : DEFAULT_CACHE_CONFIG.maxTracks,
          autoCacheOnPlay:
            typeof parsed.autoCacheOnPlay === 'boolean'
              ? parsed.autoCacheOnPlay
              : DEFAULT_CACHE_CONFIG.autoCacheOnPlay,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private writeConfigMirror(config: CacheConfig): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }

  // ---- Subscriptions ----

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  subscribeCaching(listener: (ids: Set<string>) => void) {
    this.cachingListeners.push(listener);
    return () => {
      this.cachingListeners = this.cachingListeners.filter((l) => l !== listener);
    };
  }

  subscribeRestore(listener: (event: CacheRestoreEvent) => void) {
    this.restoreListeners.push(listener);
    return () => {
      this.restoreListeners = this.restoreListeners.filter((l) => l !== listener);
    };
  }

  private notifyCaching() {
    const snapshot = new Set(this.cachingIds);
    this.cachingListeners.forEach((l) => l(snapshot));
  }

  private notifyRestore(event: CacheRestoreEvent) {
    this.restoreListeners.forEach((l) => l(event));
  }

  getCachingIdsSnapshot(): Set<string> {
    return new Set(this.cachingIds);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async refreshCachedIds(): Promise<Set<string>> {
    try {
      const songs = await this.getAllCachedSongs();
      const valid = songs.filter((s) => s.audioBlob && s.audioBlob.size > 1000);
      this.cachedIds = new Set(valid.map((s) => s.id));
      this.syncManifestWithRecords(valid);
      return this.cachedIds;
    } catch {
      return this.cachedIds;
    }
  }

  isCachedSync(songId: string): boolean {
    return this.cachedIds.has(songId);
  }

  isCachingSync(songId: string): boolean {
    return this.cachingIds.has(songId);
  }

  clearIntentionallyRemoved(songId: string): void {
    this.intentionallyRemovedIds.delete(songId);
  }

  getCachedCoverUrl(songId: string): string | undefined {
    return this.coverUrlCache.get(songId);
  }

  async getCachedCoverBlob(songId: string): Promise<Blob | undefined> {
    if (!songId) return undefined;
    try {
      const db = await this.initDB();
      return await new Promise<Blob | undefined>((resolve) => {
        const tx = db.transaction(STORE_SONGS, 'readonly');
        const req = tx.objectStore(STORE_SONGS).get(songId);
        req.onsuccess = () => {
          const rec = req.result as CachedTrackRecord | undefined;
          resolve(rec?.artworkBlob && rec.artworkBlob.size > 200 ? rec.artworkBlob : undefined);
        };
        req.onerror = () => resolve(undefined);
      });
    } catch {
      return undefined;
    }
  }

  private ensureCoverUrl(songId: string, artworkBlob?: Blob): string | undefined {
    const existing = this.coverUrlCache.get(songId);
    if (existing) return existing;
    if (artworkBlob && artworkBlob.size > 200) {
      try {
        const url = URL.createObjectURL(artworkBlob);
        this.coverUrlCache.set(songId, url);
        return url;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private revokeCoverUrl(songId: string) {
    const existing = this.coverUrlCache.get(songId);
    if (existing) {
      try {
        URL.revokeObjectURL(existing);
      } catch {}
      this.coverUrlCache.delete(songId);
    }
  }

  private async fetchCoverBlob(song: Song): Promise<Blob | undefined> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return undefined;
    const candidates: string[] = [];
    if (song.thumbnailUrl && song.thumbnailUrl.startsWith('http')) {
      candidates.push(song.thumbnailUrl);
    }
    const vidId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : '');
    if (vidId && !vidId.startsWith('online-') && !vidId.startsWith('local-')) {
      const ytThumb = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
      if (!candidates.includes(ytThumb)) candidates.push(ytThumb);
    }

    for (const imgUrl of candidates) {
      const imgCtrl = new AbortController();
      const imgTimer = setTimeout(() => imgCtrl.abort(), 6000);
      try {
        const imgResp = await fetch(imgUrl, { mode: 'cors', signal: imgCtrl.signal });
        if (imgResp.ok) {
          const blob = await imgResp.blob();
          const mime = (blob.type || imgResp.headers.get('content-type') || '').toLowerCase();
          if (blob.size > 200 && (!mime || mime.startsWith('image/'))) {
            return blob;
          }
        }
      } catch {
        // try next artwork candidate
      } finally {
        clearTimeout(imgTimer);
      }
    }
    return undefined;
  }

  async isSongCached(songId: string): Promise<boolean> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SONGS, 'readonly');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.get(songId);
      req.onsuccess = () => {
        const rec = req.result as CachedTrackRecord | undefined;
        resolve(!!(rec && rec.audioBlob && rec.audioBlob.size > 1000));
      };
      req.onerror = () => resolve(false);
    });
  }

  // Save song + audio stream to offline IndexedDB (deduplicated per song ID)
  async cacheSong(song: Song, audioBlob?: Blob, isBackgroundRestore = false): Promise<boolean> {
    if (!isBackgroundRestore) {
      this.intentionallyRemovedIds.delete(song.id);
    } else if (this.intentionallyRemovedIds.has(song.id)) {
      return false;
    }

    const existingFlight = this.inFlightCaches.get(song.id);
    if (existingFlight && !audioBlob) {
      return existingFlight;
    }

    const run = this._cacheSongInternal(song, audioBlob, isBackgroundRestore).finally(() => {
      this.inFlightCaches.delete(song.id);
      this.cachingIds.delete(song.id);
      this.notifyCaching();
    });

    this.cachingIds.add(song.id);
    this.notifyCaching();
    this.inFlightCaches.set(song.id, run);
    return run;
  }

  private async _cacheSongInternal(
    song: Song,
    audioBlob?: Blob,
    isBackgroundRestore = false
  ): Promise<boolean> {
    try {
      const db = await this.initDB();

      const existingRecord = await new Promise<CachedTrackRecord | undefined>((resolve) => {
        const tx = db.transaction(STORE_SONGS, 'readonly');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.get(song.id);
        req.onsuccess = () => resolve(req.result as CachedTrackRecord | undefined);
        req.onerror = () => resolve(undefined);
      });

      let finalBlob: Blob | undefined = audioBlob && audioBlob.size > 1000 ? audioBlob : undefined;

      if (!finalBlob && existingRecord?.audioBlob && existingRecord.audioBlob.size > 1000) {
        finalBlob = existingRecord.audioBlob;
      }

      if (!finalBlob) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return false;
        }

        const controller = new AbortController();
        const dlTimer = setTimeout(() => controller.abort(), 50000);
        try {
          const downloaded = await OnlineMusicService.fetchAudioBlob(song, controller.signal);
          if (downloaded && downloaded.size > 1000) {
            finalBlob = downloaded;
          }
        } catch {
          // download failed or timed out
        } finally {
          clearTimeout(dlTimer);
        }
      }

      if (!finalBlob || finalBlob.size <= 1000) {
        if (existingRecord?.audioBlob && existingRecord.audioBlob.size > 1000) {
          finalBlob = existingRecord.audioBlob;
        } else {
          return false;
        }
      }

      // Abort save if user explicitly deleted this track while download was in flight
      if (isBackgroundRestore && this.intentionallyRemovedIds.has(song.id)) {
        return false;
      }

      let artworkBlob: Blob | undefined =
        existingRecord?.artworkBlob && existingRecord.artworkBlob.size > 200
          ? existingRecord.artworkBlob
          : undefined;
      if (!artworkBlob) {
        artworkBlob = await this.fetchCoverBlob(song);
      }

      if (isBackgroundRestore && this.intentionallyRemovedIds.has(song.id)) {
        return false;
      }

      const audioSize = finalBlob.size;
      const artworkSize = artworkBlob && artworkBlob.size > 200 ? artworkBlob.size : 0;
      const sizeBytes = audioSize + artworkSize;

      const manifest = this.readManifest();
      const preservedThumb = existingRecord?.song?.thumbnailUrl || manifest[song.id]?.song?.thumbnailUrl;
      const sanitizedSong = sanitizeSongMetadata(song, preservedThumb);
      const cachedAt = existingRecord?.cachedAt || manifest[song.id]?.cachedAt || Date.now();

      const record: CachedTrackRecord = {
        id: song.id,
        song: {
          ...sanitizedSong,
          streamUrl: song.streamUrl || existingRecord?.song?.streamUrl,
        },
        audioBlob: finalBlob,
        artworkBlob,
        cachedAt,
        lastAccessedAt: Date.now(),
        sizeBytes,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
        const req = store.put(record);
        req.onerror = () => reject(req.error);
      });

      this.upsertManifestEntry(sanitizedSong, cachedAt);
      this.ensureCoverUrl(song.id, artworkBlob);
      this.cachedIds.add(song.id);
      this.notify();

      // Re-assert persistent storage upon real offline write (boosts iOS 17+ & Android Chromium grant)
      if (!this.persistenceRequestedThisSession) {
        this.persistenceRequestedThisSession = true;
        this.requestPersistence().catch(() => {});
      }

      return true;
    } catch {
      return false;
    }
  }

  // Retrieve cached track record and create valid blob URLs for offline audio & cover playback
  async getCachedTrackAudioUrl(
    songId: string
  ): Promise<{ song: Song; audioUrl: string; coverUrl?: string } | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SONGS, 'readonly');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.get(songId);

        req.onsuccess = () => {
          const record = req.result as CachedTrackRecord | undefined;
          if (!record) return resolve(null);

          if (!record.audioBlob || record.audioBlob.size <= 1000) {
            if (typeof navigator !== 'undefined' && navigator.onLine) {
              this.cacheSong(record.song).catch(() => {});
            }
            return resolve(null);
          }

          let audioUrl = '';
          try {
            audioUrl = URL.createObjectURL(record.audioBlob);
          } catch {
            return resolve(null);
          }

          const coverUrl = this.ensureCoverUrl(songId, record.artworkBlob);
          const hydratedSong = coverUrl
            ? { ...record.song, thumbnailUrl: coverUrl }
            : record.song;

          resolve({
            song: hydratedSong,
            audioUrl,
            coverUrl,
          });
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // Automatically recovers cached tracks if IndexedDB was swept by Android/iOS OS or browser cleaner
  async restoreMissingTracksFromManifest(): Promise<number> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
    if (this.restoreInFlight) return this.restoreInFlight;

    this.restoreInFlight = (async () => {
      try {
        this.lastRestoreAttemptAt = Date.now();
        const manifest = this.readManifest();
        const entries = Object.values(manifest);
        if (entries.length === 0) return 0;

        // Prune manifest entries that would already be expired under current retention policy
        const config = await this.getCacheConfig();
        let maxAgeMs = Infinity;
        if (config.retention === '7d') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        else if (config.retention === '14d') maxAgeMs = 14 * 24 * 60 * 60 * 1000;
        else if (config.retention === '30d') maxAgeMs = 30 * 24 * 60 * 60 * 1000;

        const now = Date.now();
        let manifestChanged = false;
        if (Number.isFinite(maxAgeMs)) {
          for (const entry of entries) {
            if (now - entry.cachedAt > maxAgeMs) {
              delete manifest[entry.id];
              manifestChanged = true;
            }
          }
          if (manifestChanged) {
            this.writeManifest(manifest);
          }
        }

        const existingSongs = await this.getAllCachedSongs();
        const validIdSet = new Set(
          existingSongs.filter((s) => s.audioBlob && s.audioBlob.size > 1000).map((s) => s.id)
        );

        const missing = Object.values(manifest)
          .filter(
            (entry) =>
              entry?.id &&
              entry.song &&
              entry.song.source !== 'local' &&
              !entry.id.startsWith('local-') &&
              !validIdSet.has(entry.id) &&
              !this.intentionallyRemovedIds.has(entry.id) &&
              !this.restoreAttemptedSessionIds.has(entry.id)
          )
          .sort((a, b) => b.cachedAt - a.cachedAt);

        if (missing.length === 0) return 0;

        for (const entry of missing) {
          this.restoreAttemptedSessionIds.add(entry.id);
        }

        this.notifyRestore({ phase: 'start', total: missing.length, completed: 0 });

        let cursor = 0;
        let completed = 0;
        const worker = async () => {
          while (cursor < missing.length) {
            if (typeof navigator !== 'undefined' && !navigator.onLine) break;
            const entry = missing[cursor++];
            if (!entry || this.intentionallyRemovedIds.has(entry.id)) continue;
            const ok = await this.cacheSong(entry.song, undefined, true).catch(() => false);
            if (ok) {
              completed++;
              this.notifyRestore({ phase: 'progress', total: missing.length, completed });
            }
          }
        };

        await Promise.all([worker(), worker()]);

        this.notifyRestore({ phase: 'done', total: missing.length, completed });
        return completed;
      } catch {
        return 0;
      } finally {
        this.restoreInFlight = null;
      }
    })();

    return this.restoreInFlight;
  }

  // Detects any legacy hollow 0.2MB tracks and re-caches real audio in background when online
  async autoRepairCorruptedTracks(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const all = await this.getAllCachedSongs();
      const corrupted = all.filter((r) => !r.audioBlob || r.audioBlob.size <= 1000);
      if (corrupted.length === 0) return;

      for (const item of corrupted.slice(0, 3)) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        if (this.inFlightCaches.has(item.song.id)) continue;
        try {
          await this.cacheSong(item.song);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // Backfills missing artworkBlob for tracks cached prior to offline cover support
  async backfillMissingCovers(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const all = await this.getAllCachedSongs();
      const missingCovers = all.filter(
        (r) => r.audioBlob && r.audioBlob.size > 1000 && (!r.artworkBlob || r.artworkBlob.size <= 200)
      );
      if (missingCovers.length === 0) return;

      const db = await this.initDB();
      let updatedAny = false;
      for (const item of missingCovers.slice(0, 8)) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        const artworkBlob = await this.fetchCoverBlob(item.song);
        if (!artworkBlob) continue;
        const updatedRecord: CachedTrackRecord = {
          ...item,
          artworkBlob,
          sizeBytes: (item.audioBlob?.size || 0) + artworkBlob.size,
        };
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_SONGS, 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
          tx.objectStore(STORE_SONGS).put(updatedRecord);
        }).catch(() => {});
        this.ensureCoverUrl(item.id, artworkBlob);
        updatedAny = true;
      }
      if (updatedAny) {
        this.notify();
      }
    } catch {
      // ignore
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
          for (const rec of results) {
            if (rec.artworkBlob) {
              this.ensureCoverUrl(rec.id, rec.artworkBlob);
            }
          }
          resolve(results);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async removeCachedSong(songId: string): Promise<boolean> {
    this.intentionallyRemovedIds.add(songId);
    this.removeManifestEntry(songId);

    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.delete(songId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      this.revokeCoverUrl(songId);
      this.cachedIds.delete(songId);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  async clearAllCache(): Promise<boolean> {
    for (const id of this.cachedIds) {
      this.intentionallyRemovedIds.add(id);
    }
    for (const id of Object.keys(this.readManifest())) {
      this.intentionallyRemovedIds.add(id);
    }
    this.clearManifest();

    try {
      if (typeof caches !== 'undefined') {
        caches.delete(LEGACY_MEDIA_CACHE_KEY).catch(() => false);
      }

      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SONGS, 'readwrite');
        const store = tx.objectStore(STORE_SONGS);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      for (const songId of Array.from(this.coverUrlCache.keys())) {
        this.revokeCoverUrl(songId);
      }
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

  // Cache configuration & retention policy (with localStorage mirror recovery)
  async getCacheConfig(): Promise<CacheConfig> {
    try {
      const db = await this.initDB();
      const fromDb = await new Promise<CacheConfig | null>((resolve) => {
        const tx = db.transaction(STORE_CONFIG, 'readonly');
        const store = tx.objectStore(STORE_CONFIG);
        const req = store.get('settings');
        req.onsuccess = () => resolve((req.result?.value as CacheConfig | undefined) || null);
        req.onerror = () => resolve(null);
      });

      if (fromDb) {
        this.writeConfigMirror(fromDb);
        return fromDb;
      }

      const mirrored = this.readConfigMirror();
      if (mirrored) {
        // Rehydrate wiped IDB config from localStorage mirror
        const tx = db.transaction(STORE_CONFIG, 'readwrite');
        tx.objectStore(STORE_CONFIG).put({ key: 'settings', value: mirrored });
        return mirrored;
      }

      return DEFAULT_CACHE_CONFIG;
    } catch {
      return this.readConfigMirror() || DEFAULT_CACHE_CONFIG;
    }
  }

  async saveCacheConfig(config: CacheConfig): Promise<void> {
    this.writeConfigMirror(config);
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

  // Persistent Storage API: guards against automatic eviction by Android / iOS / Desktop browsers
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
