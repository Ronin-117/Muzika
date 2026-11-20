import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Song, Playlist, Artist, Album, UserStats } from '../types/music';
import {
  riplaySyncStore,
  RiplaySchemaBlueprint,
  RiplaySchemaItem,
} from './riplaySyncStore';

export interface RiplayImportSummary {
  songsCount: number;
  playlistsCount: number;
  artistsCount: number;
  albumsCount: number;
  historyCount: number;
  blacklistCount: number;
  likedSongsCount: number;
  lyricsCount?: number;
  tablesFound: string[];
  importedPlaylists: Playlist[];
  importedSongs: Song[];
  importedLikedSongs: Song[];
  importedHistory: Song[];
  importedArtists: Artist[];
  importedAlbums: Album[];
  importedBlacklist: { id: string; name: string; type: 'song' | 'artist' }[];
  rawLyricsMap?: Record<string, { fixed?: string; synced?: string }>;
  logs?: string[];
  importedAt?: number;
}

export interface RiplayExportPayload {
  playlists: Playlist[];
  likedSongs: Song[];
  history: Song[];
  blacklist: { id: string; name: string; type: 'song' | 'artist' }[];
  importedArtists: Artist[];
  savedArtists: Artist[];
  importedAlbums: Album[];
  savedAlbums: Album[];
  userStats: UserStats;
  queue?: Song[];
}

export interface RiplayExportResult {
  buffer: Uint8Array;
  fileName: string;
  songsCount: number;
  playlistsCount: number;
  artistsCount: number;
  albumsCount: number;
  lyricsCount: number;
  eventsCount: number;
  blacklistCount: number;
  usedBlueprint: boolean;
  logs: string[];
}

let sqlInstancePromise: Promise<any> | null = null;

async function getSqlJs(onLog?: (msg: string) => void) {
  if (!sqlInstancePromise) {
    sqlInstancePromise = (async () => {
      try {
        onLog?.('Loading SQLite WebAssembly (strategy 1: bundled asset)...');
        return await initSqlJs({
          locateFile: () => sqlWasmUrl,
        });
      } catch (err1) {
        onLog?.(`WASM strategy 1 failed: ${String((err1 as any)?.message || err1)}`);
      }

      try {
        const originUrl = new URL('/sql-wasm.wasm', window.location.origin).href;
        onLog?.(`Loading SQLite WebAssembly (strategy 2: ${originUrl})...`);
        return await initSqlJs({
          locateFile: () => originUrl,
        });
      } catch (err2) {
        onLog?.(`WASM strategy 2 failed: ${String((err2 as any)?.message || err2)}`);
      }

      try {
        const relativeUrl = new URL('sql-wasm.wasm', window.location.href).href;
        onLog?.(`Loading SQLite WebAssembly (strategy 3: ${relativeUrl})...`);
        return await initSqlJs({
          locateFile: () => relativeUrl,
        });
      } catch (err3) {
        onLog?.(`WASM strategy 3 failed: ${String((err3 as any)?.message || err3)}`);
      }

      onLog?.('Loading SQLite WebAssembly (strategy 4: root fallback)...');
      return await initSqlJs({
        locateFile: (file: string) => `/${file}`,
      });
    })();
  }
  return sqlInstancePromise;
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function parseDurationText(
  durationText?: string | null,
  durationMs?: number | null,
  durationSec?: number | null
): number {
  if (typeof durationSec === 'number' && durationSec > 0) return Math.round(durationSec);
  if (typeof durationMs === 'number' && durationMs > 0) return Math.round(durationMs / 1000);
  if (durationText && typeof durationText === 'string') {
    const parts = durationText.trim().split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 200;
}

function formatDurationText(seconds?: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s <= 0) return '3:20';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  }
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function cleanTitle(rawName?: string | null): string {
  if (!rawName) return '';
  const str = String(rawName);
  const cleaned = str.replace(/^(pinned[:_]?|monthly[:_]?|\[pinned\]\s*)/i, '').trim();
  return cleaned || str;
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stripLyricsForNestedCopy(song: Song): Song {
  if (!song.lyrics) return song;
  const { lyrics: _omit, ...rest } = song;
  return rest;
}

function toRiplaySongId(song: Song): string {
  if (song.youtubeId && !song.youtubeId.startsWith('online-') && !song.youtubeId.startsWith('local-')) {
    return song.youtubeId;
  }
  if (song.id.startsWith('yt-')) {
    return song.id.slice(3);
  }
  return song.id;
}

function sanitizeExportThumb(url: string | undefined, riplaySongId: string): string {
  if (url && url.startsWith('http')) return url;
  if (riplaySongId && riplaySongId.length === 11 && !riplaySongId.includes('/')) {
    return `https://i.ytimg.com/vi/${riplaySongId}/hqdefault.jpg`;
  }
  return '';
}

function stripLrcTimestamps(lrc: string): string {
  return lrc
    .split('\n')
    .map((line) => line.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

function queryTableRows(
  db: SqlDatabase,
  tableName: string,
  onLog?: (msg: string) => void
): Record<string, any>[] {
  try {
    const res = db.exec(`SELECT * FROM "${tableName}"`);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    const normalizedCols = columns.map((col) => normalizeKey(col));
    const lowerCols = columns.map((col) => col.toLowerCase());

    return values.map((row) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < row.length; i++) {
        obj[normalizedCols[i]] = row[i];
        obj[lowerCols[i]] = row[i];
      }
      return obj;
    });
  } catch (err) {
    onLog?.(`Warning reading table "${tableName}": ${String((err as any)?.message || err)}`);
    return [];
  }
}

interface TableColumnMeta {
  name: string;
  lower: string;
  norm: string;
  type: string;
  notnull: boolean;
  dfltValue: any;
  pk: number;
}

function getTableColumns(db: SqlDatabase, tableName: string): TableColumnMeta[] {
  const res = db.exec(`PRAGMA table_info("${tableName}")`);
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  const nameIdx = columns.indexOf('name');
  const typeIdx = columns.indexOf('type');
  const notnullIdx = columns.indexOf('notnull');
  const dfltIdx = columns.indexOf('dflt_value');
  const pkIdx = columns.indexOf('pk');

  return values.map((row) => {
    const name = String(row[nameIdx]);
    return {
      name,
      lower: name.toLowerCase(),
      norm: normalizeKey(name),
      type: String(row[typeIdx] || '').toUpperCase(),
      notnull: Number(row[notnullIdx] || 0) === 1,
      dfltValue: row[dfltIdx],
      pk: Number(row[pkIdx] || 0),
    };
  });
}

function defaultForColumn(col: TableColumnMeta): any {
  if (col.dfltValue !== null && col.dfltValue !== undefined) {
    const raw = String(col.dfltValue);
    if (raw === 'NULL' || raw === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
      return raw.slice(1, -1);
    }
    return raw;
  }
  if (!col.notnull) return null;
  if (col.type.includes('INT') || col.type.includes('REAL') || col.type.includes('NUM') || col.type.includes('FLOA')) {
    return 0;
  }
  return '';
}

function batchInsertRows(
  db: SqlDatabase,
  tableName: string,
  records: Record<string, any>[],
  conflictClause: 'REPLACE' | 'IGNORE' = 'REPLACE'
): number {
  if (records.length === 0) return 0;
  const cols = getTableColumns(db, tableName);
  if (cols.length === 0) return 0;

  // Omit auto-increment single integer PK only if none of the records supply that PK
  const hasExplicitId = records.some((r) => r.id !== undefined && r.id !== null);
  const insertCols = cols.filter((c) => {
    if (c.pk === 1 && c.lower === 'id' && c.type.includes('INT') && !hasExplicitId) {
      return false;
    }
    return true;
  });

  if (insertCols.length === 0) return 0;

  const colList = insertCols.map((c) => `"${c.name}"`).join(', ');
  const placeholders = insertCols.map(() => '?').join(', ');
  const sql = `INSERT OR ${conflictClause} INTO "${tableName}" (${colList}) VALUES (${placeholders})`;

  const stmt = db.prepare(sql);
  let inserted = 0;
  try {
    db.exec('BEGIN TRANSACTION;');
    for (const rec of records) {
      const params = insertCols.map((col) => {
        let val = rec[col.norm];
        if (val === undefined) val = rec[col.lower];
        if (val === undefined) val = rec[col.name];
        if (val === undefined) {
          return defaultForColumn(col);
        }
        if (val === null) {
          return col.notnull ? defaultForColumn(col) : null;
        }
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
      });
      stmt.run(params);
      inserted++;
    }
    db.exec('COMMIT;');
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  } finally {
    stmt.free();
  }
  return inserted;
}

const DEFAULT_RIPLAY_TABLES_SQL: RiplaySchemaItem[] = [
  {
    type: 'table',
    name: 'Song',
    sql: 'CREATE TABLE IF NOT EXISTS "Song" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "artistsText" TEXT, "durationText" TEXT, "thumbnailUrl" TEXT, "likedAt" INTEGER, "totalPlayTimeMs" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY("id"))',
  },
  {
    type: 'table',
    name: 'Playlist',
    sql: 'CREATE TABLE IF NOT EXISTS "Playlist" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "name" TEXT NOT NULL, "browseId" TEXT)',
  },
  {
    type: 'table',
    name: 'SongPlaylistMap',
    sql: 'CREATE TABLE IF NOT EXISTS "SongPlaylistMap" ("songId" TEXT NOT NULL, "playlistId" INTEGER NOT NULL, "position" INTEGER NOT NULL, PRIMARY KEY("songId", "playlistId"))',
  },
  {
    type: 'table',
    name: 'Artist',
    sql: 'CREATE TABLE IF NOT EXISTS "Artist" ("id" TEXT NOT NULL, "name" TEXT, "thumbnailUrl" TEXT, "timestamp" INTEGER, "bookmarkedAt" INTEGER, PRIMARY KEY("id"))',
  },
  {
    type: 'table',
    name: 'Album',
    sql: 'CREATE TABLE IF NOT EXISTS "Album" ("id" TEXT NOT NULL, "title" TEXT, "thumbnailUrl" TEXT, "year" TEXT, "authorsText" TEXT, "shareUrl" TEXT, "timestamp" INTEGER, "bookmarkedAt" INTEGER, PRIMARY KEY("id"))',
  },
  {
    type: 'table',
    name: 'SongArtistMap',
    sql: 'CREATE TABLE IF NOT EXISTS "SongArtistMap" ("songId" TEXT NOT NULL, "artistId" TEXT NOT NULL, PRIMARY KEY("songId", "artistId"))',
  },
  {
    type: 'table',
    name: 'SongAlbumMap',
    sql: 'CREATE TABLE IF NOT EXISTS "SongAlbumMap" ("songId" TEXT NOT NULL, "albumId" TEXT NOT NULL, "position" INTEGER, PRIMARY KEY("songId", "albumId"))',
  },
  {
    type: 'table',
    name: 'Lyrics',
    sql: 'CREATE TABLE IF NOT EXISTS "Lyrics" ("songId" TEXT NOT NULL, "fixed" TEXT, "synced" TEXT, PRIMARY KEY("songId"))',
  },
  {
    type: 'table',
    name: 'Event',
    sql: 'CREATE TABLE IF NOT EXISTS "Event" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "songId" TEXT NOT NULL, "timestamp" INTEGER NOT NULL, "playTime" INTEGER NOT NULL)',
  },
  {
    type: 'table',
    name: 'Blacklist',
    sql: 'CREATE TABLE IF NOT EXISTS "Blacklist" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "path" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL)',
  },
];

export class RiplaySqliteImporter {
  /**
   * Reads and parses a RiPlay / RiMusic Room SQLite database file
   * (.db, .backup, .sqlite) in strict O(N) time with live logs and event-loop yields.
   */
  static async importFromDatabaseBuffer(
    arrayBuffer: ArrayBuffer,
    onLog?: (msg: string) => void
  ): Promise<RiplayImportSummary> {
    const startTs = performance.now();
    const logs: string[] = [];
    const log = (msg: string) => {
      const elapsed = ((performance.now() - startTs) / 1000).toFixed(2);
      const line = `[+${elapsed}s] ${msg}`;
      logs.push(line);
      onLog?.(line);
    };

    log(`Input buffer size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB (${arrayBuffer.byteLength} bytes)`);
    const SQL = await getSqlJs(log);
    await yieldToMain();

    log('Opening SQLite database in WebAssembly memory...');
    const uint8 = new Uint8Array(arrayBuffer);
    const db: SqlDatabase = new SQL.Database(uint8);

    try {
      // 1. Discover tables, Room identity hash, and capture exact schema blueprint for 2-way export
      const masterRes = db.exec(
        "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
      );

      const tablesFound: string[] = [];
      const schemaItems: RiplaySchemaItem[] = [];
      let hasRoomMaster = false;

      if (masterRes.length > 0) {
        masterRes[0].values.forEach((row) => {
          const itemType = String(row[0] || '');
          const name = String(row[1] || '');
          const sql = String(row[2] || '');
          if (name === 'room_master_table') {
            hasRoomMaster = true;
            return;
          }
          if (itemType === 'table' && name) {
            tablesFound.push(name);
          }
          if ((itemType === 'table' || itemType === 'index') && name && sql) {
            schemaItems.push({ type: itemType as 'table' | 'index', name, sql });
          }
        });
      }

      let userVersion = 0;
      try {
        const uvRes = db.exec('PRAGMA user_version');
        if (uvRes.length > 0 && uvRes[0].values.length > 0) {
          userVersion = Number(uvRes[0].values[0][0] || 0);
        }
      } catch {}

      let roomIdentityHash: string | undefined;
      if (hasRoomMaster) {
        try {
          const rmRes = db.exec('SELECT identity_hash FROM room_master_table LIMIT 1');
          if (rmRes.length > 0 && rmRes[0].values.length > 0 && rmRes[0].values[0][0]) {
            roomIdentityHash = String(rmRes[0].values[0][0]);
          }
        } catch {}
      }

      log(
        `Discovered ${tablesFound.length} tables [${tablesFound.join(', ')}] (user_version=${userVersion}${
          roomIdentityHash ? `, roomHash=${roomIdentityHash.slice(0, 8)}...` : ''
        })`
      );

      if (schemaItems.length > 0) {
        const blueprint: RiplaySchemaBlueprint = {
          userVersion,
          roomIdentityHash,
          schemaItems,
          tablesFound,
          savedAt: Date.now(),
        };
        riplaySyncStore.saveSchemaBlueprint(blueprint).catch(() => {});
      }

      const findTable = (candidates: string[]): string | null => {
        const lowerCandidates = candidates.map((c) => c.toLowerCase());
        for (const t of tablesFound) {
          if (lowerCandidates.includes(t.toLowerCase())) return t;
        }
        return null;
      };

      const songTable = findTable(['Song', 'SongEntity', 'songs', 'tracks']);
      const playlistTable = findTable(['Playlist', 'PlaylistEntity', 'playlists']);
      const mapTable = findTable(['SongPlaylistMap', 'SortedSongPlaylistMap', 'song_playlist_map']);
      const artistTable = findTable(['Artist', 'ArtistEntity', 'artists']);
      const albumTable = findTable(['Album', 'AlbumEntity', 'albums']);
      const lyricsTable = findTable(['Lyrics', 'LyricsEntity', 'lyrics']);
      const eventTable = findTable(['Event', 'EventEntity', 'events', 'history']);
      const blacklistTable = findTable(['Blacklist', 'BlacklistEntity', 'blacklist']);
      const songArtistTable = findTable(['SongArtistMap', 'SongArtistCrossRef', 'song_artist_map']);
      const songAlbumTable = findTable(['SongAlbumMap', 'SongAlbumCrossRef', 'song_album_map']);

      await yieldToMain();

      // 2. Parse Lyrics (keep both fixed and synced for round-trip fidelity)
      const lyricsMap = new Map<string, string>();
      const rawLyricsMap: Record<string, { fixed?: string; synced?: string }> = {};
      if (lyricsTable) {
        const rows = queryTableRows(db, lyricsTable, log);
        for (const r of rows) {
          const songId = r.songid || r.id;
          const synced = r.lrcsynced || r.synced;
          const fixed = r.fixed || r.lyrics;
          const lyricsContent = synced || fixed;
          if (songId && lyricsContent) {
            const sid = String(songId);
            lyricsMap.set(sid, String(lyricsContent));
            const cleanSid = sid.startsWith('yt-') ? sid : sid.length === 11 ? `yt-${sid}` : sid;
            rawLyricsMap[cleanSid] = {
              fixed: fixed ? String(fixed) : undefined,
              synced: synced ? String(synced) : undefined,
            };
          }
        }
        log(`Parsed ${rows.length} lyrics entries`);
      }

      // 3. Parse Albums Map
      const albumMap = new Map<
        string,
        {
          title: string;
          coverUrl?: string;
          year?: string;
          artist?: string;
          shareUrl?: string;
          timestamp?: number;
          bookmarkedAt?: number | null;
          isBookmarked?: boolean;
        }
      >();
      if (albumTable) {
        const rows = queryTableRows(db, albumTable, log);
        for (const r of rows) {
          const id = String(r.id || '');
          if (!id) continue;
          const bookmarkedAt = r.bookmarkedat ? Number(r.bookmarkedat) : null;
          const isBookmarked = Boolean(
            (bookmarkedAt && bookmarkedAt > 0) || r.bookmarked === 1 || r.inlibrary === 1
          );
          albumMap.set(id, {
            title: cleanTitle(r.title || 'Untitled Album'),
            coverUrl: r.thumbnailurl || r.coverurl,
            year: r.year ? String(r.year) : undefined,
            artist: r.authorstext || r.artist || 'Various Artists',
            shareUrl: r.shareurl ? String(r.shareurl) : undefined,
            timestamp: r.timestamp ? Number(r.timestamp) : undefined,
            bookmarkedAt: bookmarkedAt || (isBookmarked ? Date.now() : null),
            isBookmarked,
          });
        }
        log(`Parsed ${albumMap.size} albums`);
      }

      // 4. Parse Artists Map
      const artistMap = new Map<
        string,
        {
          name: string;
          thumbnailUrl?: string;
          timestamp?: number;
          bookmarkedAt?: number | null;
          isBookmarked?: boolean;
        }
      >();
      if (artistTable) {
        const rows = queryTableRows(db, artistTable, log);
        for (const r of rows) {
          const id = String(r.id || '');
          if (!id) continue;
          const bookmarkedAt = r.bookmarkedat ? Number(r.bookmarkedat) : null;
          const isBookmarked = Boolean(
            (bookmarkedAt && bookmarkedAt > 0) || r.bookmarked === 1 || r.inlibrary === 1
          );
          artistMap.set(id, {
            name: r.name || 'Unknown Artist',
            thumbnailUrl: r.thumbnailurl || r.coverurl,
            timestamp: r.timestamp ? Number(r.timestamp) : undefined,
            bookmarkedAt: bookmarkedAt || (isBookmarked ? Date.now() : null),
            isBookmarked,
          });
        }
        log(`Parsed ${artistMap.size} artists`);
      }

      await yieldToMain();

      // 5. Parse Songs
      const songMap = new Map<string, Song>();
      const likedSongs: Song[] = [];

      if (songTable) {
        const rows = queryTableRows(db, songTable, log);
        for (const r of rows) {
          const rawId = String(r.id || r.mediaid || '');
          if (!rawId) continue;

          const title = cleanTitle(r.title || 'Untitled Song');
          const artist = r.artiststext || r.artist || 'Unknown Artist';
          const duration = parseDurationText(r.durationtext, r.duration, r.durationseconds);

          let thumbnailUrl = r.thumbnailurl || r.coverurl;
          if (!thumbnailUrl && rawId.length === 11) {
            thumbnailUrl = `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`;
          } else if (!thumbnailUrl) {
            thumbnailUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80';
          }

          const albumInfo = r.albumid ? albumMap.get(String(r.albumid)) : undefined;
          const albumTitle = albumInfo ? cleanTitle(albumInfo.title) : cleanTitle(r.album);

          const isLiked = Boolean(
            (r.likedat && Number(r.likedat) > 0) ||
              r.liked === 1 ||
              r.isliked === 1 ||
              r.liked === true
          );

          const totalPlayMs = Number(r.totalplaytimems || 0);
          const playCount =
            totalPlayMs > 0 ? Math.max(1, Math.round(totalPlayMs / ((duration || 180) * 1000))) : 0;

          const isYouTube = rawId.length === 11 || rawId.startsWith('yt-') || !rawId.includes('/');
          const cleanId = rawId.startsWith('yt-')
            ? rawId
            : rawId.length === 11
            ? `yt-${rawId}`
            : rawId;
          const youtubeId =
            rawId.length === 11
              ? rawId
              : rawId.startsWith('yt-')
              ? rawId.replace('yt-', '')
              : undefined;

          const song: Song = {
            id: cleanId,
            title,
            artist,
            artistId: r.artistid ? String(r.artistid) : undefined,
            album: albumTitle,
            albumId: r.albumid ? String(r.albumid) : undefined,
            duration,
            thumbnailUrl,
            source: isYouTube ? 'youtube' : 'local',
            youtubeId,
            lyrics: lyricsMap.get(rawId) || lyricsMap.get(cleanId),
            liked: isLiked,
            playCount,
            totalPlayTimeMs: totalPlayMs > 0 ? totalPlayMs : undefined,
            addedAt: r.likedat ? Number(r.likedat) : Date.now(),
          };

          songMap.set(rawId, song);
          songMap.set(cleanId, song);

          if (isLiked) {
            likedSongs.push(song);
          }
        }
        log(`Parsed ${rows.length} songs (${likedSongs.length} liked)`);
      }

      await yieldToMain();

      // 6. Parse Playlists and SongPlaylistMap
      const playlists: Playlist[] = [];
      if (playlistTable) {
        const plRows = queryTableRows(db, playlistTable, log);
        const mapRows = mapTable ? queryTableRows(db, mapTable, log) : [];

        const playlistTracksMap = new Map<string, { songId: string; position: number }[]>();
        for (const m of mapRows) {
          const plId = String(m.playlistid ?? m.playlist_id);
          const songId = String(m.songid ?? m.song_id);
          const position = Number(m.position ?? 0);

          let list = playlistTracksMap.get(plId);
          if (!list) {
            list = [];
            playlistTracksMap.set(plId, list);
          }
          list.push({ songId, position });
        }

        for (const p of plRows) {
          const plId = String(p.id ?? '');
          const rawName = String(p.name || p.title || 'Imported Playlist');
          const cleanPlaylistTitle = cleanTitle(rawName);

          const mapped = playlistTracksMap.get(plId) || [];
          mapped.sort((a, b) => a.position - b.position);

          const tracks: Song[] = [];
          for (const item of mapped) {
            const foundSong = songMap.get(item.songId) || songMap.get(`yt-${item.songId}`);
            if (foundSong) {
              tracks.push(foundSong);
            }
          }

          const coverUrl =
            tracks[0]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80';

          playlists.push({
            id: `riplay_pl_${plId}`,
            title: cleanPlaylistTitle,
            description: `Imported playlist (${tracks.length} tracks)`,
            coverUrl,
            color: '#1DB954',
            isBuiltIn: false,
            type: 'custom',
            songs: tracks,
            createdAt: Date.now(),
            browseId: p.browseid ? String(p.browseid) : undefined,
          });
        }
        log(`Parsed ${playlists.length} playlists (${mapRows.length} playlist song links)`);
      }

      // 7. Parse Event (Listening History)
      const historySongs: Song[] = [];
      if (eventTable) {
        const eventRows = queryTableRows(db, eventTable, log);
        eventRows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

        const seenHistoryIds = new Set<string>();
        for (const ev of eventRows) {
          const songId = String(ev.songid || '');
          if (songId && !seenHistoryIds.has(songId)) {
            seenHistoryIds.add(songId);
            const song = songMap.get(songId) || songMap.get(`yt-${songId}`);
            if (song) {
              historySongs.push(song);
            }
          }
        }
        log(`Parsed ${eventRows.length} events (${historySongs.length} unique history tracks)`);
      }

      await yieldToMain();

      // Deduplicate all unique songs
      const allUniqueSongs = Array.from(new Set(songMap.values()));

      // Pre-index songs by lowercase artist & album name ONCE (O(N) instead of O(N^2))
      const songsByArtistLower = new Map<string, Song[]>();
      const songsByAlbumLower = new Map<string, Song[]>();
      for (const s of allUniqueSongs) {
        if (s.artist && s.artist !== 'Unknown Artist') {
          const k = s.artist.toLowerCase();
          let arr = songsByArtistLower.get(k);
          if (!arr) {
            arr = [];
            songsByArtistLower.set(k, arr);
          }
          arr.push(s);
        }
        if (s.album && s.album !== 'Single' && s.album !== 'Music') {
          const k = s.album.toLowerCase();
          let arr = songsByAlbumLower.get(k);
          if (!arr) {
            arr = [];
            songsByAlbumLower.set(k, arr);
          }
          arr.push(s);
        }
      }

      // 8. Parse Artists in O(N)
      const importedArtists: Artist[] = [];
      const seenArtistNames = new Set<string>();
      const artistSongsMap = new Map<string, Song[]>();
      const artistSongIdsSetMap = new Map<string, Set<string>>();

      const addSongToArtistBucket = (aId: string, song: Song) => {
        let idSet = artistSongIdsSetMap.get(aId);
        if (!idSet) {
          idSet = new Set();
          artistSongIdsSetMap.set(aId, idSet);
        }
        if (idSet.has(song.id)) return;
        idSet.add(song.id);
        let list = artistSongsMap.get(aId);
        if (!list) {
          list = [];
          artistSongsMap.set(aId, list);
        }
        list.push(song);
      };

      if (songArtistTable) {
        const crossRows = queryTableRows(db, songArtistTable, log);
        for (const cr of crossRows) {
          const aId = String(cr.artistid || '');
          const sId = String(cr.songid || '');
          const song = songMap.get(sId) || songMap.get(`yt-${sId}`);
          if (aId && song) {
            addSongToArtistBucket(aId, song);
            const metaArtist = artistMap.get(aId);
            if (metaArtist && metaArtist.name && (!song.artist || song.artist === 'Unknown Artist')) {
              song.artist = metaArtist.name;
              if (!song.artistId) song.artistId = aId;
            }
          }
        }
      }

      for (const song of allUniqueSongs) {
        if (song.artistId) {
          addSongToArtistBucket(song.artistId, song);
          const metaArtist = artistMap.get(song.artistId);
          if (metaArtist && metaArtist.name && (!song.artist || song.artist === 'Unknown Artist')) {
            song.artist = metaArtist.name;
          }
        }
      }

      artistMap.forEach((meta, artistId) => {
        let songs = artistSongsMap.get(artistId);
        if (!songs || songs.length === 0) {
          songs = songsByArtistLower.get(meta.name.toLowerCase()) || [];
        }
        seenArtistNames.add(meta.name.toLowerCase());
        importedArtists.push({
          id: artistId,
          name: meta.name,
          thumbnailUrl:
            meta.thumbnailUrl ||
            songs[0]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
          subscribers: meta.isBookmarked ? 'Followed Artist' : 'Saved Artist',
          topSongs: songs.slice(0, 30).map(stripLyricsForNestedCopy),
          bookmarkedAt: meta.bookmarkedAt ?? null,
          timestamp: meta.timestamp,
        });
      });

      songsByArtistLower.forEach((artistSongs, normName) => {
        if (seenArtistNames.has(normName)) return;
        seenArtistNames.add(normName);
        const displayName = artistSongs[0].artist;
        importedArtists.push({
          id: `riplay_art_${encodeURIComponent(displayName)}`,
          name: displayName,
          thumbnailUrl: artistSongs[0].thumbnailUrl,
          subscribers: `${artistSongs.length} Songs`,
          topSongs: artistSongs.slice(0, 30).map(stripLyricsForNestedCopy),
        });
      });

      log(`Indexed ${importedArtists.length} artists (O(N))`);
      await yieldToMain();

      // 9. Parse Albums in O(N)
      const importedAlbums: Album[] = [];
      const seenAlbumTitles = new Set<string>();
      const albumSongsMap = new Map<string, Song[]>();
      const albumSongIdsSetMap = new Map<string, Set<string>>();

      const addSongToAlbumBucket = (albId: string, song: Song) => {
        let idSet = albumSongIdsSetMap.get(albId);
        if (!idSet) {
          idSet = new Set();
          albumSongIdsSetMap.set(albId, idSet);
        }
        if (idSet.has(song.id)) return;
        idSet.add(song.id);
        let list = albumSongsMap.get(albId);
        if (!list) {
          list = [];
          albumSongsMap.set(albId, list);
        }
        list.push(song);
      };

      if (songAlbumTable) {
        const crossRows = queryTableRows(db, songAlbumTable, log);
        for (const cr of crossRows) {
          const albId = String(cr.albumid || '');
          const sId = String(cr.songid || '');
          const song = songMap.get(sId) || songMap.get(`yt-${sId}`);
          if (albId && song) {
            addSongToAlbumBucket(albId, song);
          }
        }
      }

      for (const song of allUniqueSongs) {
        if (song.albumId) {
          addSongToAlbumBucket(song.albumId, song);
        }
      }

      albumMap.forEach((meta, albId) => {
        let songs = albumSongsMap.get(albId);
        if (!songs || songs.length === 0) {
          songs = songsByAlbumLower.get(meta.title.toLowerCase()) || [];
        }
        const title = cleanTitle(meta.title);
        seenAlbumTitles.add(title.toLowerCase());
        importedAlbums.push({
          id: albId,
          title,
          artist: meta.artist || songs[0]?.artist || 'Various Artists',
          year: meta.year || 'Album',
          coverUrl:
            meta.coverUrl ||
            songs[0]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
          songs: songs.map(stripLyricsForNestedCopy),
          bookmarkedAt: meta.bookmarkedAt ?? null,
          shareUrl: meta.shareUrl,
          timestamp: meta.timestamp,
        });
      });

      songsByAlbumLower.forEach((albumSongs, normTitle) => {
        if (seenAlbumTitles.has(normTitle)) return;
        seenAlbumTitles.add(normTitle);
        const first = albumSongs[0];
        importedAlbums.push({
          id: `riplay_alb_${encodeURIComponent(first.album || normTitle)}`,
          title: first.album || normTitle,
          artist: first.artist,
          year: first.year ? String(first.year) : 'Album',
          coverUrl: first.thumbnailUrl,
          songs: albumSongs.map(stripLyricsForNestedCopy),
        });
      });

      log(`Indexed ${importedAlbums.length} albums (O(N))`);
      await yieldToMain();

      // 10. Parse Blacklist
      const importedBlacklist: { id: string; name: string; type: 'song' | 'artist' }[] = [];
      if (blacklistTable) {
        const blRows = queryTableRows(db, blacklistTable, log);
        for (const bl of blRows) {
          const typeStr = String(bl.type || '').toLowerCase();
          const type: 'song' | 'artist' = typeStr.includes('artist') ? 'artist' : 'song';
          const name = bl.name || bl.path || 'Blacklisted Item';
          const id = bl.path || bl.name || String(bl.id || Math.random());
          importedBlacklist.push({ id, name, type });
        }
        log(`Parsed ${importedBlacklist.length} blacklist items`);
      }

      // Persist full song catalog + lyrics snapshot into IndexedDB sync store for 2-way export
      riplaySyncStore.saveCatalogSnapshot(allUniqueSongs, rawLyricsMap).catch(() => {});
      log('SQLite parsing completed cleanly.');

      return {
        songsCount: allUniqueSongs.length,
        playlistsCount: playlists.length,
        artistsCount: importedArtists.length,
        albumsCount: importedAlbums.length,
        historyCount: historySongs.length,
        blacklistCount: importedBlacklist.length,
        likedSongsCount: likedSongs.length,
        lyricsCount: Object.keys(rawLyricsMap).length,
        tablesFound,
        importedPlaylists: playlists,
        importedSongs: allUniqueSongs,
        importedLikedSongs: likedSongs,
        importedHistory: historySongs,
        importedArtists,
        importedAlbums,
        importedBlacklist,
        rawLyricsMap,
        logs,
        importedAt: Date.now(),
      };
    } finally {
      db.close();
    }
  }

  /**
   * Reverse Sync: Exports Muzika's full library, playlists, liked songs, lyrics,
   * history, artists, albums, stats, and blacklist into a RiPlay-compatible SQLite .db file.
   */
  static async exportToDatabaseBuffer(
    payload: RiplayExportPayload,
    onLog?: (msg: string) => void
  ): Promise<RiplayExportResult> {
    const startTs = performance.now();
    const logs: string[] = [];
    const log = (msg: string) => {
      const elapsed = ((performance.now() - startTs) / 1000).toFixed(2);
      const line = `[+${elapsed}s] ${msg}`;
      logs.push(line);
      onLog?.(line);
    };

    log('Starting Muzika -> RiPlay SQLite export...');
    const SQL = await getSqlJs(log);
    await yieldToMain();

    const blueprint = await riplaySyncStore.getSchemaBlueprint();
    const catalog = await riplaySyncStore.getCatalogSnapshot();
    const usedBlueprint = Boolean(blueprint && blueprint.schemaItems.length > 0);

    if (usedBlueprint && blueprint) {
      log(
        `Using captured RiPlay Room schema (user_version=${blueprint.userVersion}, tables=${blueprint.tablesFound.length})`
      );
    } else {
      log('No prior RiPlay schema blueprint found; generating standard RiPlay Room schema');
    }

    const db: SqlDatabase = new SQL.Database();
    try {
      // 1. Create schema (captured blueprint tables first, plus any missing standard tables)
      if (blueprint && blueprint.userVersion > 0) {
        db.exec(`PRAGMA user_version = ${blueprint.userVersion};`);
      }

      if (blueprint?.roomIdentityHash) {
        db.exec('CREATE TABLE IF NOT EXISTS "room_master_table" ("id" INTEGER PRIMARY KEY, "identity_hash" TEXT);');
        db.exec(
          `INSERT OR REPLACE INTO "room_master_table" ("id", "identity_hash") VALUES (42, '${blueprint.roomIdentityHash.replace(
            /'/g,
            "''"
          )}');`
        );
      }

      const tableSchemas =
        blueprint && blueprint.schemaItems.length > 0
          ? blueprint.schemaItems.filter((item) => item.type === 'table')
          : DEFAULT_RIPLAY_TABLES_SQL;

      for (const item of tableSchemas) {
        try {
          db.exec(item.sql);
        } catch (err) {
          log(`Notice creating blueprint table "${item.name}": ${String((err as any)?.message || err)}`);
        }
      }

      // Ensure all core RiPlay tables exist even if blueprint had only a subset
      for (const fallback of DEFAULT_RIPLAY_TABLES_SQL) {
        try {
          db.exec(fallback.sql);
        } catch {}
      }

      const masterTablesRes = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'room_master_table'"
      );
      const activeTables: string[] = [];
      if (masterTablesRes.length > 0) {
        masterTablesRes[0].values.forEach((r) => activeTables.push(String(r[0])));
      }
      const resolveTable = (candidates: string[], fallback: string): string => {
        const lowerSet = candidates.map((c) => c.toLowerCase());
        return activeTables.find((t) => lowerSet.includes(t.toLowerCase())) || fallback;
      };

      const songTbl = resolveTable(['Song', 'SongEntity', 'songs'], 'Song');
      const playlistTbl = resolveTable(['Playlist', 'PlaylistEntity', 'playlists'], 'Playlist');
      const songPlaylistMapTbl = resolveTable(
        ['SongPlaylistMap', 'SortedSongPlaylistMap', 'song_playlist_map'],
        'SongPlaylistMap'
      );
      const artistTbl = resolveTable(['Artist', 'ArtistEntity', 'artists'], 'Artist');
      const albumTbl = resolveTable(['Album', 'AlbumEntity', 'albums'], 'Album');
      const songArtistMapTbl = resolveTable(
        ['SongArtistMap', 'SongArtistCrossRef', 'song_artist_map'],
        'SongArtistMap'
      );
      const songAlbumMapTbl = resolveTable(
        ['SongAlbumMap', 'SongAlbumCrossRef', 'song_album_map'],
        'SongAlbumMap'
      );
      const lyricsTbl = resolveTable(['Lyrics', 'LyricsEntity', 'lyrics'], 'Lyrics');
      const eventTbl = resolveTable(['Event', 'EventEntity', 'events'], 'Event');
      const blacklistTbl = resolveTable(['Blacklist', 'BlacklistEntity', 'blacklist'], 'Blacklist');

      await yieldToMain();

      // 2. Collect all unique Songs across catalog, playlists, likedSongs, history, artists, albums, queue
      const likedIds = new Set<string>(payload.likedSongs.map((s) => toRiplaySongId(s)));
      const songMap = new Map<string, Song>();
      const lyricsOutMap = new Map<string, { fixed?: string; synced?: string }>();

      if (catalog?.lyricsMap) {
        Object.entries(catalog.lyricsMap).forEach(([k, val]) => {
          const rId = k.startsWith('yt-') ? k.slice(3) : k;
          lyricsOutMap.set(rId, val);
        });
      }

      const absorbSong = (s: Song, forceLiked = false) => {
        if (!s?.id) return;
        const rId = toRiplaySongId(s);
        const existing = songMap.get(rId);
        const mergedLiked = forceLiked || existing?.liked || s.liked || likedIds.has(rId);
        if (mergedLiked) likedIds.add(rId);

        const playCount = Math.max(
          existing?.playCount || 0,
          s.playCount || 0,
          payload.userStats.songPlayCounts[s.id] || 0,
          payload.userStats.songPlayCounts[rId] || 0
        );
        const computedPlayMs = playCount * ((s.duration || existing?.duration || 180) * 1000);
        const totalPlayTimeMs = Math.max(
          existing?.totalPlayTimeMs || 0,
          s.totalPlayTimeMs || 0,
          computedPlayMs
        );

        const mergedSong: Song = {
          ...(existing || {}),
          ...s,
          id: rId,
          title: s.title || existing?.title || 'Untitled Song',
          artist: s.artist || existing?.artist || 'Unknown Artist',
          duration: s.duration || existing?.duration || 200,
          thumbnailUrl: sanitizeExportThumb(s.thumbnailUrl || existing?.thumbnailUrl, rId),
          liked: mergedLiked,
          playCount,
          totalPlayTimeMs,
          addedAt: s.addedAt || existing?.addedAt || Date.now(),
          lyrics: s.lyrics || existing?.lyrics,
        };
        songMap.set(rId, mergedSong);

        if (mergedSong.lyrics && !lyricsOutMap.has(rId)) {
          const isLrc = /\[\d{1,2}:\d{2}/.test(mergedSong.lyrics);
          lyricsOutMap.set(rId, {
            synced: isLrc ? mergedSong.lyrics : undefined,
            fixed: isLrc ? stripLrcTimestamps(mergedSong.lyrics) : mergedSong.lyrics,
          });
        }
      };

      (catalog?.songs || []).forEach((s) => absorbSong(s));
      payload.importedArtists.forEach((a) => (a.topSongs || []).forEach((s) => absorbSong(s)));
      payload.savedArtists.forEach((a) => (a.topSongs || []).forEach((s) => absorbSong(s)));
      payload.importedAlbums.forEach((a) => (a.songs || []).forEach((s) => absorbSong(s)));
      payload.savedAlbums.forEach((a) => (a.songs || []).forEach((s) => absorbSong(s)));
      payload.history.forEach((s) => absorbSong(s));
      (payload.queue || []).forEach((s) => absorbSong(s));
      payload.playlists.forEach((pl) => pl.songs.forEach((s) => absorbSong(s)));
      payload.likedSongs.forEach((s) => absorbSong(s, true));

      const now = Date.now();
      const songRows = Array.from(songMap.values()).map((s) => ({
        id: s.id,
        mediaid: s.id,
        title: s.title,
        artiststext: s.artist,
        artist: s.artist,
        durationtext: formatDurationText(s.duration),
        duration: s.duration,
        thumbnailurl: s.thumbnailUrl,
        likedat: likedIds.has(s.id) ? s.likedAt || s.addedAt || now : null,
        totalplaytimems: s.totalPlayTimeMs || 0,
        albumid: s.albumId || null,
        artistid: s.artistId || null,
      }));

      const songsWritten = batchInsertRows(db, songTbl, songRows, 'REPLACE');
      log(`Exported ${songsWritten} songs to "${songTbl}"`);
      await yieldToMain();

      // 3. Export Playlists & SongPlaylistMap
      const usedPlIds = new Set<number>();
      let nextPlId = 1;
      const playlistRows: Record<string, any>[] = [];
      const spMapRows: Record<string, any>[] = [];

      payload.playlists.forEach((pl) => {
        let numericId: number | null = null;
        if (pl.id.startsWith('riplay_pl_')) {
          const parsed = parseInt(pl.id.replace('riplay_pl_', ''), 10);
          if (!isNaN(parsed) && parsed > 0 && !usedPlIds.has(parsed)) {
            numericId = parsed;
          }
        }
        if (numericId === null) {
          while (usedPlIds.has(nextPlId)) nextPlId++;
          numericId = nextPlId++;
        }
        usedPlIds.add(numericId);

        playlistRows.push({
          id: numericId,
          name: pl.title,
          browseid: pl.browseId || null,
        });

        const seenInPlaylist = new Set<string>();
        pl.songs.forEach((s, idx) => {
          const rId = toRiplaySongId(s);
          if (seenInPlaylist.has(rId)) return;
          seenInPlaylist.add(rId);
          spMapRows.push({
            songid: rId,
            playlistid: numericId,
            position: idx,
          });
        });
      });

      const playlistsWritten = batchInsertRows(db, playlistTbl, playlistRows, 'REPLACE');
      const mapWritten = batchInsertRows(db, songPlaylistMapTbl, spMapRows, 'IGNORE');
      log(`Exported ${playlistsWritten} playlists & ${mapWritten} playlist tracks`);
      await yieldToMain();

      // 4. Export Artists & SongArtistMap
      const artistMapOut = new Map<string, Artist>();
      const savedArtistIds = new Set(payload.savedArtists.map((a) => a.id));
      [...payload.importedArtists, ...payload.savedArtists].forEach((a) => {
        if (!a?.id) return;
        const prev = artistMapOut.get(a.id);
        const isBookmarked = savedArtistIds.has(a.id) || Boolean(a.bookmarkedAt && a.bookmarkedAt > 0);
        artistMapOut.set(a.id, {
          ...(prev || {}),
          ...a,
          bookmarkedAt: isBookmarked ? a.bookmarkedAt || prev?.bookmarkedAt || now : null,
        });
      });

      const artistRows: Record<string, any>[] = [];
      const saMapRows: Record<string, any>[] = [];
      const saPairs = new Set<string>();

      artistMapOut.forEach((a) => {
        artistRows.push({
          id: a.id,
          name: a.name,
          thumbnailurl: a.thumbnailUrl?.startsWith('http') ? a.thumbnailUrl : null,
          timestamp: a.timestamp || now,
          bookmarkedat: a.bookmarkedAt ?? null,
        });
        (a.topSongs || []).forEach((s) => {
          const rId = toRiplaySongId(s);
          const pairKey = `${rId}__${a.id}`;
          if (!saPairs.has(pairKey)) {
            saPairs.add(pairKey);
            saMapRows.push({ songid: rId, artistid: a.id });
          }
        });
      });

      songMap.forEach((s) => {
        if (s.artistId && artistMapOut.has(s.artistId)) {
          const pairKey = `${s.id}__${s.artistId}`;
          if (!saPairs.has(pairKey)) {
            saPairs.add(pairKey);
            saMapRows.push({ songid: s.id, artistid: s.artistId });
          }
        }
      });

      const artistsWritten = batchInsertRows(db, artistTbl, artistRows, 'REPLACE');
      batchInsertRows(db, songArtistMapTbl, saMapRows, 'IGNORE');
      log(`Exported ${artistsWritten} artists & ${saMapRows.length} song-artist links`);

      // 5. Export Albums & SongAlbumMap
      const albumMapOut = new Map<string, Album>();
      const savedAlbumIds = new Set(payload.savedAlbums.map((a) => a.id));
      [...payload.importedAlbums, ...payload.savedAlbums].forEach((a) => {
        if (!a?.id) return;
        const prev = albumMapOut.get(a.id);
        const isBookmarked = savedAlbumIds.has(a.id) || Boolean(a.bookmarkedAt && a.bookmarkedAt > 0);
        albumMapOut.set(a.id, {
          ...(prev || {}),
          ...a,
          bookmarkedAt: isBookmarked ? a.bookmarkedAt || prev?.bookmarkedAt || now : null,
        });
      });

      const albumRows: Record<string, any>[] = [];
      const salMapRows: Record<string, any>[] = [];
      const salPairs = new Set<string>();

      albumMapOut.forEach((a) => {
        albumRows.push({
          id: a.id,
          title: a.title,
          thumbnailurl: a.coverUrl?.startsWith('http') ? a.coverUrl : null,
          year: a.year ? String(a.year) : null,
          authorstext: a.artist,
          shareurl: a.shareUrl || null,
          timestamp: a.timestamp || now,
          bookmarkedat: a.bookmarkedAt ?? null,
        });
        (a.songs || []).forEach((s, pos) => {
          const rId = toRiplaySongId(s);
          const pairKey = `${rId}__${a.id}`;
          if (!salPairs.has(pairKey)) {
            salPairs.add(pairKey);
            salMapRows.push({ songid: rId, albumid: a.id, position: pos });
          }
        });
      });

      songMap.forEach((s) => {
        if (s.albumId && albumMapOut.has(s.albumId)) {
          const pairKey = `${s.id}__${s.albumId}`;
          if (!salPairs.has(pairKey)) {
            salPairs.add(pairKey);
            salMapRows.push({ songid: s.id, albumid: s.albumId, position: 0 });
          }
        }
      });

      const albumsWritten = batchInsertRows(db, albumTbl, albumRows, 'REPLACE');
      batchInsertRows(db, songAlbumMapTbl, salMapRows, 'IGNORE');
      log(`Exported ${albumsWritten} albums & ${salMapRows.length} song-album links`);
      await yieldToMain();

      // 6. Export Lyrics
      const lyricsRows: Record<string, any>[] = [];
      lyricsOutMap.forEach((val, rId) => {
        if (!val.fixed && !val.synced) return;
        lyricsRows.push({
          songid: rId,
          fixed: val.fixed || (val.synced ? stripLrcTimestamps(val.synced) : null),
          synced: val.synced || null,
        });
      });
      const lyricsWritten = batchInsertRows(db, lyricsTbl, lyricsRows, 'REPLACE');
      log(`Exported ${lyricsWritten} lyrics records`);

      // 7. Export Events (Listening History + Play Stats)
      const eventRows: Record<string, any>[] = [];
      const seenEventKeys = new Set<string>();
      (payload.userStats.playHistory || []).forEach((ev) => {
        const rId = ev.songId.startsWith('yt-') ? ev.songId.slice(3) : ev.songId;
        const ts = ev.playedAt || now;
        const key = `${rId}_${ts}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          eventRows.push({
            songid: rId,
            timestamp: ts,
            playtime: Math.max(1000, Math.round((ev.duration || 180) * 1000)),
          });
        }
      });
      payload.history.forEach((s, idx) => {
        const rId = toRiplaySongId(s);
        const ts = s.lastPlayedAt || now - idx * 60_000;
        const hasSongEvent = (payload.userStats.playHistory || []).some(
          (ev) => (ev.songId.startsWith('yt-') ? ev.songId.slice(3) : ev.songId) === rId
        );
        if (!hasSongEvent) {
          eventRows.push({
            songid: rId,
            timestamp: ts,
            playtime: Math.max(1000, Math.round((s.duration || 180) * 1000)),
          });
        }
      });
      const eventsWritten = batchInsertRows(db, eventTbl, eventRows, 'IGNORE');
      log(`Exported ${eventsWritten} play history events`);

      // 8. Export Blacklist
      const blacklistRows = payload.blacklist.map((bl) => ({
        path: bl.id,
        name: bl.name,
        type: bl.type === 'artist' ? 'Artist' : 'Song',
      }));
      const blacklistWritten = batchInsertRows(db, blacklistTbl, blacklistRows, 'IGNORE');
      log(`Exported ${blacklistWritten} blacklist entries`);

      // 9. Apply any Room indices from captured blueprint
      if (blueprint) {
        const indexes = blueprint.schemaItems.filter((item) => item.type === 'index');
        for (const idxItem of indexes) {
          try {
            db.exec(idxItem.sql);
          } catch {}
        }
      }

      const buffer = db.export();
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `riplay-muzika-sync-${dateStr}.db`;
      log(
        `SQLite export packaged: ${fileName} (${(buffer.byteLength / 1024).toFixed(1)} KB)`
      );

      return {
        buffer,
        fileName,
        songsCount: songsWritten,
        playlistsCount: playlistsWritten,
        artistsCount: artistsWritten,
        albumsCount: albumsWritten,
        lyricsCount: lyricsWritten,
        eventsCount: eventsWritten,
        blacklistCount: blacklistWritten,
        usedBlueprint,
        logs,
      };
    } finally {
      db.close();
    }
  }
}
