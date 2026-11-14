import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { ArrowLeft, Play, Shuffle, Disc, Heart, CheckCircle2, Bookmark, Check, Loader2, DownloadCloud, ListPlus, ListOrdered, ListVideo, X } from 'lucide-react';
import { OnlineMusicService } from '../../services/onlineMusicService';
import { Song } from '../../types/music';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

export const AlbumDetailModal: React.FC = () => {
  const {
    selectedAlbum,
    setSelectedAlbum,
    playSong,
    themeColors,
    toggleLike,
    isLiked,
    hapticFeedback,
    isSongCached,
    isSongCaching,
    cacheSong,
    removeCachedSong,
    batchCacheState,
    cacheSongsBatch,
    cancelBatchCache,
    toggleSaveAlbum,
    isAlbumSaved,
    addPlaylistToQueue,
    getSongCoverUrl,
  } = useMusic();

  const [fetchedSongs, setFetchedSongs] = useState<Song[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [showQueueOptions, setShowQueueOptions] = useState(false);

  useEffect(() => {
    if (!selectedAlbum) {
      setFetchedSongs([]);
      return;
    }

    if (selectedAlbum.songs && selectedAlbum.songs.length > 0) {
      setFetchedSongs(selectedAlbum.songs);
      setIsLoadingTracks(false);
      return;
    }

    // Fetch verified YouTube Music album tracks dynamically
    let isMounted = true;
    setIsLoadingTracks(true);
    OnlineMusicService.fetchAlbumTracks(selectedAlbum.id)
      .then((songs) => {
        if (isMounted) {
          setFetchedSongs(songs);
          setIsLoadingTracks(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingTracks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAlbum?.id]);

  if (!selectedAlbum) return null;

  const currentSongs = fetchedSongs.length > 0 ? fetchedSongs : selectedAlbum.songs;
  const saved = isAlbumSaved(selectedAlbum.id);
  const totalDuration = currentSongs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const totalMins = Math.floor(totalDuration / 60);

  const handleBack = () => {
    hapticFeedback();
    setSelectedAlbum(null);
  };

  const handlePlayAll = (shuffle = false) => {
    hapticFeedback();
    if (currentSongs.length === 0) return;
    const list = shuffle ? [...currentSongs].sort(() => Math.random() - 0.5) : currentSongs;
    playSong(list[0], list);
  };

  const handleToggleCache = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
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
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={handleBack}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold truncate">{selectedAlbum.title}</span>
        </div>

        <button
          onClick={() => toggleSaveAlbum(selectedAlbum)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            saved
              ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              : 'text-white shadow-md active:scale-95'
          }`}
          style={{ backgroundColor: !saved ? themeColors.accent : undefined }}
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save</span>
            </>
          )}
        </button>
      </div>

      <div className="px-4 max-w-md mx-auto w-full pt-4 space-y-6">
        {/* Album Header Banner */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative w-44 h-44 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
            <img
              src={selectedAlbum.coverUrl}
              alt={selectedAlbum.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          <div className="space-y-1 max-w-xs">
            <h1 className="text-xl font-black text-white leading-tight">{selectedAlbum.title}</h1>
            <p className="text-sm font-semibold opacity-75">{selectedAlbum.artist}</p>
            <div className="text-xs opacity-50 flex items-center justify-center gap-2 pt-1">
              <span>{selectedAlbum.year || 'Album'}</span>
              <span>•</span>
              <span>{currentSongs.length} tracks</span>
              {totalMins > 0 && (
                <>
                  <span>•</span>
                  <span>{totalMins} min</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 justify-center">
          <button
            onClick={() => handlePlayAll(false)}
            disabled={currentSongs.length === 0}
            className="flex-1 py-3 px-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: themeColors.accent }}
          >
            <Play className="w-4 h-4 fill-white" /> Play Album
          </button>
          <button
            onClick={() => handlePlayAll(true)}
            disabled={currentSongs.length === 0}
            className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 border border-white/5 disabled:opacity-40"
          >
            <Shuffle className="w-4 h-4" /> Shuffle
          </button>
          <button
            onClick={() => setShowQueueOptions(true)}
            disabled={currentSongs.length === 0}
            className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-white/5 disabled:opacity-40"
          >
            <ListPlus className="w-4 h-4 text-emerald-400" />
            <span>+ Queue</span>
          </button>
          <button
            onClick={() => toggleSaveAlbum(selectedAlbum)}
            className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-white/10 hover:bg-white/15 text-white border-white/5'
            }`}
          >
            {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Bookmark className="w-4 h-4" />}
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
          {currentSongs.length > 0 && (
            batchCacheState?.active && batchCacheState.targetId === selectedAlbum.id ? (
              <button
                onClick={cancelBatchCache}
                className="py-3 px-3 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-amber-500/30"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{batchCacheState.completed + batchCacheState.failed}/{batchCacheState.total}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ) : currentSongs.some((s) => !isSongCached(s.id)) ? (
              <button
                onClick={() => cacheSongsBatch(currentSongs, selectedAlbum.id, selectedAlbum.title)}
                disabled={!!batchCacheState?.active}
                className="py-3 px-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border border-cyan-500/30 disabled:opacity-40"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Cache All</span>
              </button>
            ) : (
              <div className="py-3 px-3 rounded-2xl bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" />
                <span>All Cached</span>
              </div>
            )
          )}
        </div>

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
                <span>Add "{selectedAlbum.title}" to Queue</span>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    addPlaylistToQueue(currentSongs, 'append');
                    setShowQueueOptions(false);
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition active:scale-95"
                >
                  <ListOrdered className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Append to End of Queue</div>
                    <div className="text-[10px] opacity-50">Adds {currentSongs.length} tracks to the bottom</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    addPlaylistToQueue(currentSongs, 'next');
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
                    addPlaylistToQueue(currentSongs, 'replace');
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

        {/* Track List */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider opacity-50 px-1">
            Tracks ({currentSongs.length})
          </div>

          {isLoadingTracks ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-white/50 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Fetching album tracks from YouTube Music...</span>
            </div>
          ) : currentSongs.length > 0 ? (
            <div className="space-y-1.5">
              {currentSongs.map((song, idx) => {
                const liked = isLiked(song.id);
                const cached = isSongCached(song.id);
                const isCaching = isSongCaching(song.id);
                return (
                  <SwipeableSongRow key={song.id} song={song}>
                    <div
                      onClick={() => {
                        hapticFeedback();
                        playSong(song, currentSongs);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xs font-mono font-bold w-4 text-center opacity-40">
                          {idx + 1}
                        </span>
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                          <img
                            src={getSongCoverUrl(song) || selectedAlbum.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Play className="w-4 h-4 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-semibold truncate leading-tight text-white">
                              {song.title}
                            </div>
                            {cached && (
                              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs opacity-60 truncate mt-0.5">{song.artist}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Offline Cache Download Button */}
                        <button
                          onClick={(e) => handleToggleCache(e, song)}
                          disabled={isCaching}
                          className={`p-1.5 rounded-full transition ${
                            cached
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : isCaching
                              ? 'text-cyan-400 bg-cyan-500/10'
                              : 'text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                          title={isCaching ? 'Downloading...' : cached ? 'Cached Offline (Click to remove)' : 'Save for offline'}
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
                          onClick={() => toggleLike(song)}
                          className="p-1.5 rounded-full hover:bg-white/10 transition"
                        >
                          <Heart
                            className={`w-4 h-4 transition ${
                              liked ? 'fill-rose-500 text-rose-500' : 'text-white/40'
                            }`}
                          />
                        </button>
                        <span className="text-xs font-mono opacity-40 min-w-[32px] text-right">
                          {Math.floor((song.duration || 180) / 60)}:
                          {((song.duration || 180) % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </SwipeableSongRow>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl flex flex-col items-center">
              <Disc className="w-8 h-8 mb-2 opacity-30" />
              <span>No tracks found for this album.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
