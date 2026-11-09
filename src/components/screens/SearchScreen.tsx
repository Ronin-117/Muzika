import React, { useState, useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { INITIAL_SONGS, INITIAL_ARTISTS, INITIAL_PLAYLISTS, INITIAL_ALBUMS, MOOD_CATEGORIES } from '../../data/mockCatalog';
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
} from 'lucide-react';
import { Song, Artist, Album } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';

export const SearchScreen: React.FC = () => {
  const {
    playSong,
    setSelectedArtistId,
    setSelectedPlaylist,
    setSelectedAlbum,
    themeColors,
    hapticFeedback,
    isSongCached,
    cacheSong,
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
    addToQueue,
  } = useMusic();

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'songs' | 'artists' | 'albums' | 'playlists'>('all');
  const [directLinkInput, setDirectLinkInput] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<Song[]>([]);
  const [onlineArtists, setOnlineArtists] = useState<Artist[]>([]);
  const [cachingSongId, setCachingSongId] = useState<string | null>(null);

  const [searchHistory, setSearchHistory] = useState<string[]>([
    'The Weeknd',
    'Coldplay',
    'Taylor Swift',
    'Billie Eilish',
    'Lofi Chill Beats',
  ]);

  const searchDebounceRef = useRef<number | null>(null);

  // Perform live online music search as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setOnlineResults([]);
      setOnlineArtists([]);
      setIsSearchingOnline(false);
      return;
    }

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    setIsSearchingOnline(true);
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const [songs, artists] = await Promise.all([
          OnlineMusicService.searchOnlineMusic(trimmed, 30),
          OnlineMusicService.searchOnlineArtists(trimmed, 6),
        ]);
        setOnlineResults(songs);
        setOnlineArtists(artists);
      } catch (err) {
        console.warn('Online search error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
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
    setCachingSongId(song.id);
    try {
      await cacheSong(song);
    } finally {
      setCachingSongId(null);
    }
  };

  // Local library matches
  const localMatchedSongs = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const map = new Map<string, Song>();
    INITIAL_SONGS.forEach((s) => map.set(s.id, s));
    likedSongs.forEach((s) => map.set(s.id, s));
    playlists.forEach((p) => p.songs.forEach((s) => map.set(s.id, s)));

    return Array.from(map.values()).filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album?.toLowerCase().includes(q)
    );
  }, [query, likedSongs, playlists]);

  const allArtists = React.useMemo(() => {
    const map = new Map<string, Artist>();
    INITIAL_ARTISTS.forEach((a) => map.set(a.id, a));
    importedArtists.forEach((a) => map.set(a.id, a));
    savedArtists.forEach((a) => map.set(a.id, a));
    onlineArtists.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [importedArtists, savedArtists, onlineArtists]);

  const filteredArtists = React.useMemo(() => {
    if (!query.trim()) return allArtists;
    const q = query.toLowerCase();
    return allArtists.filter((a) => a.name.toLowerCase().includes(q));
  }, [query, allArtists]);

  const allAlbums = React.useMemo(() => {
    const map = new Map<string, Album>();
    INITIAL_ALBUMS.forEach((a) => map.set(a.id, a));
    importedAlbums.forEach((a) => map.set(a.id, a));
    savedAlbums.forEach((a) => map.set(a.id, a));
    return Array.from(map.values());
  }, [importedAlbums, savedAlbums]);

  const filteredAlbums = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allAlbums.filter(
      (a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [query, allAlbums]);

  const filteredPlaylists = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return playlists.filter((p) => p.title.toLowerCase().includes(q));
  }, [query, playlists]);

  // Combined songs: local library matches first, followed by online tracks
  const combinedSongs = React.useMemo(() => {
    const seen = new Set<string>();
    const list: Song[] = [];

    // Local matches
    localMatchedSongs.forEach((s) => {
      seen.add(s.title.toLowerCase() + s.artist.toLowerCase());
      list.push(s);
    });

    // Online matches
    onlineResults.forEach((s) => {
      const key = s.title.toLowerCase() + s.artist.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(s);
      }
    });

    return list;
  }, [localMatchedSongs, onlineResults]);

  const topResult = combinedSongs[0] || null;

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search millions of songs, artists, albums..."
          className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30 transition shadow-inner"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-3 p-1 rounded-full bg-white/10 text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
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

      {/* Loading state indicator */}
      {isSearchingOnline && (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-white/50 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Searching online catalog...</span>
        </div>
      )}

      {/* Top Result Card (Spotify / RiPlay style) */}
      {query && !isSearchingOnline && topResult && (filterType === 'all' || filterType === 'songs') && (
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
                src={topResult.thumbnailUrl}
                alt={topResult.title}
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
      {query && (
        <div className="space-y-4">
          {/* Songs List */}
          {(filterType === 'all' || filterType === 'songs') && combinedSongs.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-bold opacity-60 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Songs ({combinedSongs.length})</span>
                </h3>
                <span className="text-[11px] opacity-40">Tap to play instantly</span>
              </div>

              <div className="space-y-1.5">
                {combinedSongs.map((song) => {
                  const cached = isSongCached(song.id);
                  const liked = isLiked(song.id);
                  const isCaching = cachingSongId === song.id;

                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        hapticFeedback();
                        playSong(song, combinedSongs);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
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

                        {/* Add to Queue */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            hapticFeedback();
                            addToQueue(song);
                          }}
                          title="Add to queue"
                          className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <span className="text-xs opacity-40 font-mono ml-1 min-w-[32px] text-right">
                          {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                          <div className="text-[10px] opacity-50 truncate mt-0.5">{artist.subscribers || 'Artist'}</div>
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
                {filteredAlbums.map((album) => {
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
            combinedSongs.length === 0 &&
            filteredArtists.length === 0 &&
            filteredAlbums.length === 0 &&
            filteredPlaylists.length === 0 && (
              <div className="py-12 text-center space-y-2 bg-white/5 rounded-3xl border border-white/5 p-6">
                <Music className="w-8 h-8 opacity-40 mx-auto text-emerald-400" />
                <div className="text-sm font-bold text-white">No matches found for "{query}"</div>
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
