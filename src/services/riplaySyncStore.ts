import { Song } from '../types/music';

const SYNC_DB_NAME = 'muzika_riplay_sync_db';
const SYNC_DB_VERSION = 1;
const STORE_META = 'riplay_sync_meta';
const BLUEPRINT_LS_KEY = 'muzika_riplay_blueprint_v1';

export interface RiplaySchemaItem {
  type: 'table' | 'index';
  name: string;
  sql: string;
}

export interface RiplaySchemaBlueprint {
  userVersion: number;
  roomIdentityHash?: string;
  schemaItems: RiplaySchemaItem[];
  tablesFound: string[];
  savedAt: number;
}

export interface RiplaySyncCatalogSnapshot {
  songs: Song[];
  lyricsMap: Record<string, { fixed?: string; synced?: string }>;
  updatedAt: number;
}

class RiplaySyncStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB unavailable'));
      }
      const req = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          this.dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error);
      };
    });

    return this.dbPromise;
  }

  private async putValue(key: string, value: any): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.objectStore(STORE_META).put({ key, value });
      });
    } catch {
      // Ignore IDB failures gracefully
    }
  }

  private async getValue<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      return await new Promise<T | null>((resolve) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(key);
        req.onsuccess = () => resolve((req.result?.value as T) || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async saveSchemaBlueprint(blueprint: RiplaySchemaBlueprint): Promise<void> {
    // Mirror compact Room DDL + identity hash to localStorage as well so it survives OS cache sweeps
    try {
      localStorage.setItem(BLUEPRINT_LS_KEY, JSON.stringify(blueprint));
    } catch {}
    await this.putValue('blueprint', blueprint);
  }

  async getSchemaBlueprint(): Promise<RiplaySchemaBlueprint | null> {
    const fromIdb = await this.getValue<RiplaySchemaBlueprint>('blueprint');
    if (fromIdb) return fromIdb;
    try {
      const raw = localStorage.getItem(BLUEPRINT_LS_KEY);
      if (raw) return JSON.parse(raw) as RiplaySchemaBlueprint;
    } catch {}
    return null;
  }

  async saveCatalogSnapshot(
    newSongs: Song[],
    newLyrics: Record<string, { fixed?: string; synced?: string }>
  ): Promise<void> {
    const existing = await this.getCatalogSnapshot();
    const songMap = new Map<string, Song>();

    if (existing?.songs) {
      for (const s of existing.songs) {
        songMap.set(s.id, s);
      }
    }
    for (const s of newSongs) {
      const prev = songMap.get(s.id);
      songMap.set(s.id, {
        ...(prev || {}),
        ...s,
        // Strip inline lyrics in catalog snapshot (stored deduplicated in lyricsMap)
        lyrics: undefined,
        playCount: Math.max(prev?.playCount || 0, s.playCount || 0),
        totalPlayTimeMs: Math.max(prev?.totalPlayTimeMs || 0, s.totalPlayTimeMs || 0),
      });
    }

    const mergedLyrics: Record<string, { fixed?: string; synced?: string }> = {
      ...(existing?.lyricsMap || {}),
      ...newLyrics,
    };

    await this.putValue('catalog', {
      songs: Array.from(songMap.values()),
      lyricsMap: mergedLyrics,
      updatedAt: Date.now(),
    } satisfies RiplaySyncCatalogSnapshot);
  }

  async getCatalogSnapshot(): Promise<RiplaySyncCatalogSnapshot | null> {
    return this.getValue<RiplaySyncCatalogSnapshot>('catalog');
  }

  async saveAlbumTracks(albumId: string, songs: Song[]): Promise<void> {
    if (!albumId || !songs || songs.length === 0) return;
    const existing = (await this.getValue<Record<string, Song[]>>('album_tracks_v1')) || {};
    existing[albumId] = songs;
    await this.putValue('album_tracks_v1', existing);
  }

  async saveAlbumTracksBatch(entries: { id: string; songs: Song[] }[]): Promise<void> {
    const valid = entries.filter((e) => e.id && e.songs && e.songs.length > 0);
    if (valid.length === 0) return;
    const existing = (await this.getValue<Record<string, Song[]>>('album_tracks_v1')) || {};
    for (const item of valid) {
      existing[item.id] = item.songs;
    }
    await this.putValue('album_tracks_v1', existing);
  }

  async getAlbumTracks(albumId: string): Promise<Song[] | null> {
    if (!albumId) return null;
    const map = await this.getValue<Record<string, Song[]>>('album_tracks_v1');
    return map?.[albumId] || null;
  }

  async getAllAlbumTracks(): Promise<Record<string, Song[]>> {
    return (await this.getValue<Record<string, Song[]>>('album_tracks_v1')) || {};
  }

  async saveArtistTracks(
    artistId: string,
    data: { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }
  ): Promise<void> {
    if (!artistId || !data?.topSongs || data.topSongs.length === 0) return;
    const existing =
      (await this.getValue<
        Record<string, { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }>
      >('artist_tracks_v1')) || {};
    existing[artistId] = {
      ...(existing[artistId] || {}),
      ...data,
    };
    await this.putValue('artist_tracks_v1', existing);
  }

  async saveArtistTracksBatch(
    entries: { id: string; topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }[]
  ): Promise<void> {
    const valid = entries.filter((e) => e.id && e.topSongs && e.topSongs.length > 0);
    if (valid.length === 0) return;
    const existing =
      (await this.getValue<
        Record<string, { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }>
      >('artist_tracks_v1')) || {};
    for (const item of valid) {
      existing[item.id] = {
        ...(existing[item.id] || {}),
        topSongs: item.topSongs,
        bannerUrl: item.bannerUrl || existing[item.id]?.bannerUrl,
        subscribers: item.subscribers || existing[item.id]?.subscribers,
        bio: item.bio || existing[item.id]?.bio,
      };
    }
    await this.putValue('artist_tracks_v1', existing);
  }

  async getArtistTracks(
    artistId: string
  ): Promise<{ topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string } | null> {
    if (!artistId) return null;
    const map = await this.getValue<
      Record<string, { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }>
    >('artist_tracks_v1');
    return map?.[artistId] || null;
  }

  async getAllArtistTracks(): Promise<
    Record<string, { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }>
  > {
    return (
      (await this.getValue<
        Record<string, { topSongs: Song[]; bannerUrl?: string; subscribers?: string; bio?: string }>
      >('artist_tracks_v1')) || {}
    );
  }
}

export const riplaySyncStore = new RiplaySyncStore();
