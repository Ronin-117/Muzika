import React, { useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import {
  Play,
  Shuffle,
  ArrowLeft,
  Trash2,
  Clock,
  Music,
  CheckCircle2,
  DownloadCloud,
  ListPlus,
  ListVideo,
  ListOrdered,
  Layers,
  MoreVertical,
  Loader2,
  X,
} from 'lucide-react';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

export const PlaylistDetailModal: React.FC = () => {
  const {
    selectedPlaylist,
    setSelectedPlaylist,
    playSong,
    removeFromPlaylist,
    themeColors,
    hapticFeedback,
    isSongCached,
    isSongCaching,
    cacheSong,
    removeCachedSong,
    batchCacheState,
    cacheSongsBatch,
    cancelBatchCache,
    addPlaylistToQueue,
    setSongOptionsMenuTarget,
  } = useMusic();

  const [onlyOffline, setOnlyOffline] = useState(false);
  const [showQueueOptions, setShowQueueOptions] = useState(false);

  if (!selectedPlaylist) return null;

  const totalDuration = selectedPlaylist.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalMins = Math.floor(totalDuration / 60);

  const cachedSongsInPlaylist = selectedPlaylist.songs.filter((s) => isSongCached(s.id));
  const uncachedCount = selectedPlaylist.songs.length - cachedSongsInPlaylist.length;
  const isBatchCachingThis = !!(batchCacheState?.active && batchCacheState.targetId === selectedPlaylist.id);
  const displayedSongs = onlyOffline ? cachedSongsInPlaylist : selectedPlaylist.songs;

  const handlePlayAll = (shuffle = false, cachedOnly = false) => {
    hapticFeedback();
    const listToPlay = cachedOnly ? cachedSongsInPlaylist : selectedPlaylist.songs;
    if (listToPlay.length === 0) return;
    const list = shuffle ? [...listToPlay].sort(() => Math.random() - 0.5) : listToPlay;
    playSong(list[0], list);
  };

  const handleToggleCache = async (song: any) => {
    hapticFeedback();
    if (isSongCached(song.id)) {
      await removeCachedSong(song.id);
    } else {
      await cacheSong(song);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200 pb-44"
      style={{ backgroundColor: themeColors.background0, color: themeColors.text }}
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 backdrop-blur-md border-b border-white/5">
        <button
          onClick={() => {
            hapticFeedback();
            setSelectedPlaylist(null);
          }}
          className="p-2 rounded-full hover:bg-white/10 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold truncate">Playlist</span>
      </div>

      <div className="px-4 max-w-md mx-auto w-full pt-4 space-y-5">
        {/* Playlist Hero */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-44 h-44 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img
              src={selectedPlaylist.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
              alt={selectedPlaylist.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-black">{selectedPlaylist.title}</h1>
            {selectedPlaylist.description && (
              <p className="text-xs opacity-60 mt-1 max-w-xs">{selectedPlaylist.description}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs opacity-60 mt-1.5 font-medium">
              <span>{selectedPlaylist.songs.length} songs</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {cachedSongsInPlaylist.length} cached offline
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 opacity-60">
                <Clock className="w-3 h-3" /> {totalMins} min
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => handlePlayAll(false, false)}
              disabled={selectedPlaylist.songs.length === 0}
              className="px-5 py-2.5 rounded-full text-white font-bold text-xs flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Play className="w-4 h-4 fill-white" /> Play
            </button>
            <button
              onClick={() => handlePlayAll(true, false)}
              disabled={selectedPlaylist.songs.length === 0}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 disabled:opacity-40"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>

            <button
              onClick={() => setShowQueueOptions(true)}
              disabled={selectedPlaylist.songs.length === 0}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 transition active:scale-95 border border-white/10 disabled:opacity-40"
            >
              <ListPlus className="w-4 h-4 text-emerald-400" /> + Add to Queue
            </button>

            {selectedPlaylist.songs.length > 0 && (
              isBatchCachingThis && batchCacheState ? (
                <button
                  onClick={cancelBatchCache}
                  className="px-4 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border border-amber-500/30"
                  title="Tap to stop batch download"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Caching {batchCacheState.completed + batchCacheState.failed}/{batchCacheState.total}
                  </span>
                  <X className="w-3.5 h-3.5 ml-0.5" />
                </button>
              ) : uncachedCount > 0 ? (
                <button
                  onClick={() => cacheSongsBatch(selectedPlaylist.songs, selectedPlaylist.id, selectedPlaylist.title)}
                  disabled={!!batchCacheState?.active}
                  className="px-4 py-2.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border border-cyan-500/30 disabled:opacity-40"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>Cache All ({uncachedCount})</span>
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All Cached ({cachedSongsInPlaylist.length})</span>
                </div>
              )
            )}

            {cachedSongsInPlaylist.length > 0 && (
              <button
                onClick={() => handlePlayAll(false, true)}
                className="px-4 py-2.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border border-emerald-500/30"
              >
                <CheckCircle2 className="w-4 h-4" /> Play Cached Only ({cachedSongsInPlaylist.length})
              </button>
            )}
          </div>

          {/* Live Batch Cache Progress Bar */}
          {isBatchCachingThis && batchCacheState && (
            <div className="w-full p-3 rounded-2xl bg-white/5 border border-cyan-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading offline tracks ({batchCacheState.completed} saved
                  {batchCacheState.failed > 0 ? `, ${batchCacheState.failed} skipped` : ''})
                </span>
                <span className="font-mono text-white/70">
                  {Math.round(((batchCacheState.completed + batchCacheState.failed) / Math.max(1, batchCacheState.total)) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((batchCacheState.completed + batchCacheState.failed) / Math.max(1, batchCacheState.total)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Add to Queue Options Modal */}
          {showQueueOptions && (
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={() => setShowQueueOptions(false)}
            >
              <div
                className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-black text-sm text-white flex items-center gap-2 pb-2 border-b border-white/10">
                  <ListPlus className="w-4 h-4 text-emerald-400" />
                  <span>Add "{selectedPlaylist.title}" to Queue</span>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      addPlaylistToQueue(selectedPlaylist, 'append');
                      setShowQueueOptions(false);
                    }}
                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition active:scale-95"
                  >
                    <ListOrdered className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Append to End of Queue</div>
                      <div className="text-[10px] opacity-50">Adds {selectedPlaylist.songs.length} tracks to the bottom</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      addPlaylistToQueue(selectedPlaylist, 'next');
                      setShowQueueOptions(false);
                    }}
                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition active:scale-95"
                  >
                    <ListVideo className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Play Next</div>
                      <div className="text-[10px] opacity-50">Inserts tracks right after current playing song</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      addPlaylistToQueue(selectedPlaylist, 'replace');
                      setShowQueueOptions(false);
                    }}
                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition active:scale-95"
                  >
                    <Play className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Replace Current Queue</div>
                      <div className="text-[10px] opacity-50 font-medium">Replaces current queue and starts playing</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Offline filter toggle chips */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setOnlyOffline(false)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                !onlyOffline ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              All Tracks ({selectedPlaylist.songs.length})
            </button>
            <button
              onClick={() => setOnlyOffline(true)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                onlyOffline ? 'bg-emerald-500 text-white' : 'bg-white/5 text-emerald-400 hover:bg-white/10'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" /> Offline Cached ({cachedSongsInPlaylist.length})
            </button>
          </div>
        </div>

        {/* Song List */}
        <div className="space-y-1.5 pt-4 border-t border-white/5">
          {displayedSongs.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-40 bg-white/5 rounded-2xl flex flex-col items-center">
              <Music className="w-8 h-8 mb-2 opacity-30" />
              {onlyOffline
                ? 'No cached offline songs in this playlist yet. Tap the download icon next to any song to save it for offline listening.'
                : 'This playlist is currently empty. Add tracks from Search or Home.'}
            </div>
          ) : (
            displayedSongs.map((song, idx) => {
              const cached = isSongCached(song.id);
              const isCaching = isSongCaching(song.id);
              return (
                <SwipeableSongRow key={`${song.id}-${idx}`} song={song}>
                  <div
                    onClick={() => {
                      hapticFeedback();
                      playSong(song, displayedSongs);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs font-mono opacity-40 w-4 text-center">{idx + 1}</span>
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Play className="w-4 h-4 fill-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-semibold truncate leading-tight">{song.title}</div>
                          {cached && (
                            <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Offline
                            </span>
                          )}
                        </div>
                        <div className="text-xs opacity-60 truncate">{song.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Toggle Cache Button */}
                      <button
                        onClick={() => handleToggleCache(song)}
                        disabled={isCaching}
                        className={`p-1.5 rounded-lg transition ${
                          cached
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : isCaching
                            ? 'text-cyan-400 bg-cyan-500/10'
                            : 'opacity-40 hover:opacity-100 hover:text-white'
                        }`}
                        title={
                          isCaching
                            ? 'Downloading for offline play...'
                            : cached
                            ? 'Available Offline (Click to remove)'
                            : 'Download for offline play'
                        }
                      >
                        {isCaching ? (
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                        ) : cached ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <DownloadCloud className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          hapticFeedback();
                          setSongOptionsMenuTarget({ song });
                        }}
                        className="p-1.5 opacity-40 hover:opacity-100 hover:text-white transition"
                        title="Song options & Add to Playlist"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => removeFromPlaylist(selectedPlaylist.id, song.id)}
                        className="p-1.5 opacity-30 hover:opacity-100 hover:text-red-400 transition"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </SwipeableSongRow>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
