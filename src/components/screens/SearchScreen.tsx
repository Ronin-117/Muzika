import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { useMusic } from '../../context/MusicContext';
import { MOOD_CATEGORIES } from '../../data/mockCatalog';
import {
  Search,
  X,
  Link as LinkIcon,
  Play,
  Music,
  User,
  Disc,
  History,
  CheckCircle2,
  Heart,
  Plus,
  Download,
  Loader2,
  Sparkles,
  TrendingUp,
  Radio,
  Compass,
  Bookmark,
  Check,
  UserPlus,
  MoreVertical,
} from 'lucide-react';
import { Song, Artist, Album } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';
import { SwipeableSongRow } from '../common/SwipeableSongRow';

const INITIAL_VISIBLE_SONGS = 30;
const INITIAL_VISIBLE_ALBUMS = 12;

export const SearchScreen: React.FC = () => {
  const {
    playSong,
    setSelectedArtistId,
    setSelectedArtist,
    setSelectedPlaylist,
    setSelectedAlbum,
    themeColors,
    hapticFeedback,
    isSongCached,
    isSongCaching,
    getSongCoverUrl,
    cacheSong,
    removeCachedSong,
    likedSongs,
    toggleLike,
    isLiked,
    playlists,
    importedArtists,
    importedAlbums,
    savedAlbums,
    isAlbumSaved,
    toggleSaveAlbum,
    savedArtists,
    isArtistFollowed,
    toggleFollowArtist,
    setSongOptionsMenuTarget,
  } = useMusic();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists'>('all');
  const [directLinkInput, setDirectLinkInput] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<Song[]>([]);
  const [onlineArtists, setOnlineArtists] = useState<Artist[]>([]);
  const [onlineAlbums, setOnlineAlbums] = useState<Album[]>([]);
  const [cachingSongId, setCachingSongId] = useState<string | null>(null);
  const [visibleSongsLimit, setVisibleSongsLimit] = useState(INITIAL_VISIBLE_SONGS);
  const [visibleAlbumsLimit, setVisibleAlbumsLimit] = useState(INITIAL_VISIBLE_ALBUMS);

  const [searchHistory, setSearchHistory] = useState<string[]>([
    'The Weeknd',
    'Coldplay',
    'Taylor Swift',
    'Billie Eilish',
    'Lofi Chill Beats',
  ]);

  const searchDebounceRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Reset pagination caps cleanly whenever query changes
  useEffect(() => {
    setVisibleSongsLimit(INITIAL_VISIBLE_SONGS);
    setVisibleAlbumsLimit(INITIAL_VISIBLE_ALBUMS);
  }, [deferredQuery]);

  // Perform live online music search as user types with AbortController & zero input blocking
  useEffect(() => {
    const trimmed = query.trim();

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    if (trimmed.length < 2) {
      if (!trimmed) {
        setOnlineResults([]);
        setOnlineArtists([]);
        setOnlineAlbums([]);
      }
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchDebounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const [songs, artists, albums] = await Promise.all([
          OnlineMusicService.searchOnlineMusic(trimmed, 30, controller.signal),
          OnlineMusicService.searchOnlineArtists(trimmed, 10, controller.signal),
          OnlineMusicService.searchOnlineAlbums(trimmed, 10, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setOnlineResults(songs);
        setOnlineArtists(artists);
        setOnlineAlbums(albums);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Online search error:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingOnline(false);
        }
      }
    }, 260);

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!searchHistory.includes(query.trim())) {
      setSearchHistory([query.trim(), ...searchHistory.slice(0, 7)]);
    }
  };

  const handleSelectSuggestion = (text: string) => {
    hapticFeedback();
    setQuery(text);
    if (!searchHistory.includes(text)) {
      setSearchHistory([text, ...searchHistory.slice(0, 7)]);
    }
  };

  // Helper to extract YouTube video ID from links or raw ID (RiPlay Go To Link)
  const handlePlayDirectLink = () => {
    hapticFeedback();
    const input = directLinkInput.trim();
    if (!input) return;

    let videoId = input;
    const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (match && match[1]) {
      videoId = match[1];
    }

    const customTrack: Song = {
      id: `yt-custom-${videoId}`,
      title: `YouTube Stream (${videoId})`,
      artist: 'Online Artist',
      duration: 210,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      source: 'youtube',
      youtubeId: videoId,
      year: new Date().getFullYear(),
      genre: 'Direct Stream',
    };

    playSong(customTrack);
    setDirectLinkInput('');
  };

  const handleCacheTrack = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    hapticFeedback();
    if (isSongCached(song.id)) {
      await removeCachedSong(song.id);
      return;
    }
    setCachingSongId(song.id);
    try {
      await cacheSong(song);
    } finally {
      setCachingSongId(null);
    }
  };

  // Pre-indexed local library structures (computed ONLY when library changes, NOT on keystrokes)
  const localSongsIndex = useMemo(() => {
    const map = new Map<string, Song>();
    for (let i = 0; i < likedSongs.length; i++) {
      const s = likedSongs[i];
      if (!map.has(s.id)) map.set(s.id, s);
    }
    for (let i = 0; i < playlists.length; i++) {
      const songs = playlists[i].songs;
      for (let j = 0; j < songs.length; j++) {
        const s = songs[j];
        if (!map.has(s.id)) map.set(s.id, s);
      }
    }
    return Array.from(map.values()).map((song) => ({
      song,
      searchText: `${song.title || ''} ${song.artist || ''} ${song.album || ''}`.toLowerCase(),
    }));
  }, [likedSongs, playlists]);

  const localArtistsIndex = useMemo(() => {
    const map = new Map<string, Artist>();
    savedArtists.forEach((a) => map.set(a.id, a));
    importedArtists.forEach((a) => map.set(a.id, a));
    return Array.from(map.values()).map((artist) => ({
      artist,
      searchName: (artist.name || '').toLowerCase(),
    }));
  }, [savedArtists, importedArtists]);

  const localAlbumsIndex = useMemo(() => {
    const map = new Map<string, Album>();
    savedAlbums.forEach((a) => map.set(a.id, a));
    importedAlbums.forEach((a) => map.set(a.id, a));
    return Array.from(map.values()).map((album) => ({
      album,
      searchText: `${album.title || ''} ${album.artist || ''}`.toLowerCase(),
    }));
  }, [savedAlbums, importedAlbums]);

  // Fast deferred filtering over pre-indexed arrays (<1ms even with 5k imported tracks)
  const localMatchedSongs = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: Song[] = [];
    for (let i = 0; i < localSongsIndex.length; i++) {
      if (localSongsIndex[i].searchText.includes(q)) {
        matches.push(localSongsIndex[i].song);
      }
    }
    return matches;
  }, [deferredQuery, localSongsIndex]);

  const filteredArtists = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const map = new Map<string, Artist>();
    for (let i = 0; i < localArtistsIndex.length; i++) {
      if (localArtistsIndex[i].searchName.includes(q)) {
        map.set(localArtistsIndex[i].artist.id, localArtistsIndex[i].artist);
      }
    }
    for (let i = 0; i < onlineArtists.length; i++) {
      const a = onlineArtists[i];
      if (!map.has(a.id)) map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [deferredQuery, localArtistsIndex, onlineArtists]);

  const filteredAlbums = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    const map = new Map<string, Album>();
    for (let i = 0; i < localAlbumsIndex.length; i++) {
      if (localAlbumsIndex[i].searchText.includes(q)) {
        map.set(localAlbumsIndex[i].album.id, localAlbumsIndex[i].album);
      }
    }
    for (let i = 0; i < onlineAlbums.length; i++) {
      const a = onlineAlbums[i];
      if (!map.has(a.id)) map.set(a.id, a);
    }
    return Array.from(map.values());
  }, [deferredQuery, localAlbumsIndex, onlineAlbums]);

  const filteredPlaylists = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    return playlists.filter((p) => (p.title || '').toLowerCase().includes(q));
  }, [deferredQuery, playlists]);

  // Combined songs: local library matches first, followed by online tracks
  const combinedSongs = useMemo(() => {
    if (!deferredQuery.trim()) return [];
    const seen = new Set<string>();
    const list: Song[] = [];

    for (let i = 0; i < localMatchedSongs.length; i++) {
      const s = localMatchedSongs[i];
      const key = `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`;
      seen.add(key);
      list.push(s);
    }

    for (let i = 0; i < onlineResults.length; i++) {
      const s = onlineResults[i];
      const key = `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(s);
      }
    }

    return list;
  }, [deferredQuery, localMatchedSongs, onlineResults]);

  const topResult = combinedSongs[0] || null;
  const visibleSongs = useMemo(
    () => combinedSongs.slice(0, visibleSongsLimit),
    [combinedSongs, visibleSongsLimit]
  );
  const visibleAlbums = useMemo(
    () => filteredAlbums.slice(0, visibleAlbumsLimit),
    [filteredAlbums, visibleAlbumsLimit]
  );

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-5">
      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-white/40 pointer-events-none" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search millions of songs, artists, albums..."
          className="w-full pl-11 pr-12 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
        />
        <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
          {isSearchingOnline && query.trim().length >= 2 && (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 pointer-events-none" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Quick Search Autocomplete Suggestions */}
      {!query && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-60">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Popular & Trending Searches</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'The Weeknd',
              'Coldplay',
              'Taylor Swift',
              'Billie Eilish',
              'Lofi Chill Beats',
              'Linkin Park',
              'Imagine Dragons',
              'Dua Lipa',
            ].map((tag) => (
              <button
                key={tag}
                onClick={() => handleSelectSuggestion(tag)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/5 transition flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RiPlay "Go To Link" Direct URL input card */}
      <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold opacity-80">
          <LinkIcon className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />
          <span>Go to Link / YouTube ID (RiPlay Feature)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={directLinkInput}
            onChange={(e) => setDirectLinkInput(e.target.value)}
            placeholder="Paste YouTube link or video ID..."
            className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/5 text-xs placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={handlePlayDirectLink}
            disabled={!directLinkInput.trim()}
            className="px-3.5 py-2 rounded-xl text-white text-xs font-bold transition disabled:opacity-40"
            style={{ backgroundColor: themeColors.accent }}
          >
            Play
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      {query && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['all', 'songs', 'artists', 'albums', 'playlists'] as const).map((type) => {
            const isActive = filterType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  hapticFeedback();
                  setFilterType(type);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
                  isActive ? 'text-white shadow-md' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
                style={{ backgroundColor: isActive ? themeColors.accent : undefined }}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      {/* Recent Searches (if no query) */}
      {!query && searchHistory.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold opacity-50 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Recent Searches
            </span>
            <button
              onClick={() => setSearchHistory([])}
              className="text-xs opacity-40 hover:opacity-100"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item) => (
              <button
                key={item}
                onClick={() => handleSelectSuggestion(item)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/5 transition"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Explore Moods & Genres Grid */}
      {!query && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-60">
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            <span>Explore Moods & Genres</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOOD_CATEGORIES.map((mood) => (
              <div
                key={mood.id}
                onClick={() => handleSelectSuggestion(mood.label)}
                className={`relative h-16 rounded-2xl p-3 overflow-hidden cursor-pointer transition transform active:scale-95 border border-white/5 bg-gradient-to-br ${mood.color}`}
              >
                <div className="relative z-10 flex flex-col justify-between h-full text-white">
                  <span className="font-extrabold text-xs tracking-tight">{mood.label}</span>
                </div>
                <Music className="absolute -bottom-2 -right-2 w-10 h-10 text-white/20 -rotate-12 pointer-events-none" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loading state indicator (only shown before any results exist) */}
      {isSearchingOnline &&
        combinedSongs.length === 0 &&
        filteredArtists.length === 0 &&
        filteredAlbums.length === 0 &&
        filteredPlaylists.length === 0 && (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-white/50 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Searching online catalog...</span>
        </div>
      )}

      {/* Top Result Card (Spotify / RiPlay style) */}
      {deferredQuery.trim() && topResult && (filterType === 'all' || filterType === 'songs') && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/10 shadow-xl space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Top Result
          </div>

          <div
            onClick={() => {
              hapticFeedback();
              playSong(topResult, combinedSongs);
            }}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10">
              <img
                src={getSongCoverUrl(topResult)}
                alt={topResult.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Play className="w-7 h-7 fill-white text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-base font-black truncate text-white leading-tight">
                {topResult.title}
              </div>
              <div className="text-xs opacity-75 truncate">{topResult.artist}</div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  {topResult.genre || 'Music'}
                </span>
                {topResult.year && (
                  <span className="text-[10px] opacity-50">{topResult.year}</span>
                )}
                <span className="text-[10px] opacity-50">
                  {Math.floor(topResult.duration / 60)}:{(topResult.duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticFeedback();
                playSong(topResult, combinedSongs);
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl transition active:scale-90 shrink-0"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {deferredQuery.trim() && (
        <div className="space-y-4">
          {/* Songs List */}
          {(filterType === 'all' || filterType === 'songs') && combinedSongs.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-bold opacity-60 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Songs ({combinedSongs.length})</span>
                </h3>
                <span className="text-[11px] opacity-40">Tap to play • Swipe to queue</span>
              </div>

              <div className="space-y-1.5">
                {visibleSongs.map((song) => {
                  const cached = isSongCached(song.id);
                  const liked = isLiked(song.id);
                  const isCaching = cachingSongId === song.id || isSongCaching(song.id);

                  return (
                    <SwipeableSongRow key={song.id} song={song}>
                      <div
                        onClick={() => {
                          hapticFeedback();
                          playSong(song, combinedSongs);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                            <img
                              src={getSongCoverUrl(song)}
                              alt={song.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
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
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Offline
                                </span>
                              )}
                            </div>
                            <div className="text-xs opacity-60 truncate mt-0.5">
                              {song.artist} {song.album ? `• ${song.album}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Right Action Icons */}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {/* Offline Cache Button */}
                          <button
                            onClick={(e) => handleCacheTrack(e, song)}
                            title={cached ? 'Cached Offline' : 'Save for offline'}
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

                          {/* Like Button */}
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
                            title="Song options & Add to Playlist"
                            className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          <span className="text-xs opacity-40 font-mono ml-1 min-w-[32px] text-right">
                            {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    </SwipeableSongRow>
                  );
                })}
              </div>

              {combinedSongs.length > visibleSongsLimit && (
                <button
                  type="button"
                  onClick={() => setVisibleSongsLimit((c) => c + 30)}
                  className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 transition"
                >
                  Show more songs ({combinedSongs.length - visibleSongsLimit} remaining)
                </button>
              )}
            </section>
          )}

          {/* Artists */}
          {(filterType === 'all' || filterType === 'artists') && filteredArtists.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase font-bold opacity-60 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>Artists ({filteredArtists.length})</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {filteredArtists.slice(0, 6).map((artist) => {
                  const followed = isArtistFollowed(artist.id);
                  return (
                    <div
                      key={artist.id}
                      onClick={() => {
                        hapticFeedback();
                        setSelectedArtist(artist);
                        setSelectedArtistId(artist.id);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer border border-white/5 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md border border-white/10">
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
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                        title={followed ? 'Following (Saved in Library)' : 'Follow artist'}
                      >
                        {followed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <UserPlus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Albums */}
          {(filterType === 'all' || filterType === 'albums') && filteredAlbums.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase font-bold opacity-60 flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-cyan-400" />
                <span>Albums ({filteredAlbums.length})</span>
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {visibleAlbums.map((album) => {
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
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
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
                          title={saved ? 'Saved in Library' : 'Save album to Library'}
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

              {filteredAlbums.length > visibleAlbumsLimit && (
                <button
                  type="button"
                  onClick={() => setVisibleAlbumsLimit((c) => c + 12)}
                  className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 transition"
                >
                  Show more albums ({filteredAlbums.length - visibleAlbumsLimit} remaining)
                </button>
              )}
            </section>
          )}

          {/* Playlists */}
          {(filterType === 'all' || filterType === 'playlists') && filteredPlaylists.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase font-bold opacity-60 flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-cyan-400" />
                <span>Playlists ({filteredPlaylists.length})</span>
              </h3>
              <div className="space-y-1.5">
                {filteredPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      hapticFeedback();
                      setSelectedPlaylist(pl);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                      <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate text-white">{pl.title}</div>
                      <div className="text-[10px] opacity-50">{pl.songs.length} songs</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* No results message */}
          {!isSearchingOnline &&
            query === deferredQuery &&
            deferredQuery.trim().length >= 2 &&
            combinedSongs.length === 0 &&
            filteredArtists.length === 0 &&
            filteredAlbums.length === 0 &&
            filteredPlaylists.length === 0 && (
              <div className="py-12 text-center space-y-2 bg-white/5 rounded-3xl border border-white/5 p-6">
                <Music className="w-8 h-8 opacity-40 mx-auto text-emerald-400" />
                <div className="text-sm font-bold text-white">No matches found for &quot;{deferredQuery}&quot;</div>
                <div className="text-xs opacity-50 max-w-xs mx-auto">
                  Try searching for song titles, artist names, album titles, or paste a YouTube link in the direct URL box above.
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
