import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { ArrowLeft, Play, Users, Heart, UserPlus, Check, Loader2, Music } from 'lucide-react';
import { OnlineMusicService } from '../../services/onlineMusicService';
import { Song } from '../../types/music';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

export const ArtistDetailModal: React.FC = () => {
  const {
    selectedArtistId,
    setSelectedArtistId,
    selectedArtist,
    setSelectedArtist,
    playSong,
    themeColors,
    toggleLike,
    isLiked,
    hapticFeedback,
    importedArtists,
    savedArtists,
    toggleFollowArtist,
    isArtistFollowed,
  } = useMusic();

  const [topSongs, setTopSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  // Determine artist entity from context or storage
  const artist =
    selectedArtist ||
    savedArtists.find((a) => a.id === selectedArtistId) ||
    importedArtists.find((a) => a.id === selectedArtistId);

  useEffect(() => {
    if (!artist) {
      setTopSongs([]);
      return;
    }

    if (artist.topSongs && artist.topSongs.length > 0) {
      setTopSongs(artist.topSongs);
      setIsLoadingSongs(false);
      return;
    }

    // If top songs list is empty, fetch verified songs dynamically from YouTube Music
    let isMounted = true;
    setIsLoadingSongs(true);
    OnlineMusicService.fetchArtistTopSongs(artist.id)
      .then((data) => {
        if (isMounted) {
          setTopSongs(data.topSongs || []);
          setIsLoadingSongs(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingSongs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [artist?.id]);

  if (!selectedArtistId && !selectedArtist) return null;
  if (!artist) return null;

  const isFollowed = isArtistFollowed(artist.id);

  const handleBack = () => {
    hapticFeedback();
    setSelectedArtistId(null);
    setSelectedArtist(null);
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
          <span className="text-sm font-bold truncate">{artist.name}</span>
        </div>

        <button
          onClick={() => toggleFollowArtist(artist)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            isFollowed
              ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              : 'text-white shadow-md active:scale-95'
          }`}
          style={{ backgroundColor: !isFollowed ? themeColors.accent : undefined }}
        >
          {isFollowed ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Follow</span>
            </>
          )}
        </button>
      </div>

      <div className="px-4 max-w-md mx-auto w-full pt-2 space-y-5">
        {/* Banner & Avatar */}
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
          <div className="h-36 w-full overflow-hidden relative">
            <img
              src={artist.bannerUrl || artist.thumbnailUrl}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>

          <div className="p-4 pt-0 -mt-10 relative z-10 flex items-end gap-3">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl shrink-0">
              <img src={artist.thumbnailUrl} alt={artist.name} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-xl font-black truncate">{artist.name}</h1>
              <div className="flex items-center gap-1.5 text-xs opacity-60">
                <Users className="w-3.5 h-3.5" />
                <span>
                  {typeof artist.subscribers === 'string'
                    ? artist.subscribers
                    : (artist.subscribers as any)?.text || 'Artist'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {artist.bio && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs opacity-75 leading-relaxed">
            {artist.bio}
          </div>
        )}

        {/* Top Songs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Popular Songs</h2>
            {topSongs.length > 0 && (
              <button
                onClick={() => {
                  hapticFeedback();
                  playSong(topSongs[0], topSongs);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition"
                style={{ backgroundColor: themeColors.accent }}
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Play All
              </button>
            )}
          </div>

          {isLoadingSongs ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-white/50 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span>Loading top songs from YouTube Music...</span>
            </div>
          ) : topSongs.length > 0 ? (
            <div className="space-y-1.5">
              {topSongs.map((song, idx) => {
                const liked = isLiked(song.id);
                return (
                  <SwipeableSongRow key={song.id} song={song}>
                    <div
                      onClick={() => {
                        hapticFeedback();
                        playSong(song, topSongs);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xs font-mono opacity-40 w-4 text-center">{idx + 1}</span>
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow">
                          <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Play className="w-4 h-4 fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate leading-tight text-white">{song.title}</div>
                          <div className="text-xs opacity-60 truncate mt-0.5">{song.album || artist.name}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleLike(song)}
                          className="p-2 rounded-full hover:bg-white/10 transition"
                        >
                          <Heart
                            className={`w-4 h-4 transition ${
                              liked ? 'fill-rose-500 text-rose-500' : 'text-white/40'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </SwipeableSongRow>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl flex flex-col items-center">
              <Music className="w-8 h-8 mb-2 opacity-30" />
              <span>No songs available for this artist yet.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
