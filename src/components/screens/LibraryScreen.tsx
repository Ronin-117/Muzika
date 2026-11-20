import React, { useState, useRef, useMemo } from 'react';
import { useMusic, useBackHandler } from '../../context/MusicContext';
import {
  FolderHeart,
  ListPlus,
  History,
  HardDrive,
  Ban,
  Play,
  Trash2,
  Plus,
  Upload,
  CheckCircle2,
  DownloadCloud,
  Database,
  Users,
  Disc,
  Bookmark,
  Check,
  UserPlus,
  UserCheck,
  FileDown,
} from 'lucide-react';
import { Song, Artist, Album } from '../../types/music';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

export const LibraryScreen: React.FC = () => {
  const {
    likedSongs,
    playlists,
    history,
    blacklist,
    removeFromBlacklist,
    clearHistory,
    createPlaylist,
    deletePlaylist,
    setSelectedPlaylist,
    setSelectedArtistId,
    setSelectedArtist,
    setSelectedAlbum,
    playSong,
    addLocalSongs,
    themeColors,
    hapticFeedback,
    cachedTracks,
    removeCachedSong,
    clearOfflineCache,
    storageEstimate,
    setIsRiplayImportOpen,
    importedArtists,
    importedAlbums,
    savedArtists,
    toggleFollowArtist,
    isArtistFollowed,
    savedAlbums,
    toggleSaveAlbum,
    isAlbumSaved,
    addPlaylistToQueue,
    getSongCoverUrl,
  } = useMusic();

  const [activeSubTab, setActiveSubTab] = useState<
    'playlists' | 'cached' | 'artists' | 'albums' | 'history' | 'local' | 'blacklist'
  >('playlists');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useBackHandler(showCreateModal, () => setShowCreateModal(false));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createPlaylist(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  // Combine Saved + Imported Artists
  const allArtists = useMemo(() => {
    const map = new Map<string, Artist>();
    savedArtists.forEach((a) => map.set(a.id, a));
    importedArtists.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [savedArtists, importedArtists]);

  // Combine Saved + Imported Albums
  const allAlbums = useMemo(() => {
    const map = new Map<string, Album>();
    savedAlbums.forEach((a) => map.set(a.id, a));
    importedAlbums.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [savedAlbums, importedAlbums]);

  // Handle local MP3 file import from Android device storage
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedSongs: Song[] = [];

    Array.from(files).forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      const parts = cleanName.split(' - ');
      const artist = parts.length > 1 ? parts[0].trim() : 'Local Audio';
      const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanName;

      importedSongs.push({
        id: `local-${Date.now()}-${index}`,
        title,
        artist,
        duration: 180,
        thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        source: 'local',
        streamUrl: url,
        year: new Date().getFullYear(),
        genre: 'Device Audio',
      });
    });

    addLocalSongs(importedSongs);
    if (importedSongs.length > 0) {
      playSong(importedSongs[0], importedSongs);
    }
  };

  const handleExportSingleTrack = (record: any) => {
    hapticFeedback();
    if (!record.audioBlob || record.audioBlob.size < 1000) {
      alert('Audio file is still buffering or not yet saved. Play the song while online to cache its full audio.');
      return;
    }
    const url = URL.createObjectURL(record.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = `${record.song.artist} - ${record.song.title}`.replace(/[/\\?%*:|"<>]/g, '_');
    a.download = `${cleanName}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-5">
      {/* Sub-tab navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'playlists', label: 'Playlists', icon: ListPlus },
          { id: 'cached', label: `Cached (${cachedTracks.length})`, icon: DownloadCloud },
          { id: 'artists', label: `Artists (${allArtists.length})`, icon: Users },
          { id: 'albums', label: `Albums (${allAlbums.length})`, icon: Disc },
          { id: 'history', label: 'History', icon: History },
          { id: 'local', label: 'Local Files', icon: HardDrive },
          { id: 'blacklist', label: 'Blacklist', icon: Ban },
        ].map(({ id, label, icon: Icon }) => {
          const isActive = activeSubTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                hapticFeedback();
                setActiveSubTab(id as any);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition ${
                isActive ? 'text-white shadow-md' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
              style={{ backgroundColor: isActive ? themeColors.accent : undefined }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* 1. PLAYLISTS SUBTAB */}
      {activeSubTab === 'playlists' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Your Playlists</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  hapticFeedback();
                  setIsRiplayImportOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition active:scale-95 border border-white/5"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Import .db</span>
              </button>

              <button
                onClick={() => {
                  hapticFeedback();
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95"
                style={{ backgroundColor: themeColors.accent }}
              >
                <Plus className="w-4 h-4" /> New
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Pinned Liked Songs Card */}
            <div
              onClick={() => {
                hapticFeedback();
                setSelectedPlaylist({
                  id: 'pl-liked-songs',
                  title: 'Liked Songs',
                  description: 'Your favorite tracks',
                  coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
                  color: themeColors.accent,
                  songs: likedSongs,
                  createdAt: Date.now(),
                });
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent border border-rose-500/30 hover:bg-rose-500/25 transition cursor-pointer group shadow-md"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg"
                  style={{ backgroundColor: themeColors.accent }}
                >
                  <FolderHeart className="w-6 h-6 fill-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-white">❤️ Liked Songs</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full">
                      Pinned
                    </span>
                  </div>
                  <div className="text-xs opacity-60 truncate mt-0.5">
                    {likedSongs.length} favorite tracks
                  </div>
                </div>
              </div>
              <Play className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition text-white shrink-0" />
            </div>

            {/* Custom & SQLite Imported Playlists */}
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  hapticFeedback();
                  setSelectedPlaylist(pl);
                }}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                    <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{pl.title}</div>
                    <div className="text-xs opacity-50 truncate mt-0.5">
                      {pl.songs.length} tracks • {pl.description || 'Playlist'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      hapticFeedback();
                      addPlaylistToQueue(pl, 'append');
                    }}
                    className="p-2 opacity-50 hover:opacity-100 hover:text-emerald-400 hover:bg-white/10 transition rounded-xl"
                    title="Add playlist to queue"
                  >
                    <ListPlus className="w-4 h-4 text-emerald-400" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete playlist "${pl.title}"?`)) {
                        deletePlaylist(pl.id);
                      }
                    }}
                    className="p-2 opacity-30 hover:opacity-100 hover:text-red-400 transition"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. CACHED OFFLINE SONGS SUBTAB */}
      {activeSubTab === 'cached' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Offline Available Songs ({cachedTracks.length})
              </h2>
              <p className="text-xs opacity-50 mt-0.5">
                Saved on this device (IndexedDB) • {(storageEstimate.totalBytes / (1024 * 1024)).toFixed(1)} MB used
              </p>
            </div>
            {cachedTracks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playSong(cachedTracks[0].song, cachedTracks.map((c) => c.song))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95"
                  style={{ backgroundColor: themeColors.accent }}
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Play Offline
                </button>
              </div>
            )}
          </div>

          {cachedTracks.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl space-y-2">
              <DownloadCloud className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
              <div className="font-bold text-white">No cached tracks yet</div>
              <p>Songs you listen to are automatically saved here for offline playback. You can also tap the download icon on any song to save it instantly.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cachedTracks.map((record) => {
                const song = record.song;
                const sizeMb = (record.sizeBytes / (1024 * 1024)).toFixed(1);
                const hasValidAudio = !!(record.audioBlob && record.audioBlob.size > 1000);
                return (
                  <SwipeableSongRow key={song.id} song={song}>
                    <div
                      onClick={() => playSong(song, cachedTracks.map((c) => c.song))}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-emerald-500/10 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                          <img src={getSongCoverUrl(song)} alt={song.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Play className="w-4 h-4 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold truncate leading-tight">{song.title}</div>
                            {hasValidAudio ? (
                              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Offline
                              </span>
                            ) : (
                              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Syncing Audio...
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-60 truncate mt-0.5">
                            {song.artist} • {sizeMb} MB
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleExportSingleTrack(record)}
                          className="p-2 opacity-50 hover:opacity-100 hover:text-emerald-400 transition"
                          title="Download MP3 file to device / SD card"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeCachedSong(song.id)}
                          className="p-2 opacity-40 hover:opacity-100 hover:text-red-400 transition"
                          title="Delete from offline storage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </SwipeableSongRow>
                );
              })}
            </div>
          )}

          {cachedTracks.length > 0 && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  if (confirm('Clear all cached songs from device storage?')) {
                    clearOfflineCache();
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All Cached Music
              </button>
            </div>
          )}
        </section>
      )}

      {/* 3. ARTISTS SUBTAB */}
      {activeSubTab === 'artists' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Artists ({allArtists.length})</span>
            </h2>
            {savedArtists.length > 0 && (
              <span className="text-xs text-purple-300 font-semibold bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                {savedArtists.length} Followed
              </span>
            )}
          </div>

          {allArtists.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl">
              No artists found. Search for artists and tap "Follow" to save them to your library for fast access.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {allArtists.map((artist) => {
                const followed = isArtistFollowed(artist.id);
                return (
                  <div
                    key={artist.id}
                    onClick={() => {
                      hapticFeedback();
                      setSelectedArtist(artist);
                      setSelectedArtistId(artist.id);
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer border border-white/5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow-md border border-white/10 group-hover:scale-105 transition">
                        <img src={artist.thumbnailUrl} alt={artist.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate text-white leading-tight">{artist.name}</div>
                        <div className="text-[10px] opacity-50 truncate mt-0.5">
                          {typeof artist.subscribers === 'string'
                            ? artist.subscribers
                            : (artist.subscribers as any)?.text || 'Artist'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFollowArtist(artist);
                      }}
                      className={`p-1.5 rounded-full transition shrink-0 ml-1 ${
                        followed
                          ? 'text-emerald-400 bg-emerald-500/10 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                      title={followed ? 'Unfollow artist' : 'Follow artist'}
                    >
                      {followed ? <Check className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. ALBUMS SUBTAB */}
      {activeSubTab === 'albums' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Disc className="w-4 h-4 text-cyan-400" />
              <span>Albums ({allAlbums.length})</span>
            </h2>
            {savedAlbums.length > 0 && (
              <span className="text-xs text-cyan-300 font-semibold bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                {savedAlbums.length} Saved
              </span>
            )}
          </div>

          {allAlbums.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl">
              No saved albums yet. Search for albums and tap "Save" to keep them in your library.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {allAlbums.map((album) => {
                const saved = isAlbumSaved(album.id);
                return (
                  <div
                    key={album.id}
                    onClick={() => {
                      hapticFeedback();
                      setSelectedAlbum(album);
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer border border-white/5 space-y-2 group relative"
                  >
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg">
                      <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <Play className="w-6 h-6 fill-white text-white" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveAlbum(album);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition ${
                          saved
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-black/40 text-white/70 hover:text-white hover:bg-black/60'
                        }`}
                        title={saved ? 'Remove album from Library' : 'Save album to Library'}
                      >
                        {saved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div>
                      <div className="text-xs font-bold truncate text-white leading-tight">{album.title}</div>
                      <div className="text-[10px] opacity-60 truncate mt-0.5">{album.artist} • {album.year || 'Album'}</div>
                      <div className="text-[9px] opacity-40">{album.songs.length} tracks</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 5. HISTORY SUBTAB */}
      {activeSubTab === 'history' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Recently Played ({history.length})</h2>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-red-400 hover:text-red-300 font-semibold"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {history.map((song, i) => (
              <SwipeableSongRow key={`${song.id}-${i}`} song={song}>
                <div
                  onClick={() => playSong(song, history)}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      <img src={getSongCoverUrl(song)} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{song.title}</div>
                      <div className="text-xs opacity-60 truncate">{song.artist}</div>
                    </div>
                  </div>
                  <Play className="w-4 h-4 opacity-40 shrink-0" />
                </div>
              </SwipeableSongRow>
            ))}
          </div>
        </section>
      )}

      {/* 6. LOCAL FILES SUBTAB */}
      {activeSubTab === 'local' && (
        <section className="space-y-4">
          <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center space-y-3">
            <div
              className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg"
              style={{ backgroundColor: themeColors.accent }}
            >
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Play Local Audio Files</h3>
              <p className="text-xs opacity-60 max-w-xs mx-auto mt-1">
                Select MP3, FLAC, M4A, or WAV tracks from your phone or device to play them offline inside Muzika.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.m4a,.wav,.flac"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-md transition active:scale-95"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Upload className="w-4 h-4" /> Choose Audio Files from Device
            </button>
          </div>
        </section>
      )}

      {/* 7. BLACKLIST SUBTAB */}
      {activeSubTab === 'blacklist' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Blacklist Manager</h2>
              <p className="text-xs opacity-50">Blacklisted songs and artists are automatically skipped.</p>
            </div>
          </div>

          {blacklist.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl">
              No blacklisted items. You can blacklist any song from the player options menu.
            </div>
          ) : (
            <div className="space-y-2">
              {blacklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <Ban className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="text-xs font-bold">{item.name}</div>
                      <div className="text-[10px] opacity-50 uppercase">{item.type}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromBlacklist(item.id)}
                    className="text-xs px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white/80"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 border border-white/10"
            style={{ backgroundColor: themeColors.background1 }}
          >
            <h3 className="text-base font-bold">New Playlist</h3>
            <div>
              <label className="text-xs opacity-60 block mb-1">Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="My Favorites 2024"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Late night driving tunes..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: themeColors.accent }}
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
