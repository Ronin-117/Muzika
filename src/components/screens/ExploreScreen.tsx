import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { MOOD_CATEGORIES } from '../../data/mockCatalog';
import {
  Compass,
  Music,
  Disc,
  Play,
  Loader2,
  Flame,
  CheckCircle2,
  Download,
  Heart,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { Song } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';

export const ExploreScreen: React.FC = () => {
  const {
    playSong,
    playlists,
    setSelectedPlaylist,
    themeColors,
    hapticFeedback,
    isSongCached,
    cacheSong,
    toggleLike,
    isLiked,
    setActiveTab,
    setSongOptionsMenuTarget,
  } = useMusic();

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [onlineSongs, setOnlineSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cachingId, setCachingId] = useState<string | null>(null);

  // Fetch online charts on load or when mood changes
  useEffect(() => {
    let isMounted = true;
    const fetchCategorySongs = async () => {
      setIsLoading(true);
      try {
        const query = selectedMood ? `${selectedMood} English Hits` : 'Top Worldwide English Hits 2025';
        const tracks = await OnlineMusicService.searchOnlineMusic(query, 25);
        if (isMounted) {
          setOnlineSongs(tracks || []);
        }
      } catch (e) {
        if (isMounted) setOnlineSongs([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCategorySongs();

    return () => {
      isMounted = false;
    };
  }, [selectedMood]);

  const handleCacheTrack = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    hapticFeedback();
    setCachingId(song.id);
    try {
      await cacheSong(song);
    } finally {
      setCachingId(null);
    }
  };

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Compass className="w-5 h-5" style={{ color: themeColors.accent }} />
        <h1 className="text-xl font-black">Explore & Charts</h1>
      </div>

      {/* Moods Grid */}
      <section>
        <h2 className="text-sm font-bold opacity-75 uppercase tracking-wider mb-3">
          Moods & Genres
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {MOOD_CATEGORIES.map((mood) => {
            const isSelected = selectedMood === mood.label;
            return (
              <div
                key={mood.id}
                onClick={() => {
                  hapticFeedback();
                  setSelectedMood(isSelected ? null : mood.label);
                }}
                className={`relative h-20 rounded-2xl p-3 overflow-hidden cursor-pointer transition transform active:scale-95 border ${
                  isSelected ? 'border-white/50 scale-102 ring-2 ring-white/20' : 'border-white/5'
                } bg-gradient-to-br ${mood.color}`}
              >
                <div className="relative z-10 flex flex-col justify-between h-full text-white">
                  <span className="font-extrabold text-sm tracking-tight">{mood.label}</span>
                  <span className="text-[10px] opacity-80">
                    {isSelected ? 'Selected' : 'Tap to explore'}
                  </span>
                </div>
                <Music className="absolute -bottom-2 -right-2 w-14 h-14 text-white/20 -rotate-12 pointer-events-none" />
              </div>
            );
          })}
        </div>
      </section>

      {/* Filtered Songs or Charts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>{selectedMood ? `${selectedMood} Hits` : 'Top Charts Worldwide'}</span>
          </h2>
          {selectedMood && (
            <button
              onClick={() => setSelectedMood(null)}
              className="text-xs text-emerald-400 font-bold hover:underline"
            >
              Reset to Top Charts
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-white/40 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Fetching live charts...</span>
          </div>
        ) : onlineSongs.length > 0 ? (
          <div className="space-y-1.5">
            {onlineSongs.map((song, idx) => {
              const cached = isSongCached(song.id);
              const liked = isLiked(song.id);
              const isCaching = cachingId === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => {
                    hapticFeedback();
                    playSong(song, onlineSongs);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-bold opacity-40 w-4 text-center">
                      {idx + 1}
                    </span>
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Play className="w-5 h-5 fill-white" />
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
                      <div className="text-xs opacity-60 truncate mt-0.5">
                        {song.artist} {song.genre ? `• ${song.genre}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {/* Cache */}
                    <button
                      onClick={(e) => handleCacheTrack(e, song)}
                      className={`p-1.5 rounded-full transition ${
                        cached
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {isCaching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>

                    {/* Like */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback();
                        toggleLike(song);
                      }}
                      className={`p-1.5 rounded-full transition ${
                        liked
                          ? 'text-rose-500 fill-rose-500'
                          : 'text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500' : ''}`} />
                    </button>

                    {/* More Options */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback();
                        setSongOptionsMenuTarget({ song });
                      }}
                      className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                      title="Song options & Add to Playlist"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-mono opacity-40 ml-1 min-w-[32px] text-right">
                      {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl">
            No tracks found for this mood. Try selecting another mood above or search for tracks directly.
          </div>
        )}
      </section>

      {/* Featured User Playlists */}
      <section>
        <h2 className="text-base font-bold mb-3">Your Playlists</h2>
        {playlists.length > 0 ? (
          <div className="space-y-3">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  hapticFeedback();
                  setSelectedPlaylist(pl);
                }}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                    <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{pl.title}</div>
                    <div className="text-xs opacity-60">{pl.songs.length} tracks • {pl.description || 'Playlist'}</div>
                  </div>
                </div>
                <Disc className="w-5 h-5 opacity-40 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => setActiveTab('library')}
            className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition group"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: themeColors.accent }}
              >
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Create Your First Playlist</div>
                <div className="text-[11px] opacity-60">Organize your favorite songs in Library</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
