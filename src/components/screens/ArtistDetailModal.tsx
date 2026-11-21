import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { ArrowLeft, Play, Users, Heart, UserPlus, Check, Loader2, Music } from 'lucide-react';
import { OnlineMusicService } from '../../services/onlineMusicService';
import { riplaySyncStore } from '../../services/riplaySyncStore';
import { Song } from '../../types/music';
import { SwipeableSongRow } from '../common/SwipeableSongRow';
import { PlayingBars, isSameSong } from '../common/PlayingBars';

export const ArtistDetailModal: React.FC = () => {
  const {
    selectedArtistId,
    setSelectedArtistId,
    selectedArtist,
    setSelectedArtist,
    currentSong,
    isPlaying,
    playSong,
    themeColors,
    toggleLike,
    isLiked,
    hapticFeedback,
    importedArtists,
    savedArtists,
    toggleFollowArtist,
    isArtistFollowed,
    updateArtistTracks,
    getSongCoverUrl,
  } = useMusic();

  const [topSongs, setTopSongs] = useState<Song[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  // Determine freshest artist entity from saved/imported store or selection
  const targetId = selectedArtist?.id || selectedArtistId;
  const artist =
    (targetId ? savedArtists.find((a) => a.id === targetId) : undefined) ||
    (targetId ? importedArtists.find((a) => a.id === targetId) : undefined) ||
    selectedArtist;

  useEffect(() => {
    if (!artist) {
      setTopSongs([]);
      return;
    }

    if (artist.topSongs && artist.topSongs.length > 0) {
      setTopSongs(artist.topSongs);
      setIsLoadingSongs(false);
      // Mirror to IndexedDB so it stays available offline across sessions
      riplaySyncStore
        .saveArtistTracks(artist.id, {
          topSongs: artist.topSongs,
          bannerUrl: artist.bannerUrl,
          subscribers: artist.subscribers,
          bio: artist.bio,
        })
        .catch(() => {});
      return;
    }

    let isMounted = true;
    setIsLoadingSongs(true);

    (async () => {
      try {
        // 1. Check durable IndexedDB tracklist cache first (works 100% offline!)
        const cached = await riplaySyncStore.getArtistTracks(artist.id);
        if (cached?.topSongs && cached.topSongs.length > 0) {
          if (isMounted) {
            setTopSongs(cached.topSongs);
            setIsLoadingSongs(false);
            updateArtistTracks(artist.id, cached.topSongs, {
              bannerUrl: cached.bannerUrl,
              subscribers: cached.subscribers,
              bio: cached.bio,
            });
          }
          return;
        }

        // 2. If offline and not yet cached, don't hang waiting for network
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (isMounted) setIsLoadingSongs(false);
          return;
        }

        // 3. Fetch verified songs from YouTube Music & persist them immediately
        const data = await OnlineMusicService.fetchArtistTopSongs(artist.id);
        const fetched = data?.topSongs || [];
        if (isMounted) {
          setTopSongs(fetched);
          setIsLoadingSongs(false);
        }
        if (fetched.length > 0) {
          await riplaySyncStore.saveArtistTracks(artist.id, {
            topSongs: fetched,
            bannerUrl: data.bannerUrl || artist.bannerUrl,
            subscribers: artist.subscribers,
            bio: artist.bio,
          });
          updateArtistTracks(artist.id, fetched, {
            bannerUrl: data.bannerUrl || artist.bannerUrl,
            subscribers: artist.subscribers,
            bio: artist.bio,
          });
        }
      } catch {
        if (isMounted) setIsLoadingSongs(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [artist?.id]);

  if (!selectedArtistId && !selectedArtist) return null;
  if (!artist) return null;

  const currentTopSongs =
    topSongs.length > 0 ? topSongs : artist.topSongs || [];
  const isFollowed = isArtistFollowed(artist.id);

  const handleBack = () => {
    hapticFeedback();
    setSelectedArtistId(null);
    setSelectedArtist(null);
  };

  const handleToggleFollowWithSongs = () => {
    toggleFollowArtist({
      ...artist,
      topSongs: currentTopSongs,
    });
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
          onClick={handleToggleFollowWithSongs}
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
            {currentTopSongs.length > 0 && (
              <button
                onClick={() => {
                  hapticFeedback();
                  playSong(currentTopSongs[0], currentTopSongs);
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
          ) : currentTopSongs.length > 0 ? (
            <div className="space-y-1.5">
              {currentTopSongs.map((song, idx) => {
                const liked = isLiked(song.id);
                const isCurrent = isSameSong(currentSong, song);
                return (
                  <SwipeableSongRow key={song.id} song={song}>
                    <div
                      onClick={() => {
                        hapticFeedback();
                        playSong(song, currentTopSongs);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer group active:scale-[0.99] ${
                        isCurrent ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-4 flex items-center justify-center shrink-0">
                          {isCurrent ? (
                            <PlayingBars accentColor={themeColors.accent} isPlaying={isPlaying} size="sm" />
                          ) : (
                            <span className="text-xs font-mono opacity-40 text-center">{idx + 1}</span>
                          )}
                        </div>
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow">
                          <img src={getSongCoverUrl(song)} alt={song.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Play className="w-4 h-4 fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-sm truncate leading-tight ${
                              isCurrent ? 'font-bold' : 'font-semibold text-white'
                            }`}
                            style={{ color: isCurrent ? themeColors.accent : undefined }}
                          >
                            {song.title}
                          </div>
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
              <span>
                {typeof navigator !== 'undefined' && !navigator.onLine
                  ? 'You are offline and this artist tracklist has not been cached yet.'
                  : 'No songs available for this artist yet.'}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
