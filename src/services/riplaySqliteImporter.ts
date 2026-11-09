import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Song, Playlist, Artist, Album } from '../types/music';

export interface RiplayImportSummary {
  songsCount: number;
  playlistsCount: number;
  artistsCount: number;
  albumsCount: number;
  historyCount: number;
  blacklistCount: number;
  likedSongsCount: number;
  tablesFound: string[];
  importedPlaylists: Playlist[];
  importedSongs: Song[];
  importedLikedSongs: Song[];
  importedHistory: Song[];
  importedArtists: Artist[];
  importedAlbums: Album[];
  importedBlacklist: { id: string; name: string; type: 'song' | 'artist' }[];
}

let sqlInstancePromise: Promise<any> | null = null;

async function getSqlJs() {
  if (!sqlInstancePromise) {
    sqlInstancePromise = (async () => {
      // Strategy 1: Vite resolved asset URL
      try {
        return await initSqlJs({
          locateFile: () => sqlWasmUrl,
        });
      } catch (err1) {
        console.warn('WASM load strategy 1 failed (sqlWasmUrl):', err1);
      }

      // Strategy 2: Absolute URL relative to window.location
      try {
        const originUrl = new URL('/sql-wasm.wasm', window.location.origin).href;
        return await initSqlJs({
          locateFile: () => originUrl,
        });
      } catch (err2) {
        console.warn('WASM load strategy 2 failed (window.location.origin):', err2);
      }

      // Strategy 3: Current base path relative URL
      try {
        const relativeUrl = new URL('sql-wasm.wasm', window.location.href).href;
        return await initSqlJs({
          locateFile: () => relativeUrl,
        });
      } catch (err3) {
        console.warn('WASM load strategy 3 failed (window.location.href):', err3);
      }

      // Strategy 4: Default fallback
      return await initSqlJs({
        locateFile: (file: string) => `/${file}`,
      });
    })();
  }
  return sqlInstancePromise;
}

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
  return 200; // sensible default
}

function cleanTitle(rawName?: string | null): string {
  if (!rawName) return '';
  const str = String(rawName);
  const cleaned = str
    .replace(/^(pinned[:_]?|monthly[:_]?|\[pinned\]\s*)/i, '')
    .trim();
  return cleaned || str;
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function queryTableRows(db: SqlDatabase, tableName: string): Record<string, any>[] {
  try {
    const res = db.exec(`SELECT * FROM "${tableName}"`);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    const normalizedCols = columns.map((col) => normalizeKey(col));

    return values.map((row) => {
      const obj: Record<string, any> = {};
      row.forEach((val, i) => {
        obj[normalizedCols[i]] = val;
        // keep original lower column as well
        obj[columns[i].toLowerCase()] = val;
      });
      return obj;
    });
  } catch (err) {
    console.warn(`Error reading table ${tableName}:`, err);
    return [];
  }
}

export class RiplaySqliteImporter {
  /**
   * Reads and parses a RiPlay / RiMusic Room SQLite database file
   * (.db, .backup, .sqlite) and extracts all songs, playlists, artists,
   * albums, lyrics, playback history, and blacklist.
   */
  static async importFromDatabaseBuffer(arrayBuffer: ArrayBuffer): Promise<RiplayImportSummary> {
    const SQL = await getSqlJs();
    const uint8 = new Uint8Array(arrayBuffer);
    const db: SqlDatabase = new SQL.Database(uint8);

    try {
      // 1. Discover all tables in the SQLite database
      const masterRes = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'room_master_table'"
      );

      const tablesFound: string[] = [];
      if (masterRes.length > 0) {
        masterRes[0].values.forEach((row) => {
          if (row[0] && typeof row[0] === 'string') {
            tablesFound.push(row[0]);
          }
        });
      }

      const findTable = (candidates: string[]): string | null => {
        const lowerCandidates = candidates.map((c) => c.toLowerCase());
        for (const t of tablesFound) {
          if (lowerCandidates.includes(t.toLowerCase())) return t;
        }
        return null;
      };

      // Table names in RiPlay: Song, Playlist, SongPlaylistMap, Artist, Album, SongArtistMap, SongAlbumMap, Lyrics, Event, Blacklist
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

      // 2. Parse Lyrics
      const lyricsMap = new Map<string, string>();
      if (lyricsTable) {
        const rows = queryTableRows(db, lyricsTable);
        rows.forEach((r) => {
          const songId = r.songid || r.id;
          const lyricsContent = r.lrcsynced || r.synced || r.fixed || r.lyrics;
          if (songId && lyricsContent) {
            lyricsMap.set(String(songId), String(lyricsContent));
          }
        });
      }

      // 3. Parse Albums Map (Check bookmarked state)
      const albumMap = new Map<string, { title: string; coverUrl?: string; year?: string; artist?: string; isBookmarked?: boolean }>();
      if (albumTable) {
        const rows = queryTableRows(db, albumTable);
        rows.forEach((r) => {
          const id = String(r.id || '');
          if (id) {
            const isBookmarked = Boolean(
              (r.bookmarkedat && Number(r.bookmarkedat) > 0) ||
              r.bookmarked === 1 ||
              r.inlibrary === 1
            );
            albumMap.set(id, {
              title: cleanTitle(r.title || 'Untitled Album'),
              coverUrl: r.thumbnailurl || r.coverurl,
              year: r.year ? String(r.year) : undefined,
              artist: r.authorstext || r.artist || 'Various Artists',
              isBookmarked,
            });
          }
        });
      }

      // 4. Parse Artists Map (Check bookmarked state)
      const artistMap = new Map<string, { name: string; thumbnailUrl?: string; isBookmarked?: boolean }>();
      if (artistTable) {
        const rows = queryTableRows(db, artistTable);
        rows.forEach((r) => {
          const id = String(r.id || '');
          if (id) {
            const isBookmarked = Boolean(
              (r.bookmarkedat && Number(r.bookmarkedat) > 0) ||
              r.bookmarked === 1 ||
              r.inlibrary === 1
            );
            artistMap.set(id, {
              name: r.name || 'Unknown Artist',
              thumbnailUrl: r.thumbnailurl || r.coverurl,
              isBookmarked,
            });
          }
        });
      }

      // 5. Parse Songs
      const songMap = new Map<string, Song>();
      const likedSongs: Song[] = [];

      if (songTable) {
        const rows = queryTableRows(db, songTable);
        rows.forEach((r) => {
          const rawId = String(r.id || r.mediaid || '');
          if (!rawId) return;

          const title = cleanTitle(r.title || 'Untitled Song');
          const artist = r.artiststext || r.artist || 'Unknown Artist';
          const duration = parseDurationText(r.durationtext, r.duration, r.durationseconds);
          
          // YouTube or local thumbnail
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
          const playCount = totalPlayMs > 0 ? Math.max(1, Math.round(totalPlayMs / ((duration || 180) * 1000))) : 0;

          // Determine if ID is valid YouTube ID (11 chars)
          const isYouTube = rawId.length === 11 || rawId.startsWith('yt-') || !rawId.includes('/');
          const cleanId = rawId.startsWith('yt-') ? rawId : (rawId.length === 11 ? `yt-${rawId}` : rawId);
          const youtubeId = rawId.length === 11 ? rawId : (rawId.startsWith('yt-') ? rawId.replace('yt-', '') : undefined);

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
            addedAt: r.likedat ? Number(r.likedat) : Date.now(),
          };

          songMap.set(rawId, song);
          songMap.set(cleanId, song);

          if (isLiked) {
            likedSongs.push(song);
          }
        });
      }

      // 6. Parse Playlists and SongPlaylistMap
      const playlists: Playlist[] = [];
      if (playlistTable) {
        const plRows = queryTableRows(db, playlistTable);
        const mapRows = mapTable ? queryTableRows(db, mapTable) : [];

        // Group map rows by playlistId
        const playlistTracksMap = new Map<string, { songId: string; position: number }[]>();
        mapRows.forEach((m) => {
          const plId = String(m.playlistid ?? m.playlist_id);
          const songId = String(m.songid ?? m.song_id);
          const position = Number(m.position ?? 0);

          if (!playlistTracksMap.has(plId)) {
            playlistTracksMap.set(plId, []);
          }
          playlistTracksMap.get(plId)!.push({ songId, position });
        });

        plRows.forEach((p) => {
          const plId = String(p.id ?? '');
          const rawName = String(p.name || p.title || 'Imported Playlist');

          // Clean title (e.g. remove PINNED_, pinned:, etc.)
          const cleanPlaylistTitle = cleanTitle(rawName);

          // Get mapped tracks ordered by position
          const mapped = playlistTracksMap.get(plId) || [];
          mapped.sort((a, b) => a.position - b.position);

          const tracks: Song[] = [];
          mapped.forEach((item) => {
            const foundSong = songMap.get(item.songId) || songMap.get(`yt-${item.songId}`);
            if (foundSong) {
              tracks.push(foundSong);
            }
          });

          // Determine cover url
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
          });
        });
      }

      // 7. Parse Event (Listening History)
      const historySongs: Song[] = [];
      if (eventTable) {
        const eventRows = queryTableRows(db, eventTable);
        // Sort by timestamp descending
        eventRows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

        const seenHistoryIds = new Set<string>();
        eventRows.forEach((ev) => {
          const songId = String(ev.songid || '');
          if (songId && !seenHistoryIds.has(songId)) {
            seenHistoryIds.add(songId);
            const song = songMap.get(songId) || songMap.get(`yt-${songId}`);
            if (song) {
              historySongs.push(song);
            }
          }
        });
      }

      // 8. Parse Artists with songs (Filter: ONLY bookmarked or has library songs)
      const importedArtists: Artist[] = [];
      if (artistTable) {
        const artistSongsMap = new Map<string, Song[]>();
        if (songArtistTable) {
          const crossRows = queryTableRows(db, songArtistTable);
          crossRows.forEach((cr) => {
            const aId = String(cr.artistid || '');
            const sId = String(cr.songid || '');
            const song = songMap.get(sId) || songMap.get(`yt-${sId}`);
            if (aId && song) {
              if (!artistSongsMap.has(aId)) artistSongsMap.set(aId, []);
              artistSongsMap.get(aId)!.push(song);
            }
          });
        }

        artistMap.forEach((meta, artistId) => {
          const songs = artistSongsMap.get(artistId) || [];
          // ONLY import if explicitly bookmarked OR has songs in the user's library
          if (meta.isBookmarked || songs.length > 0) {
            importedArtists.push({
              id: artistId,
              name: meta.name,
              thumbnailUrl:
                meta.thumbnailUrl ||
                songs[0]?.thumbnailUrl ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
              subscribers: 'Imported Artist',
              topSongs: songs.slice(0, 20),
            });
          }
        });
      }

      // 9. Parse Albums with songs (Filter: ONLY bookmarked or has library songs)
      const importedAlbums: Album[] = [];
      if (albumTable) {
        const albumSongsMap = new Map<string, Song[]>();
        if (songAlbumTable) {
          const crossRows = queryTableRows(db, songAlbumTable);
          crossRows.forEach((cr) => {
            const albId = String(cr.albumid || '');
            const sId = String(cr.songid || '');
            const song = songMap.get(sId) || songMap.get(`yt-${sId}`);
            if (albId && song) {
              if (!albumSongsMap.has(albId)) albumSongsMap.set(albId, []);
              albumSongsMap.get(albId)!.push(song);
            }
          });
        }

        albumMap.forEach((meta, albId) => {
          const songs = albumSongsMap.get(albId) || [];
          // ONLY import if explicitly bookmarked OR has songs in the user's library
          if (meta.isBookmarked || songs.length > 0) {
            importedAlbums.push({
              id: albId,
              title: cleanTitle(meta.title),
              artist: meta.artist || 'Various Artists',
              year: meta.year || '2024',
              coverUrl:
                meta.coverUrl ||
                songs[0]?.thumbnailUrl ||
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80',
              songs,
            });
          }
        });
      }

      // 10. Parse Blacklist
      const importedBlacklist: { id: string; name: string; type: 'song' | 'artist' }[] = [];
      if (blacklistTable) {
        const blRows = queryTableRows(db, blacklistTable);
        blRows.forEach((bl) => {
          const typeStr = String(bl.type || '').toLowerCase();
          const type: 'song' | 'artist' = typeStr.includes('artist') ? 'artist' : 'song';
          const name = bl.name || bl.path || 'Blacklisted Item';
          const id = bl.path || bl.name || String(bl.id || Math.random());
          importedBlacklist.push({ id, name, type });
        });
      }

      // Deduplicate unique songs
      const allUniqueSongs = Array.from(new Set(songMap.values()));

      return {
        songsCount: allUniqueSongs.length,
        playlistsCount: playlists.length,
        artistsCount: importedArtists.length,
        albumsCount: importedAlbums.length,
        historyCount: historySongs.length,
        blacklistCount: importedBlacklist.length,
        likedSongsCount: likedSongs.length,
        tablesFound,
        importedPlaylists: playlists,
        importedSongs: allUniqueSongs,
        importedLikedSongs: likedSongs,
        importedHistory: historySongs,
        importedArtists,
        importedAlbums,
        importedBlacklist,
      };
    } finally {
      db.close();
    }
  }
}
