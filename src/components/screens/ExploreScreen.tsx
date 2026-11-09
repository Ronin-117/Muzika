import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { MOOD_CATEGORIES, INITIAL_PLAYLISTS, INITIAL_SONGS } from '../../data/mockCatalog';
import {
  Compass,
  Music,
  Disc,
  Play,
  Loader2,
  Sparkles,
  Flame,
  CheckCircle2,
  Download,
  Heart,
} from 'lucide-react';
import { Song } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';

export const ExploreScreen: React.FC = () => {
  const {
    playSong,
    setSelectedPlaylist,
    themeColors,
    hapticFeedback,
    isSongCached,
    cacheSong,
    toggleLike,
    isLiked,
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
        const query = selectedMood || 'Top Hits';
        const tracks = await OnlineMusicService.fetchTracksByGenre(query, 25);
        if (isMounted) {
          if (tracks.length > 0) {
            setOnlineSongs(tracks);
          } else {
            // fallback to initial songs if offline
            setOnlineSongs(INITIAL_SONGS);
          }
        }
      } catch (e) {
        if (isMounted) setOnlineSongs(INITIAL_SONGS);
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
        ) : (
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

                    <span className="text-xs font-mono opacity-40 ml-1 min-w-[32px] text-right">
                      {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Featured Curated Playlists */}
      <section>
        <h2 className="text-base font-bold mb-3">Curated Radio & Mixes</h2>
        <div className="space-y-3">
          {INITIAL_PLAYLISTS.map((pl) => (
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
                  <div className="text-xs opacity-60">{pl.description}</div>
                </div>
              </div>
              <Disc className="w-5 h-5 opacity-40 shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
