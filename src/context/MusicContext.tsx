import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import {
  Song,
  Playlist,
  Artist,
  Album,
  RepeatMode,
  EqualizerSettings,
  ThemeName,
  UserStats,
  LyricsData,
} from '../types/music';
import { INITIAL_SONGS, INITIAL_PLAYLISTS } from '../data/mockCatalog';
import { StorageService } from '../services/storageService';
import { fetchLyricsFromLrcLib, parseLrcString } from '../services/lyricsService';
import { YouTubeController } from '../services/youtubeService';
import { THEMES } from '../styles/themes';
import {
  offlineCacheService,
  CachedTrackRecord,
  CacheConfig,
  DEFAULT_CACHE_CONFIG,
} from '../services/offlineCacheService';
import { RiplaySqliteImporter, RiplayImportSummary } from '../services/riplaySqliteImporter';
import { OnlineMusicService } from '../services/onlineMusicService';

interface MusicContextType {
  // Current playback state
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Song[];
  queueIndex: number;
  playerMode: 'audio' | 'video' | 'lyrics';
  setPlayerMode: (mode: 'audio' | 'video' | 'lyrics') => void;

  // Modals & Sheets
  isPlayerOpen: boolean;
  setIsPlayerOpen: (open: boolean) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  isEqualizerOpen: boolean;
  setIsEqualizerOpen: (open: boolean) => void;
  isSleepTimerOpen: boolean;
  setIsSleepTimerOpen: (open: boolean) => void;
  isSongInfoOpen: boolean;
  setIsSongInfoOpen: (open: boolean) => void;
  isPWAInstallModalOpen: boolean;
  setIsPWAInstallModalOpen: (open: boolean) => void;
  isRiplayImportOpen: boolean;
  setIsRiplayImportOpen: (open: boolean) => void;

  // Selected entities for detail screens
  selectedPlaylist: Playlist | null;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  selectedArtistId: string | null;
  setSelectedArtistId: (artistId: string | null) => void;
  selectedAlbum: Album | null;
  setSelectedAlbum: (album: Album | null) => void;

  // Active navigation
  activeTab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings' | 'test';
  setActiveTab: (tab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings' | 'test') => void;

  // Lyrics
  currentLyrics: LyricsData | null;
  isLoadingLyrics: boolean;

  // Playback actions
  playSong: (song: Song, customQueue?: Song[]) => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // Queue manipulation
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;

  // User collections
  likedSongs: Song[];
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;

  playlists: Playlist[];
  createPlaylist: (title: string, description?: string, color?: string) => Playlist;
  addToPlaylist: (playlistId: string, song: Song) => void;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
  deletePlaylist: (playlistId: string) => void;

  history: Song[];
  clearHistory: () => void;

  blacklist: { id: string; name: string; type: 'song' | 'artist' }[];
  addToBlacklist: (id: string, name: string, type: 'song' | 'artist') => void;
  removeFromBlacklist: (id: string) => void;
  isBlacklisted: (song: Song) => boolean;

  userStats: UserStats;

  // Equalizer
  equalizerSettings: EqualizerSettings;
  setEqualizerSettings: (settings: EqualizerSettings) => void;

  // Sleep Timer
  sleepTimerSeconds: number | null;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;

  // Themes
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themeColors: typeof THEMES['riplay'];

  // Haptic Feedback helper
  hapticFeedback: () => void;

  // Local audio import
  addLocalSongs: (songs: Song[]) => void;

  // Offline Caching & IndexedDB (RiPlay feature)
  cachedSongIds: Set<string>;
  cachedTracks: CachedTrackRecord[];
  isSongCached: (songId: string) => boolean;
  cacheSong: (song: Song, audioBlob?: Blob) => Promise<boolean>;
  removeCachedSong: (songId: string) => Promise<boolean>;
  clearOfflineCache: () => Promise<boolean>;
  cacheConfig: CacheConfig;
  updateCacheConfig: (config: CacheConfig) => Promise<void>;
  storageEstimate: { totalBytes: number; count: number };

  // RiPlay SQLite Database Import (.db / .backup)
  importRiplaySqliteBackup: (file: File) => Promise<RiplayImportSummary>;
  importedArtists: Artist[];
  importedAlbums: Album[];
  lastImportSummary: RiplayImportSummary | null;

  // Saved / Followed Library items
  savedArtists: Artist[];
  toggleFollowArtist: (artist: Artist) => void;
  isArtistFollowed: (artistId: string) => boolean;
  savedAlbums: Album[];
  toggleSaveAlbum: (album: Album) => void;
  isAlbumSaved: (albumId: string) => boolean;
}

const MusicContext = createContext<MusicContextType | null>(null);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation & UI state with persistent refresh state
  const [activeTab, setActiveTabState] = useState<'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings' | 'test'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['home', 'explore', 'search', 'library', 'rewind', 'settings', 'test'].includes(hash)) {
        return hash as any;
      }
      const saved = localStorage.getItem('muzika_active_tab');
      if (saved && ['home', 'explore', 'search', 'library', 'rewind', 'settings', 'test'].includes(saved)) {
        return saved as any;
      }
    }
    return 'home';
  });

  const setActiveTab = (tab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings' | 'test') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('muzika_active_tab', tab);
      window.location.hash = tab;
    }
  };

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isSongInfoOpen, setIsSongInfoOpen] = useState(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpen] = useState(false);
  const [isRiplayImportOpen, setIsRiplayImportOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState<'audio' | 'video' | 'lyrics'>('audio');

  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Playback state restored from last session (Rewind support)
  const initialPlaybackState = useMemo(() => StorageService.getLastPlaybackState(), []);

  const [queue, setQueue] = useState<Song[]>(() => initialPlaybackState?.queue?.length ? initialPlaybackState.queue : INITIAL_SONGS);
  const [queueIndex, setQueueIndex] = useState<number>(() => initialPlaybackState?.queueIndex ?? 0);
  const [currentSong, setCurrentSong] = useState<Song | null>(() => initialPlaybackState?.song ?? INITIAL_SONGS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => initialPlaybackState?.currentTime ?? 0);
  const [duration, setDuration] = useState<number>(() => initialPlaybackState?.duration ?? (INITIAL_SONGS[0].duration || 200));
  const [volume, setVolumeState] = useState<number>(85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);

  // Lyrics state
  const [currentLyrics, setCurrentLyrics] = useState<LyricsData | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState<boolean>(false);

  // Collections state
  const [likedSongs, setLikedSongs] = useState<Song[]>(() => StorageService.getLikedSongs());
  const [playlists, setPlaylists] = useState<Playlist[]>(() => StorageService.getPlaylists());
  const [history, setHistory] = useState<Song[]>(() => StorageService.getHistory());
  const [blacklist, setBlacklist] = useState(() => StorageService.getBlacklist());
  const [userStats, setUserStats] = useState<UserStats>(() => StorageService.getUserStats());
  const [equalizerSettings, setEqSettings] = useState<EqualizerSettings>(() => StorageService.getEqualizer());
  const [theme, setThemeState] = useState<ThemeName>(() => StorageService.getTheme());
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);

  // Offline Cache states (IndexedDB)
  const [cachedSongIds, setCachedSongIds] = useState<Set<string>>(new Set());
  const [cachedTracks, setCachedTracks] = useState<CachedTrackRecord[]>([]);
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(DEFAULT_CACHE_CONFIG);
  const [storageEstimate, setStorageEstimate] = useState<{ totalBytes: number; count: number }>({
    totalBytes: 0,
    count: 0,
  });

  // RiPlay Imported Entities State
  const [importedArtists, setImportedArtists] = useState<Artist[]>(() => StorageService.getCustomArtists());
  const [importedAlbums, setImportedAlbums] = useState<Album[]>(() => StorageService.getCustomAlbums());
  const [lastImportSummary, setLastImportSummary] = useState<RiplayImportSummary | null>(() => StorageService.getLastImportSummary());

  // Saved / Followed Library States
  const [savedArtists, setSavedArtists] = useState<Artist[]>(() => StorageService.getSavedArtists());
  const [savedAlbums, setSavedAlbums] = useState<Album[]>(() => StorageService.getSavedAlbums());

  // Handle browser back button & history modal popping
  useEffect(() => {
    const hasOpenModal =
      isPlayerOpen ||
      isQueueOpen ||
      isEqualizerOpen ||
      isSleepTimerOpen ||
      isSongInfoOpen ||
      isPWAInstallModalOpen ||
      isRiplayImportOpen ||
      selectedPlaylist !== null ||
      selectedArtistId !== null ||
      selectedAlbum !== null;

    if (hasOpenModal && typeof window !== 'undefined') {
      window.history.pushState({ modalOpen: true }, '');
    }

    const handlePopState = () => {
      if (isPlayerOpen) {
        setIsPlayerOpen(false);
        return;
      }
      if (isQueueOpen) {
        setIsQueueOpen(false);
        return;
      }
      if (selectedPlaylist) {
        setSelectedPlaylist(null);
        return;
      }
      if (selectedArtistId) {
        setSelectedArtistId(null);
        return;
      }
      if (selectedAlbum) {
        setSelectedAlbum(null);
        return;
      }
      if (isEqualizerOpen) {
        setIsEqualizerOpen(false);
        return;
      }
      if (isSleepTimerOpen) {
        setIsSleepTimerOpen(false);
        return;
      }
      if (isSongInfoOpen) {
        setIsSongInfoOpen(false);
        return;
      }
      if (isRiplayImportOpen) {
        setIsRiplayImportOpen(false);
        return;
      }
      if (isPWAInstallModalOpen) {
        setIsPWAInstallModalOpen(false);
        return;
      }

      // If no modals are open and activeTab is not home, go back to home
      if (activeTab !== 'home') {
        setActiveTab('home');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [
    isPlayerOpen,
    isQueueOpen,
    isEqualizerOpen,
    isSleepTimerOpen,
    isSongInfoOpen,
    isPWAInstallModalOpen,
    isRiplayImportOpen,
    selectedPlaylist,
    selectedArtistId,
    selectedAlbum,
    activeTab,
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadCache = async () => {
      const ids = await offlineCacheService.refreshCachedIds();
      if (!isMounted) return;
      setCachedSongIds(new Set(ids));
      const all = await offlineCacheService.getAllCachedSongs();
      setCachedTracks(all);
      const est = await offlineCacheService.getStorageEstimate();
      setStorageEstimate(est);
      const cfg = await offlineCacheService.getCacheConfig();
      setCacheConfigState(cfg);

      // Pre-cache popular initial tracks so offline works right away out of the box
      if (all.length === 0 && INITIAL_SONGS.length >= 2) {
        await offlineCacheService.cacheSong(INITIAL_SONGS[0]);
        await offlineCacheService.cacheSong(INITIAL_SONGS[3]);
        const updated = await offlineCacheService.getAllCachedSongs();
        if (isMounted) {
          setCachedTracks(updated);
          setCachedSongIds(new Set(updated.map((s) => s.id)));
        }
      }
    };
    loadCache();

    const unsub = offlineCacheService.subscribe(async () => {
      if (!isMounted) return;
      const ids = await offlineCacheService.refreshCachedIds();
      setCachedSongIds(new Set(ids));
      const all = await offlineCacheService.getAllCachedSongs();
      setCachedTracks(all);
      const est = await offlineCacheService.getStorageEstimate();
      setStorageEstimate(est);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Audio Engines
  const ytControllerRef = useRef<YouTubeController | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const silentKeepAliveRef = useRef<HTMLAudioElement | null>(null);
  const activeEngineRef = useRef<'youtube' | 'html'>('html');
  const sleepTimerIntervalRef = useRef<number | null>(null);

  // Synchronized state references for persistent audio event handlers
  const currentSongRef = useRef<Song | null>(currentSong);
  currentSongRef.current = currentSong;
  const queueRef = useRef<Song[]>(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef<number>(queueIndex);
  queueIndexRef.current = queueIndex;
  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  repeatModeRef.current = repeatMode;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const userPausedRef = useRef<boolean>(false);

  const themeColors = useMemo(() => THEMES[theme] || THEMES.riplay, [theme]);

  // Initialize Silent Background Audio Wake-Lock Loop
  useEffect(() => {
    const silentAudio = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    );
    silentAudio.loop = true;
    silentAudio.volume = 0.0001;
    (silentAudio as any).playsInline = true;
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('x-webkit-airplay', 'allow');
    silentKeepAliveRef.current = silentAudio;

    return () => {
      silentAudio.pause();
    };
  }, []);

  // Synchronize Silent Audio Wake-Lock whenever playback is active
  useEffect(() => {
    if (isPlaying) {
      silentKeepAliveRef.current?.play().catch(() => {});
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        (navigator as any).wakeLock?.request('screen').catch(() => {});
      }
    } else {
      silentKeepAliveRef.current?.pause();
    }
  }, [isPlaying]);

  // Handle visibilitychange safeguard (prevent mobile OS from throttling background playback)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isPlayingRef.current && !userPausedRef.current) {
        silentKeepAliveRef.current?.play().catch(() => {});
        if (activeEngineRef.current === 'html' && htmlAudioRef.current) {
          if (htmlAudioRef.current.paused) {
            htmlAudioRef.current.play().catch(() => {});
          }
        } else if (activeEngineRef.current === 'youtube') {
          ytControllerRef.current?.play();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Haptic feedback trigger for tactile mobile experience
  const hapticFeedback = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  };

  // Sync theme changes to meta theme-color
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', themeColors.background0);
    }
  }, [themeColors]);

  // Initialize Audio element for native high-fidelity background and screen-off playback (Mounted ONCE)
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    (audio as any).playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    htmlAudioRef.current = audio;

    const handleTimeUpdate = () => {
      if (activeEngineRef.current === 'html') {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };

    const handleEnded = () => {
      if (activeEngineRef.current === 'html') {
        handleTrackEnded();
      }
    };

    const handlePlay = () => {
      if (activeEngineRef.current === 'html') {
        setIsPlaying(true);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }
    };

    const handlePause = () => {
      if (activeEngineRef.current === 'html') {
        if (!userPausedRef.current && isPlayingRef.current) {
          // Unintended pause event fired by mobile OS or Chrome tab backgrounding
          if (htmlAudioRef.current && htmlAudioRef.current.paused) {
            htmlAudioRef.current.play().catch(() => {});
          }
          return;
        }
        setIsPlaying(false);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (activeEngineRef.current === 'html') {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
    };
  }, []);

  // Initialize YouTube Iframe Controller
  useEffect(() => {
    const yt = new YouTubeController('muzika-yt-embed', {
      onStateChange: (state) => {
        // 1: playing, 2: paused, 0: ended
        if (activeEngineRef.current === 'youtube') {
          if (state === 1) {
            setIsPlaying(true);
          } else if (state === 2) {
            setIsPlaying(false);
          } else if (state === 0) {
            handleTrackEnded();
          }
        }
      },
      onTimeUpdate: (time, dur) => {
        if (activeEngineRef.current === 'youtube') {
          setCurrentTime(time);
          if (dur > 0) setDuration(dur);
        }
      },
      onError: (err) => {
        console.warn('YouTube Player notification:', err);
      },
    });

    ytControllerRef.current = yt;
    yt.init(currentSong?.youtubeId || '4NRXx6U8ABQ');

    return () => {
      yt.destroy();
    };
  }, []);

  // Update MediaSession for Android lockscreen & background notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      if (currentSong) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Muzika',
          artwork: [
            { src: currentSong.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.thumbnailUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: currentSong.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' },
          ],
        });
      }

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      if ('setPositionState' in navigator.mediaSession && duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, duration),
            playbackRate: 1,
            position: Math.max(0, Math.min(currentTime, duration)),
          });
        } catch (e) {
          // ignore
        }
      }

      navigator.mediaSession.setActionHandler('play', () => {
        userPausedRef.current = false;
        togglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        userPausedRef.current = true;
        togglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        seekTo(Math.max(0, currentTime - skip));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        seekTo(Math.min(duration, currentTime + skip));
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        setIsPlaying(false);
      });
    }
  }, [currentSong, isPlaying, currentTime, duration]);

  // Continuously persist current playback state (Rewind support)
  useEffect(() => {
    if (!currentSong) return;

    // Save current song and timestamp
    StorageService.saveLastPlaybackState({
      song: currentSong,
      currentTime: Math.floor(currentTime),
      duration,
      queueIndex,
      queue,
    });
  }, [currentSong, currentTime, duration, queueIndex, queue]);

  // Save on page exit / unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSong) {
        StorageService.saveLastPlaybackState({
          song: currentSong,
          currentTime: Math.floor(currentTime),
          duration,
          queueIndex,
          queue,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [currentSong, currentTime, duration, queueIndex, queue]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentSong) return;

    let isMounted = true;
    setIsLoadingLyrics(true);

    // If song already has lyrics attached
    if (currentSong.lyrics) {
      fetchLyricsFromLrcLib(currentSong.title, currentSong.artist, currentSong.duration).then((data) => {
        if (!isMounted) return;
        if (data && data.syncedLyrics && data.syncedLyrics.length > 0) {
          setCurrentLyrics(data);
        } else {
          // fallback to song's built-in parsed lyrics
          const parsed = parseLrcString(currentSong.lyrics || '');
          setCurrentLyrics({
            trackName: currentSong.title,
            artistName: currentSong.artist,
            albumName: currentSong.album,
            syncedLyrics: parsed,
            plainLyrics: currentSong.lyrics,
            instrumental: false,
          });
        }
        setIsLoadingLyrics(false);
      });
    } else {
      fetchLyricsFromLrcLib(currentSong.title, currentSong.artist, currentSong.duration).then((data) => {
        if (!isMounted) return;
        setCurrentLyrics(data);
        setIsLoadingLyrics(false);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentSong?.id]);

  // Handle track completion
  const handleTrackEnded = () => {
    const curRepeat = repeatModeRef.current;
    const curQueue = queueRef.current;
    const curIndex = queueIndexRef.current;

    if (curRepeat === 'one') {
      seekTo(0);
      if (activeEngineRef.current === 'youtube') {
        ytControllerRef.current?.play();
      } else if (htmlAudioRef.current) {
        htmlAudioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
      return;
    }

    if (curIndex < curQueue.length - 1) {
      playIndex(curIndex + 1);
    } else if (curRepeat === 'all') {
      playIndex(0);
    } else {
      setIsPlaying(false);
    }
  };

  // Record playback stats
  const recordPlay = (song: Song) => {
    const updatedStats: UserStats = {
      ...userStats,
      totalPlays: userStats.totalPlays + 1,
      totalMinutes: userStats.totalMinutes + Math.round((song.duration || 180) / 60),
      songPlayCounts: {
        ...userStats.songPlayCounts,
        [song.id]: (userStats.songPlayCounts[song.id] || 0) + 1,
      },
      artistPlayCounts: {
        ...userStats.artistPlayCounts,
        [song.artist]: (userStats.artistPlayCounts[song.artist] || 0) + 1,
      },
      playHistory: [
        { songId: song.id, playedAt: Date.now(), duration: song.duration },
        ...userStats.playHistory.slice(0, 99),
      ],
      rankBadge:
        userStats.totalMinutes > 500
          ? 'Diamond Legend'
          : userStats.totalMinutes > 200
          ? 'Gold Audiophile'
          : userStats.totalMinutes > 60
          ? 'Silver Explorer'
          : 'Bronze Newbie',
    };
    setUserStats(updatedStats);
    StorageService.saveUserStats(updatedStats);

    // Update History
    const filteredHistory = history.filter((s) => s.id !== song.id);
    const newHistory = [song, ...filteredHistory].slice(0, 50);
    setHistory(newHistory);
    StorageService.saveHistory(newHistory);
  };

  const isBlacklisted = (song: Song) => {
    return blacklist.some(
      (b) => (b.type === 'song' && b.id === song.id) || (b.type === 'artist' && b.name.toLowerCase() === song.artist.toLowerCase())
    );
  };

  const playIndex = async (index: number, startAtSecond?: number) => {
    if (index < 0 || index >= queue.length) return;
    const song = queue[index];

    // Check blacklist: if blacklisted, try skip to next
    if (isBlacklisted(song)) {
      if (index + 1 < queue.length) {
        playIndex(index + 1);
        return;
      }
    }

    userPausedRef.current = false;
    const startPos = typeof startAtSecond === 'number' ? startAtSecond : 0;
    setQueueIndex(index);
    setCurrentSong(song);
    setCurrentTime(startPos);
    setDuration(song.duration || 180);
    setIsPlaying(true);
    recordPlay(song);

    // Stop YouTube player if running
    if (ytControllerRef.current) {
      ytControllerRef.current.pause();
    }

    // Check if track has a cached real audio blob in IndexedDB
    const cachedData = await offlineCacheService.getCachedTrackAudioUrl(song.id);

    // 1. If cached real audio is available, play via native HTML5 <audio>
    if (cachedData && cachedData.audioUrl) {
      activeEngineRef.current = 'html';
      if (htmlAudioRef.current) {
        if (htmlAudioRef.current.src !== cachedData.audioUrl) {
          htmlAudioRef.current.src = cachedData.audioUrl;
        }
        if (startPos > 0) {
          try {
            htmlAudioRef.current.currentTime = startPos;
          } catch {}
        }
        htmlAudioRef.current.play().catch(() => {});
      }
    }
    // 2. Direct streamUrl or resolve real audio stream URL for HTML5 native audio (supports screen-off background playback)
    else {
      let streamUrl = song.streamUrl;
      if (!streamUrl && song.source !== 'local') {
        streamUrl = await OnlineMusicService.resolveStreamUrl(song);
        if (streamUrl) {
          song.streamUrl = streamUrl;
        }
      }

      if (streamUrl && htmlAudioRef.current) {
        activeEngineRef.current = 'html';
        if (htmlAudioRef.current.src !== streamUrl) {
          htmlAudioRef.current.src = streamUrl;
        }
        if (startPos > 0) {
          try {
            htmlAudioRef.current.currentTime = startPos;
          } catch {}
        }
        htmlAudioRef.current.play().catch(() => {});
      } else if (song.source === 'youtube' || song.youtubeId) {
        // Fallback to YouTube iframe only if no direct audio stream could be resolved
        activeEngineRef.current = 'youtube';
        if (htmlAudioRef.current) {
          htmlAudioRef.current.pause();
        }
        const ytId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : song.id);
        ytControllerRef.current?.loadVideoById(ytId, startPos);
        ytControllerRef.current?.play();
      }
    }

    // Auto-cache real audio stream in background if enabled
    if (cacheConfig.autoCacheOnPlay) {
      offlineCacheService.cacheSong(song).catch(() => {});
    }
  };

  const playSong = (song: Song, customQueue?: Song[]) => {
    hapticFeedback();
    userPausedRef.current = false;
    if (customQueue && customQueue.length > 0) {
      setQueue(customQueue);
      const idx = customQueue.findIndex((s) => s.id === song.id);
      playIndex(idx !== -1 ? idx : 0);
    } else {
      const existingIdx = queue.findIndex((s) => s.id === song.id);
      if (existingIdx !== -1) {
        playIndex(existingIdx);
      } else {
        const newQueue = [...queue, song];
        setQueue(newQueue);
        playIndex(newQueue.length - 1);
      }
    }
  };

  const togglePlay = () => {
    hapticFeedback();
    if (!currentSong) {
      if (queue.length > 0) playIndex(0);
      return;
    }

    if (isPlaying) {
      // User explicitly requested pause
      userPausedRef.current = true;
      if (htmlAudioRef.current && activeEngineRef.current === 'html') {
        htmlAudioRef.current.pause();
      }
      if (ytControllerRef.current && activeEngineRef.current === 'youtube') {
        ytControllerRef.current.pause();
      }
      setIsPlaying(false);
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } else {
      // User explicitly requested resume
      userPausedRef.current = false;
      const resumePos = currentTime > 0 ? currentTime : 0;

      if (activeEngineRef.current === 'html' && htmlAudioRef.current?.src) {
        if (ytControllerRef.current) ytControllerRef.current.pause();
        if (resumePos > 0 && Math.abs(htmlAudioRef.current.currentTime - resumePos) > 2) {
          try {
            htmlAudioRef.current.currentTime = resumePos;
          } catch {}
        }
        htmlAudioRef.current.play().catch(() => {});
        setIsPlaying(true);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      } else if (activeEngineRef.current === 'youtube' && ytControllerRef.current) {
        ytControllerRef.current.play();
        setIsPlaying(true);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      } else {
        playIndex(queueIndex, resumePos);
      }
    }
  };

  const seekTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(clamped);
    if (activeEngineRef.current === 'youtube') {
      ytControllerRef.current?.seekTo(clamped);
    }
    if (activeEngineRef.current === 'html' && htmlAudioRef.current && htmlAudioRef.current.src) {
      try {
        htmlAudioRef.current.currentTime = clamped;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, duration),
          playbackRate: 1,
          position: clamped,
        });
      } catch {}
    }
  };

  const nextTrack = () => {
    hapticFeedback();
    if (queue.length === 0) return;
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playIndex(randomIndex);
    } else if (queueIndex < queue.length - 1) {
      playIndex(queueIndex + 1);
    } else if (repeatMode === 'all') {
      playIndex(0);
    }
  };

  const prevTrack = () => {
    hapticFeedback();
    if (currentTime > 4) {
      seekTo(0);
      return;
    }
    if (queueIndex > 0) {
      playIndex(queueIndex - 1);
    } else {
      seekTo(0);
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    ytControllerRef.current?.setVolume(val);
    if (htmlAudioRef.current) {
      htmlAudioRef.current.volume = Math.max(0, Math.min(1, val / 100));
    }
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    hapticFeedback();
    if (isMuted) {
      setIsMuted(false);
      setVolume(volume || 80);
    } else {
      setIsMuted(true);
      ytControllerRef.current?.setVolume(0);
      if (htmlAudioRef.current) {
        htmlAudioRef.current.volume = 0;
      }
    }
  };

  const toggleShuffle = () => {
    hapticFeedback();
    setIsShuffle(!isShuffle);
  };

  const cycleRepeat = () => {
    hapticFeedback();
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  // Queue actions
  const addToQueue = (song: Song) => {
    hapticFeedback();
    setQueue((prev) => [...prev, song]);
  };

  const playNextInQueue = (song: Song) => {
    hapticFeedback();
    setQueue((prev) => {
      const newQ = [...prev];
      newQ.splice(queueIndex + 1, 0, song);
      return newQ;
    });
  };

  const removeFromQueue = (index: number) => {
    hapticFeedback();
    if (queue.length <= 1) return;
    const newQ = queue.filter((_, idx) => idx !== index);
    setQueue(newQ);
    if (index < queueIndex) {
      setQueueIndex((prev) => prev - 1);
    } else if (index === queueIndex) {
      playIndex(Math.min(queueIndex, newQ.length - 1));
    }
  };

  const clearQueue = () => {
    hapticFeedback();
    if (currentSong) {
      setQueue([currentSong]);
      setQueueIndex(0);
    }
  };

  const reorderQueue = (startIdx: number, endIdx: number) => {
    const list = Array.from(queue);
    const [removed] = list.splice(startIdx, 1);
    list.splice(endIdx, 0, removed);
    setQueue(list);
    if (queueIndex === startIdx) {
      setQueueIndex(endIdx);
    } else if (queueIndex > startIdx && queueIndex <= endIdx) {
      setQueueIndex((prev) => prev - 1);
    } else if (queueIndex < startIdx && queueIndex >= endIdx) {
      setQueueIndex((prev) => prev + 1);
    }
  };

  // Likes & Playlists
  const isLiked = (songId: string) => {
    return likedSongs.some((s) => s.id === songId);
  };

  const toggleLike = (song: Song) => {
    hapticFeedback();
    setLikedSongs((prev) => {
      let updated: Song[];
      if (prev.some((s) => s.id === song.id)) {
        updated = prev.filter((s) => s.id !== song.id);
      } else {
        updated = [song, ...prev];
      }
      StorageService.saveLikedSongs(updated);
      return updated;
    });
  };

  const createPlaylist = (title: string, description?: string, color?: string): Playlist => {
    hapticFeedback();
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      title,
      description,
      color: color || themeColors.accent,
      songs: [],
      createdAt: Date.now(),
    };
    const updated = [newPl, ...playlists];
    setPlaylists(updated);
    StorageService.savePlaylists(updated);
    return newPl;
  };

  const addToPlaylist = (playlistId: string, song: Song) => {
    hapticFeedback();
    setPlaylists((prev) => {
      const updated = prev.map((pl) => {
        if (pl.id === playlistId) {
          if (!pl.songs.some((s) => s.id === song.id)) {
            return { ...pl, songs: [...pl.songs, song] };
          }
        }
        return pl;
      });
      StorageService.savePlaylists(updated);
      return updated;
    });
  };

  const removeFromPlaylist = (playlistId: string, songId: string) => {
    hapticFeedback();
    setPlaylists((prev) => {
      const updated = prev.map((pl) => {
        if (pl.id === playlistId) {
          return { ...pl, songs: pl.songs.filter((s) => s.id !== songId) };
        }
        return pl;
      });
      StorageService.savePlaylists(updated);
      return updated;
    });
  };

  const deletePlaylist = (playlistId: string) => {
    hapticFeedback();
    const updated = playlists.filter((pl) => pl.id !== playlistId);
    setPlaylists(updated);
    StorageService.savePlaylists(updated);
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
    }
  };

  const clearHistory = () => {
    hapticFeedback();
    setHistory([]);
    StorageService.saveHistory([]);
  };

  const addToBlacklist = (id: string, name: string, type: 'song' | 'artist') => {
    hapticFeedback();
    const updated = [...blacklist, { id, name, type }];
    setBlacklist(updated);
    StorageService.saveBlacklist(updated);
    // If current playing track is blacklisted, skip!
    if (currentSong && (currentSong.id === id || currentSong.artist === name)) {
      nextTrack();
    }
  };

  const removeFromBlacklist = (id: string) => {
    hapticFeedback();
    const updated = blacklist.filter((b) => b.id !== id);
    setBlacklist(updated);
    StorageService.saveBlacklist(updated);
  };

  const setEqualizerSettings = (settings: EqualizerSettings) => {
    setEqSettings(settings);
    StorageService.saveEqualizer(settings);
  };

  const setTheme = (newTheme: ThemeName) => {
    hapticFeedback();
    setThemeState(newTheme);
    StorageService.saveTheme(newTheme);
  };

  // Sleep Timer logic
  const setSleepTimer = (minutes: number) => {
    hapticFeedback();
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
    }
    const totalSecs = minutes * 60;
    setSleepTimerSeconds(totalSecs);

    sleepTimerIntervalRef.current = window.setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (prev === null || prev <= 1) {
          if (sleepTimerIntervalRef.current) clearInterval(sleepTimerIntervalRef.current);
          // Pause playback
          if (currentSong?.source === 'youtube') {
            ytControllerRef.current?.pause();
          } else if (htmlAudioRef.current) {
            htmlAudioRef.current.pause();
          }
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSleepTimer = () => {
    hapticFeedback();
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    setSleepTimerSeconds(null);
  };

  const isSongCached = (songId: string) => {
    return cachedSongIds.has(songId);
  };

  const cacheSong = async (song: Song, audioBlob?: Blob) => {
    hapticFeedback();
    const ok = await offlineCacheService.cacheSong(song, audioBlob);
    return ok;
  };

  const removeCachedSong = async (songId: string) => {
    hapticFeedback();
    const ok = await offlineCacheService.removeCachedSong(songId);
    return ok;
  };

  const clearOfflineCache = async () => {
    hapticFeedback();
    const ok = await offlineCacheService.clearAllCache();
    return ok;
  };

  const updateCacheConfig = async (config: CacheConfig) => {
    hapticFeedback();
    setCacheConfigState(config);
    await offlineCacheService.saveCacheConfig(config);
  };

  const addLocalSongs = (songs: Song[]) => {
    const existing = StorageService.getLocalSongs();
    const combined = [...songs, ...existing];
    StorageService.saveLocalSongs(combined);
    setQueue((prev) => [...songs, ...prev]);
  };

  const isArtistFollowed = (artistId: string) => {
    return savedArtists.some((a) => a.id === artistId);
  };

  const toggleFollowArtist = (artist: Artist) => {
    hapticFeedback();
    setSavedArtists((prev) => {
      let updated: Artist[];
      if (prev.some((a) => a.id === artist.id)) {
        updated = prev.filter((a) => a.id !== artist.id);
      } else {
        updated = [artist, ...prev];
      }
      StorageService.saveSavedArtists(updated);
      return updated;
    });
  };

  const isAlbumSaved = (albumId: string) => {
    return savedAlbums.some((a) => a.id === albumId);
  };

  const toggleSaveAlbum = (album: Album) => {
    hapticFeedback();
    setSavedAlbums((prev) => {
      let updated: Album[];
      if (prev.some((a) => a.id === album.id)) {
        updated = prev.filter((a) => a.id !== album.id);
      } else {
        updated = [album, ...prev];
      }
      StorageService.saveSavedAlbums(updated);
      return updated;
    });
  };

  const importRiplaySqliteBackup = async (file: File): Promise<RiplayImportSummary> => {
    hapticFeedback();
    const buffer = await file.arrayBuffer();
    const summary = await RiplaySqliteImporter.importFromDatabaseBuffer(buffer);

    // 1. Merge playlists (avoid duplicates by id or title)
    setPlaylists((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newPlaylists = summary.importedPlaylists.filter((p) => !existingIds.has(p.id));
      const combined = [...newPlaylists, ...prev];
      StorageService.savePlaylists(combined);
      return combined;
    });

    // 2. Merge liked songs
    setLikedSongs((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const newLiked = summary.importedLikedSongs.filter((s) => !existingIds.has(s.id));
      const combined = [...newLiked, ...prev];
      StorageService.saveLikedSongs(combined);
      return combined;
    });

    // 3. Merge history
    if (summary.importedHistory.length > 0) {
      setHistory((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const newHist = summary.importedHistory.filter((s) => !existingIds.has(s.id));
        const combined = [...newHist, ...prev].slice(0, 50);
        StorageService.saveHistory(combined);
        return combined;
      });
    }

    // 4. Merge blacklist
    if (summary.importedBlacklist.length > 0) {
      setBlacklist((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newBl = summary.importedBlacklist.filter((b) => !existingIds.has(b.id));
        const combined = [...prev, ...newBl];
        StorageService.saveBlacklist(combined);
        return combined;
      });
    }

    // 5. Save imported artists & albums
    if (summary.importedArtists.length > 0) {
      setImportedArtists((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newArtists = summary.importedArtists.filter((a) => !existingIds.has(a.id));
        const combined = [...prev, ...newArtists];
        StorageService.saveCustomArtists(combined);
        return combined;
      });
    }

    if (summary.importedAlbums.length > 0) {
      setImportedAlbums((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newAlbums = summary.importedAlbums.filter((a) => !existingIds.has(a.id));
        const combined = [...prev, ...newAlbums];
        StorageService.saveCustomAlbums(combined);
        return combined;
      });
    }

    // 6. Update user stats
    setUserStats((prev) => {
      const addedPlays = summary.importedSongs.reduce((acc, s) => acc + (s.playCount || 0), 0);
      const addedMinutes = Math.round(
        summary.importedSongs.reduce((acc, s) => acc + ((s.playCount || 0) * (s.duration || 180)) / 60, 0)
      );
      const updated: UserStats = {
        ...prev,
        totalPlays: prev.totalPlays + addedPlays,
        totalMinutes: prev.totalMinutes + addedMinutes,
      };
      StorageService.saveUserStats(updated);
      return updated;
    });

    // 7. Auto-cache metadata and lyrics for offline playback
    for (const song of summary.importedSongs.slice(0, 40)) {
      if (song.lyrics) {
        offlineCacheService.cacheSong(song).catch(() => {});
      }
    }

    // 8. If queue is default or empty, switch to first imported playlist
    if (summary.importedPlaylists.length > 0 && summary.importedPlaylists[0].songs.length > 0) {
      const firstPl = summary.importedPlaylists[0];
      setQueue(firstPl.songs);
      setQueueIndex(0);
      setCurrentSong(firstPl.songs[0]);
    } else if (summary.importedLikedSongs.length > 0) {
      setQueue(summary.importedLikedSongs);
      setQueueIndex(0);
      setCurrentSong(summary.importedLikedSongs[0]);
    }

    setLastImportSummary(summary);
    StorageService.saveLastImportSummary(summary);

    return summary;
  };

  return (
    <MusicContext.Provider
      value={{
        currentSong,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isShuffle,
        queue,
        queueIndex,
        playerMode,
        setPlayerMode,
        isPlayerOpen,
        setIsPlayerOpen,
        isQueueOpen,
        setIsQueueOpen,
        isEqualizerOpen,
        setIsEqualizerOpen,
        isSleepTimerOpen,
        setIsSleepTimerOpen,
        isSongInfoOpen,
        setIsSongInfoOpen,
        isPWAInstallModalOpen,
        setIsPWAInstallModalOpen,
        isRiplayImportOpen,
        setIsRiplayImportOpen,
        selectedPlaylist,
        setSelectedPlaylist,
        selectedArtistId,
        setSelectedArtistId,
        selectedAlbum,
        setSelectedAlbum,
        activeTab,
        setActiveTab,
        currentLyrics,
        isLoadingLyrics,
        playSong,
        togglePlay,
        seekTo,
        nextTrack,
        prevTrack,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        reorderQueue,
        likedSongs,
        toggleLike,
        isLiked,
        playlists,
        createPlaylist,
        addToPlaylist,
        removeFromPlaylist,
        deletePlaylist,
        history,
        clearHistory,
        blacklist,
        addToBlacklist,
        removeFromBlacklist,
        isBlacklisted,
        userStats,
        equalizerSettings,
        setEqualizerSettings,
        sleepTimerSeconds,
        setSleepTimer,
        cancelSleepTimer,
        theme,
        setTheme,
        themeColors,
        hapticFeedback,
        addLocalSongs,
        cachedSongIds,
        cachedTracks,
        isSongCached,
        cacheSong,
        removeCachedSong,
        clearOfflineCache,
        cacheConfig,
        updateCacheConfig,
        storageEstimate,
        importRiplaySqliteBackup,
        importedArtists,
        importedAlbums,
        lastImportSummary,
        savedArtists,
        toggleFollowArtist,
        isArtistFollowed,
        savedAlbums,
        toggleSaveAlbum,
        isAlbumSaved,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};
