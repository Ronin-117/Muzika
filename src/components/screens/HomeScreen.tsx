import React, { useState, useEffect, useMemo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { MOOD_CATEGORIES } from '../../data/mockCatalog';
import { Play, Sparkles, Flame, Smartphone, Heart, ChevronRight, CheckCircle2, Loader2, Music, ListPlus, Plus, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Song, Artist } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

export const HomeScreen: React.FC = () => {
  const {
    playSong,
    currentSong,
    isPlaying,
    toggleLike,
    isLiked,
    playlists,
    setSelectedPlaylist,
    setSelectedArtistId,
    setSelectedArtist,
    setIsPWAInstallModalOpen,
    setActiveTab,
    themeColors,
    hapticFeedback,
    isSongCached,
    likedSongs,
    history,
    cachedTracks,
    importedArtists,
    savedArtists,
    setSongOptionsMenuTarget,
  } = useMusic();
  const { isInstalled } = usePWAInstall();

  const [trendingTracks, setTrendingTracks] = useState<Song[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [topEnglishArtists, setTopEnglishArtists] = useState<Artist[]>([]);

  // Fetch live English trending music & top artists on mount
  useEffect(() => {
    let isMounted = true;
    const loadHomeContent = async () => {
      setLoadingTrending(true);
      try {
        const [hits, artists] = await Promise.all([
          OnlineMusicService.searchOnlineMusic('Trending English Music Hits 2025', 12),
          OnlineMusicService.searchOnlineArtists('Top English Artists', 8),
        ]);
        if (isMounted) {
          if (hits && hits.length > 0) setTrendingTracks(hits);
          if (artists && artists.length > 0) setTopEnglishArtists(artists);
        }
      } catch (err) {
        console.warn('Failed to load online home content:', err);
      } finally {
        if (isMounted) setLoadingTrending(false);
      }
    };
    loadHomeContent();
    return () => {
      isMounted = false;
    };
  }, []);

  // Quick Picks: user's liked/history/cached songs if available, else top trending songs
  const quickPickSongs = useMemo(() => {
    const map = new Map<string, Song>();
    likedSongs.forEach((s) => map.set(s.id, s));
    history.forEach((s) => map.set(s.id, s));
    cachedTracks.forEach((c) => map.set(c.song.id, c.song));
    const userTracks = Array.from(map.values());
    if (userTracks.length > 0) {
      return userTracks.slice(0, 4);
    }
    return trendingTracks.slice(0, 4);
  }, [likedSongs, history, cachedTracks, trendingTracks]);

  // Combine top artists (saved + imported + live online english artists)
  const combinedArtists = useMemo(() => {
    const map = new Map<string, Artist>();
    savedArtists.forEach((a) => map.set(a.id, a));
    importedArtists.forEach((a) => map.set(a.id, a));
    topEnglishArtists.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [savedArtists, importedArtists, topEnglishArtists]);

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-6">
      {/* Android Mobile Install Hero Banner (if not installed) */}
      {!isInstalled && (
        <div
          onClick={() => {
            hapticFeedback();
            setIsPWAInstallModalOpen(true);
          }}
          className="p-4 rounded-3xl bg-gradient-to-r from-orange-600/30 via-amber-600/20 to-transparent border border-orange-500/30 flex items-center justify-between cursor-pointer shadow-lg hover:border-orange-500/50 transition group"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-orange-400">Android App Ready</div>
              <div className="text-sm font-extrabold text-white">Install Muzika APK on Phone</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 opacity-60 group-hover:translate-x-1 transition" />
        </div>
      )}

      {/* Mood & Genre Quick Chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" style={{ color: themeColors.accent }} />
            Moods & Genres
          </h2>
          <button
            onClick={() => setActiveTab('explore')}
            className="text-xs opacity-60 hover:opacity-100 flex items-center gap-0.5"
          >
            All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MOOD_CATEGORIES.slice(0, 5).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                hapticFeedback();
                setActiveTab('explore');
              }}
              className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 active:scale-95"
            >
              <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${m.color}`} />
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* Quick Picks / Jump Back In */}
      {quickPickSongs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-1.5">
              <Flame className="w-4 h-4" style={{ color: themeColors.accent }} />
              Quick Picks
            </h2>
            <span className="text-xs opacity-50">Based on your tastes</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickPickSongs.map((song) => {
              const isThisPlaying = currentSong?.id === song.id && isPlaying;
              return (
                <SwipeableSongRow key={song.id} song={song}>
                  <div
                    onClick={() => playSong(song, quickPickSongs)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer flex items-center gap-2.5 group relative overflow-hidden"
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition flex items-center justify-center">
                        <Play
                          className={`w-5 h-5 fill-white text-white transition transform ${
                            isThisPlaying ? 'scale-110 opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate leading-tight">{song.title}</div>
                      <div className="text-[11px] opacity-60 truncate mt-0.5">{song.artist}</div>
                    </div>
                  </div>
                </SwipeableSongRow>
              );
            })}
          </div>
        </section>
      )}

      {/* User Playlists Carousel */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Your Playlists</h2>
          <button
            onClick={() => setActiveTab('library')}
            className="text-xs opacity-60 hover:opacity-100 flex items-center gap-0.5"
          >
            Library <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {playlists.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => {
                  hapticFeedback();
                  setSelectedPlaylist(pl);
                }}
                className="w-36 shrink-0 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 p-2.5 cursor-pointer group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 shadow-md">
                  <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pl.songs.length > 0) playSong(pl.songs[0], pl.songs);
                    }}
                    className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition transform scale-90 group-hover:scale-100"
                    style={{ backgroundColor: themeColors.accent }}
                  >
                    <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                  </button>
                </div>

                <div className="text-xs font-bold truncate">{pl.title}</div>
                <div className="text-[10px] opacity-50 truncate mt-0.5">{pl.songs.length} tracks</div>
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
                <ListPlus className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">No Saved Playlists</div>
                <div className="text-[11px] opacity-60">Tap to create your first playlist or import .db</div>
              </div>
            </div>
            <Plus className="w-5 h-5 opacity-50 group-hover:opacity-100 transition" />
          </div>
        )}
      </section>

      {/* Global Trending Tracks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Trending English Music</span>
          </h2>
          {loadingTrending && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
        </div>

        {trendingTracks.length > 0 ? (
          <div className="space-y-2">
            {trendingTracks.map((song, idx) => {
              const isThisPlaying = currentSong?.id === song.id && isPlaying;
              const liked = isLiked(song.id);
              return (
                <SwipeableSongRow key={song.id} song={song}>
                  <div
                    onClick={() => playSong(song, trendingTracks)}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs font-mono font-bold w-4 text-center opacity-40">
                        {idx + 1}
                      </span>
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 flex items-center justify-center transition">
                          <Play
                            className={`w-5 h-5 fill-white text-white ${
                              isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`text-sm font-semibold truncate ${
                              currentSong?.id === song.id ? 'text-orange-400' : ''
                            }`}
                            style={{ color: currentSong?.id === song.id ? themeColors.accent : undefined }}
                          >
                            {song.title}
                          </div>
                          {isSongCached(song.id) && (
                            <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Offline
                            </span>
                          )}
                        </div>
                        <div className="text-xs opacity-60 truncate mt-0.5">{song.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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

                      <button
                        onClick={() => {
                          hapticFeedback();
                          setSongOptionsMenuTarget({ song });
                        }}
                        className="p-1.5 rounded-full hover:bg-white/10 transition text-white/40 hover:text-white"
                        title="Song options & Add to Playlist"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </SwipeableSongRow>
              );
            })}
          </div>
        ) : (
          !loadingTrending && (
            <div className="p-8 text-center text-xs opacity-50 bg-white/5 rounded-2xl flex flex-col items-center">
              <Music className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
              <span>Use the Search tab above to find and stream any song, artist, or album.</span>
            </div>
          )
        )}
      </section>

      {/* Top Artists */}
      {combinedArtists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Top Artists</h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {combinedArtists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => {
                  hapticFeedback();
                  setSelectedArtist(artist);
                  setSelectedArtistId(artist.id);
                }}
                className="flex flex-col items-center w-24 shrink-0 cursor-pointer group"
              >
                <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg border-2 border-white/10 group-hover:border-white/40 transition mb-2">
                  <img
                    src={artist.thumbnailUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                </div>
                <span className="text-xs font-semibold text-center truncate w-full">
                  {artist.name}
                </span>
                <span className="text-[10px] opacity-50 text-center">Artist</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
