import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import {
  Song,
  Playlist,
  Artist,
  Album,
  RepeatMode,
  EqualizerSettings,
  ThemeName,
  ThemeColors,
  UserStats,
  LyricsData,
  NamedQueue,
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
import { getSubAudibleAudioUri, audioFocusManager } from '../utils/audioWakeLock';
import { extractDynamicPalette } from '../utils/colorExtractor';

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
  isExitConfirmOpen: boolean;
  setIsExitConfirmOpen: (open: boolean) => void;

  // Selected entities for detail screens
  selectedPlaylist: Playlist | null;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  selectedArtistId: string | null;
  setSelectedArtistId: (artistId: string | null) => void;
  selectedArtist: Artist | null;
  setSelectedArtist: (artist: Artist | null) => void;
  selectedAlbum: Album | null;
  setSelectedAlbum: (album: Album | null) => void;

  // Active navigation
  activeTab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings';
  setActiveTab: (tab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings') => void;

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

  // Multiple Queues (Toggleable in Settings)
  enableMultipleQueues: boolean;
  setEnableMultipleQueues: (enabled: boolean) => void;
  queues: NamedQueue[];
  activeQueueId: string;
  activeQueueName: string;
  switchQueue: (queueId: string) => void;
  createQueue: (name: string, songs?: Song[]) => void;
  renameQueue: (queueId: string, newName: string) => void;
  deleteQueue: (queueId: string) => void;
  addPlaylistToQueue: (playlistOrSongs: Playlist | Song[], mode?: 'replace' | 'append' | 'next') => void;

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
  const [activeTab, setActiveTabState] = useState<'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['home', 'explore', 'search', 'library', 'rewind', 'settings'].includes(hash)) {
        return hash as any;
      }
      const saved = localStorage.getItem('muzika_active_tab');
      if (saved && ['home', 'explore', 'search', 'library', 'rewind', 'settings'].includes(saved)) {
        return saved as any;
      }
    }
    return 'home';
  });

  const setActiveTab = (tab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('muzika_active_tab', tab);
    }
  };

  const [isPlayerOpen, setIsPlayerOpenState] = useState(false);
  const [isQueueOpen, setIsQueueOpenState] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpenState] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpenState] = useState(false);
  const [isSongInfoOpen, setIsSongInfoOpenState] = useState(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpenState] = useState(false);
  const [isRiplayImportOpen, setIsRiplayImportOpenState] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState<'audio' | 'video' | 'lyrics'>('audio');

  const [selectedPlaylist, setSelectedPlaylistState] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistIdState] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbumState] = useState<Album | null>(null);

  const setIsPlayerOpen = (open: boolean) => setIsPlayerOpenState(open);
  const setIsQueueOpen = (open: boolean) => setIsQueueOpenState(open);
  const setIsEqualizerOpen = (open: boolean) => setIsEqualizerOpenState(open);
  const setIsSleepTimerOpen = (open: boolean) => setIsSleepTimerOpenState(open);
  const setIsSongInfoOpen = (open: boolean) => setIsSongInfoOpenState(open);
  const setIsPWAInstallModalOpen = (open: boolean) => setIsPWAInstallModalOpenState(open);
  const setIsRiplayImportOpen = (open: boolean) => setIsRiplayImportOpenState(open);
  const setSelectedPlaylist = (playlist: Playlist | null) => setSelectedPlaylistState(playlist);
  const setSelectedArtistId = (artistId: string | null) => {
    setSelectedArtistIdState(artistId);
    if (!artistId) setSelectedArtist(null);
  };
  const setSelectedAlbum = (album: Album | null) => setSelectedAlbumState(album);

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
  const [dynamicColors, setDynamicColors] = useState<ThemeColors | null>(null);
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

  // Multiple Queues feature (Toggleable in Settings)
  const [enableMultipleQueues, setEnableMultipleQueuesState] = useState<boolean>(() => StorageService.getEnableMultipleQueues());
  const [activeQueueId, setActiveQueueIdState] = useState<string>(() => StorageService.getActiveQueueId());
  const [queues, setQueuesState] = useState<NamedQueue[]>(() => {
    const saved = StorageService.getNamedQueues();
    if (saved && saved.length > 0) return saved;
    return [
      { id: 'queue-main', name: 'Main Queue', songs: queue, queueIndex: 0, createdAt: Date.now() },
      { id: 'queue-workout', name: 'Workout Session', songs: [INITIAL_SONGS[1], INITIAL_SONGS[0]], queueIndex: 0, createdAt: Date.now() },
      { id: 'queue-focus', name: 'Focus & Study', songs: [INITIAL_SONGS[2], INITIAL_SONGS[3]], queueIndex: 0, createdAt: Date.now() },
    ];
  });

  const setEnableMultipleQueues = (enabled: boolean) => {
    hapticFeedback();
    setEnableMultipleQueuesState(enabled);
    StorageService.saveEnableMultipleQueues(enabled);
  };

  const activeQueueName = useMemo(() => {
    const q = queues.find((item) => item.id === activeQueueId);
    return q ? q.name : 'Main Queue';
  }, [queues, activeQueueId]);

  // Keep current active queue in queues state synchronized
  useEffect(() => {
    if (!enableMultipleQueues) return;
    setQueuesState((prev) => {
      const idx = prev.findIndex((q) => q.id === activeQueueId);
      if (idx === -1) {
        const newQueueItem: NamedQueue = {
          id: activeQueueId,
          name: activeQueueId === 'queue-main' ? 'Main Queue' : 'Custom Queue',
          songs: queue,
          queueIndex,
          createdAt: Date.now(),
        };
        const updated = [...prev, newQueueItem];
        StorageService.saveNamedQueues(updated);
        return updated;
      }
      const updated = [...prev];
      updated[idx] = { ...updated[idx], songs: queue, queueIndex };
      StorageService.saveNamedQueues(updated);
      return updated;
    });
  }, [queue, queueIndex, activeQueueId, enableMultipleQueues]);

  const switchQueue = (queueId: string) => {
    hapticFeedback();
    const target = queues.find((q) => q.id === queueId);
    if (!target) return;

    // Save current queue state
    setQueuesState((prev) => {
      const updated = prev.map((q) => {
        if (q.id === activeQueueId) {
          return { ...q, songs: queueRef.current, queueIndex: queueIndexRef.current || 0 };
        }
        return q;
      });
      StorageService.saveNamedQueues(updated);
      return updated;
    });

    setActiveQueueIdState(queueId);
    StorageService.saveActiveQueueId(queueId);

    const targetSongs = target.songs && target.songs.length > 0 ? target.songs : INITIAL_SONGS;
    const targetIdx = Math.min(target.queueIndex || 0, targetSongs.length - 1);
    setQueue(targetSongs);
    queueRef.current = targetSongs;
    setQueueIndex(targetIdx);
    queueIndexRef.current = targetIdx;

    const targetSong = targetSongs[targetIdx] || targetSongs[0];
    if (targetSong) {
      playIndex(targetIdx, 0, targetSongs, targetSong);
    }
  };

  const createQueue = (name: string, initialSongs?: Song[]) => {
    hapticFeedback();
    const newId = `queue-${Date.now()}`;
    const songsToUse = initialSongs && initialSongs.length > 0 ? initialSongs : (currentSong ? [currentSong] : INITIAL_SONGS);
    const newQueueItem: NamedQueue = {
      id: newId,
      name: name.trim() || 'New Queue',
      songs: songsToUse,
      queueIndex: 0,
      createdAt: Date.now(),
    };
    setQueuesState((prev) => {
      const updated = [...prev, newQueueItem];
      StorageService.saveNamedQueues(updated);
      return updated;
    });
    switchQueue(newId);
  };

  const renameQueue = (queueId: string, newName: string) => {
    hapticFeedback();
    if (!newName.trim()) return;
    setQueuesState((prev) => {
      const updated = prev.map((q) => (q.id === queueId ? { ...q, name: newName.trim() } : q));
      StorageService.saveNamedQueues(updated);
      return updated;
    });
  };

  const deleteQueue = (queueId: string) => {
    hapticFeedback();
    if (queueId === 'queue-main') return;
    setQueuesState((prev) => {
      const updated = prev.filter((q) => q.id !== queueId);
      StorageService.saveNamedQueues(updated);
      return updated;
    });
    if (activeQueueId === queueId) {
      switchQueue('queue-main');
    }
  };

  const addPlaylistToQueue = (playlistOrSongs: Playlist | Song[], mode: 'replace' | 'append' | 'next' = 'append') => {
    hapticFeedback();
    const songs = Array.isArray(playlistOrSongs) ? playlistOrSongs : playlistOrSongs.songs;
    if (!songs || songs.length === 0) return;

    if (mode === 'replace') {
      playSong(songs[0], songs);
    } else if (mode === 'next') {
      setQueue((prev) => {
        const newQ = [...prev];
        newQ.splice(queueIndex + 1, 0, ...songs);
        return newQ;
      });
    } else {
      setQueue((prev) => [...prev, ...songs]);
    }
  };

  // Track latest navigation and modal states in a ref to avoid stale closures and re-binding loops
  const navStateRef = useRef({
    activeTab,
    isPlayerOpen,
    isQueueOpen,
    isEqualizerOpen,
    isSleepTimerOpen,
    isSongInfoOpen,
    isPWAInstallModalOpen,
    isRiplayImportOpen,
    isExitConfirmOpen,
    selectedPlaylist,
    selectedArtistId,
    selectedArtist,
    selectedAlbum,
  });

  useEffect(() => {
    navStateRef.current = {
      activeTab,
      isPlayerOpen,
      isQueueOpen,
      isEqualizerOpen,
      isSleepTimerOpen,
      isSongInfoOpen,
      isPWAInstallModalOpen,
      isRiplayImportOpen,
      isExitConfirmOpen,
      selectedPlaylist,
      selectedArtistId,
      selectedArtist,
      selectedAlbum,
    };
  }, [
    activeTab,
    isPlayerOpen,
    isQueueOpen,
    isEqualizerOpen,
    isSleepTimerOpen,
    isSongInfoOpen,
    isPWAInstallModalOpen,
    isRiplayImportOpen,
    isExitConfirmOpen,
    selectedPlaylist,
    selectedArtistId,
    selectedArtist,
    selectedAlbum,
  ]);

  const ensureHistoryTrap = () => {
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({ muzikaApp: true }, '');
      } catch {}
    }
  };

  // Initialize history trap and handle hardware back button navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({ muzikaRoot: true }, '');
        window.history.pushState({ muzikaApp: true }, '');
      } catch {}
    }

    const handlePopState = () => {
      const state = navStateRef.current;

      // 1. If Exit confirmation modal is open, back button dismisses it
      if (state.isExitConfirmOpen) {
        setIsExitConfirmOpen(false);
        ensureHistoryTrap();
        return;
      }

      // 2. Modals & sheets in order of depth
      if (state.isSongInfoOpen) {
        setIsSongInfoOpenState(false);
        ensureHistoryTrap();
        return;
      }
      if (state.isQueueOpen) {
        setIsQueueOpenState(false);
        ensureHistoryTrap();
        return;
      }
      if (state.isEqualizerOpen) {
        setIsEqualizerOpenState(false);
        ensureHistoryTrap();
        return;
      }
      if (state.isSleepTimerOpen) {
        setIsSleepTimerOpenState(false);
        ensureHistoryTrap();
        return;
      }
      if (state.isRiplayImportOpen) {
        setIsRiplayImportOpenState(false);
        ensureHistoryTrap();
        return;
      }
      if (state.isPWAInstallModalOpen) {
        setIsPWAInstallModalOpenState(false);
        ensureHistoryTrap();
        return;
      }

      // 3. Entity Detail screens
      if (state.selectedPlaylist) {
        setSelectedPlaylistState(null);
        ensureHistoryTrap();
        return;
      }
      if (state.selectedArtistId || state.selectedArtist) {
        setSelectedArtistIdState(null);
        setSelectedArtist(null);
        ensureHistoryTrap();
        return;
      }
      if (state.selectedAlbum) {
        setSelectedAlbumState(null);
        ensureHistoryTrap();
        return;
      }

      // 4. In app player: close player and navigate to Home screen
      if (state.isPlayerOpen) {
        setIsPlayerOpenState(false);
        setActiveTabState('home');
        if (typeof window !== 'undefined') {
          localStorage.setItem('muzika_active_tab', 'home');
        }
        ensureHistoryTrap();
        return;
      }

      // 5. If on another tab, navigate back to Home screen
      if (state.activeTab !== 'home') {
        setActiveTabState('home');
        if (typeof window !== 'undefined') {
          localStorage.setItem('muzika_active_tab', 'home');
        }
        ensureHistoryTrap();
        return;
      }

      // 6. We are on Home with no modals open: Prompt user before quitting!
      ensureHistoryTrap();
      setIsExitConfirmOpen(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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

  useEffect(() => {
    if (theme === 'dynamic') {
      let isMounted = true;
      extractDynamicPalette(currentSong?.thumbnailUrl).then((palette) => {
        if (isMounted) setDynamicColors(palette);
      });
      return () => { isMounted = false; };
    } else {
      setDynamicColors(null);
    }
  }, [theme, currentSong?.thumbnailUrl]);

  const themeColors = useMemo(() => {
    if (theme === 'dynamic' && dynamicColors) return dynamicColors;
    return THEMES[theme] || THEMES.riplay;
  }, [theme, dynamicColors]);

  // Initialize Hardware Audio Wake-Lock Carrier Loop
  useEffect(() => {
    const carrierUri = getSubAudibleAudioUri();
    const silentAudio = new Audio(carrierUri);
    silentAudio.loop = true;
    silentAudio.volume = 0.02; // Threshold needed for Android AudioTrack mixer to keep hardware audio active
    (silentAudio as any).playsInline = true;
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('x-webkit-airplay', 'allow');
    silentKeepAliveRef.current = silentAudio;

    return () => {
      silentAudio.pause();
      audioFocusManager.stop();
    };
  }, []);

  // Synchronize Audio Focus Wake-Lock whenever playback is active
  useEffect(() => {
    if (isPlaying) {
      audioFocusManager.start();
      silentKeepAliveRef.current?.play().catch(() => {});
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        (navigator as any).wakeLock?.request('screen').catch(() => {});
      }
    } else {
      silentKeepAliveRef.current?.pause();
      audioFocusManager.stop();
    }
  }, [isPlaying]);

  // Handle visibilitychange safeguard (prevent mobile OS from throttling background playback)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isPlayingRef.current && !userPausedRef.current) {
        audioFocusManager.start();
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
        // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: video cued
        if (activeEngineRef.current === 'youtube') {
          if (state === 1) {
            setIsPlaying(true);
            userPausedRef.current = false;
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          } else if (state === 2) {
            // Check if this was a user-initiated pause or browser background throttle pause
            if (!userPausedRef.current && isPlayingRef.current) {
              console.log('[YouTube Player] Background throttle pause intercepted; resuming playback...');
              ytControllerRef.current?.play();
              return;
            }
            setIsPlaying(false);
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'paused';
            }
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

  const playIndex = async (index: number, startAtSecond?: number, overrideQueue?: Song[], overrideSong?: Song) => {
    const activeQueue = overrideQueue || queueRef.current;
    if (index < 0 || index >= activeQueue.length) return;
    const song = overrideSong || activeQueue[index];
    if (!song) return;

    // Check blacklist: if blacklisted, try skip to next
    if (isBlacklisted(song)) {
      if (index + 1 < activeQueue.length) {
        playIndex(index + 1, 0, activeQueue);
        return;
      }
    }

    userPausedRef.current = false;
    audioFocusManager.start();
    const startPos = typeof startAtSecond === 'number' ? startAtSecond : 0;
    setQueue(activeQueue);
    queueRef.current = activeQueue;
    setQueueIndex(index);
    queueIndexRef.current = index;
    setCurrentSong(song);
    currentSongRef.current = song;
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
      if (ytControllerRef.current) ytControllerRef.current.pause();
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
        silentKeepAliveRef.current?.play().catch(() => {});
      }
    } else {
      // 2. Resolve direct 320kbps full-length audio stream URL
      const directStreamUrl = await OnlineMusicService.resolveStreamUrl(song);

      if (directStreamUrl && htmlAudioRef.current) {
        activeEngineRef.current = 'html';
        if (ytControllerRef.current) ytControllerRef.current.pause();
        if (htmlAudioRef.current.src !== directStreamUrl) {
          htmlAudioRef.current.src = directStreamUrl;
        }
        if (startPos > 0) {
          try {
            htmlAudioRef.current.currentTime = startPos;
          } catch {}
        }
        htmlAudioRef.current.play().catch(() => {});
        silentKeepAliveRef.current?.play().catch(() => {});
      } else {
        // 3. Fallback: YouTube iframe engine
        activeEngineRef.current = 'youtube';
        if (htmlAudioRef.current) {
          htmlAudioRef.current.pause();
        }
        const ytId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : song.id);
        ytControllerRef.current?.loadVideoById(ytId, startPos);
        ytControllerRef.current?.play();
        silentKeepAliveRef.current?.play().catch(() => {});
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
    audioFocusManager.start();

    let newQueue: Song[];
    let targetIndex: number;

    if (customQueue && customQueue.length > 0) {
      newQueue = customQueue;
      targetIndex = customQueue.findIndex((s) => s.id === song.id);
      if (targetIndex === -1) {
        newQueue = [song, ...customQueue];
        targetIndex = 0;
      }
    } else {
      const currentQ = queueRef.current;
      const existingIdx = currentQ.findIndex((s) => s.id === song.id);
      if (existingIdx !== -1) {
        newQueue = currentQ;
        targetIndex = existingIdx;
      } else {
        newQueue = [song, ...currentQ];
        targetIndex = 0;
      }
    }

    setQueue(newQueue);
    queueRef.current = newQueue;
    playIndex(targetIndex, 0, newQueue, song);
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
      audioFocusManager.stop();
      silentKeepAliveRef.current?.pause();
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
      audioFocusManager.start();
      silentKeepAliveRef.current?.play().catch(() => {});
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
    
    // Yield to let UI update state before heavy parsing
    await new Promise((r) => setTimeout(r, 10));
    const summary = await RiplaySqliteImporter.importFromDatabaseBuffer(buffer);
    await new Promise((r) => setTimeout(r, 10));

    // 1. Merge playlists (avoid duplicates by id or normalized title)
    setPlaylists((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const existingTitles = new Set(prev.map((p) => (p.title || '').toLowerCase().trim()));
      const newPlaylists = summary.importedPlaylists.filter(
        (p) => !existingIds.has(p.id) && !existingTitles.has((p.title || '').toLowerCase().trim())
      );
      const combined = [...newPlaylists, ...prev];
      StorageService.savePlaylists(combined);
      return combined;
    });

    // 2. Merge liked songs (avoid duplicates by id or title+artist)
    setLikedSongs((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const existingKeys = new Set(prev.map((s) => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`));
      const newLiked = summary.importedLikedSongs.filter(
        (s) => !existingIds.has(s.id) && !existingKeys.has(`${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`)
      );
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

    // 5. Save imported artists & albums with deduplication
    if (summary.importedArtists.length > 0) {
      setImportedArtists((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const existingNames = new Set(prev.map((a) => (a.name || '').toLowerCase().trim()));
        const newArtists = summary.importedArtists.filter(
          (a) => !existingIds.has(a.id) && !existingNames.has((a.name || '').toLowerCase().trim())
        );
        const combined = [...prev, ...newArtists];
        StorageService.saveCustomArtists(combined);
        return combined;
      });
      setSavedArtists((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const existingNames = new Set(prev.map((a) => (a.name || '').toLowerCase().trim()));
        const newArtists = summary.importedArtists.filter(
          (a) => !existingIds.has(a.id) && !existingNames.has((a.name || '').toLowerCase().trim())
        );
        const combined = [...prev, ...newArtists];
        StorageService.saveSavedArtists(combined);
        return combined;
      });
    }

    if (summary.importedAlbums.length > 0) {
      setImportedAlbums((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const existingTitles = new Set(prev.map((a) => (a.title || '').toLowerCase().trim()));
        const newAlbums = summary.importedAlbums.filter(
          (a) => !existingIds.has(a.id) && !existingTitles.has((a.title || '').toLowerCase().trim())
        );
        const combined = [...prev, ...newAlbums];
        StorageService.saveCustomAlbums(combined);
        return combined;
      });
      setSavedAlbums((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const existingTitles = new Set(prev.map((a) => (a.title || '').toLowerCase().trim()));
        const newAlbums = summary.importedAlbums.filter(
          (a) => !existingIds.has(a.id) && !existingTitles.has((a.title || '').toLowerCase().trim())
        );
        const combined = [...prev, ...newAlbums];
        StorageService.saveSavedAlbums(combined);
        return combined;
      });
    }

    // 6. Update user stats safely
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

    // 7. If active queue is default or empty, switch to first imported playlist
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
        isExitConfirmOpen,
        setIsExitConfirmOpen,
        selectedPlaylist,
        setSelectedPlaylist,
        selectedArtistId,
        setSelectedArtistId,
        selectedArtist,
        setSelectedArtist,
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
        enableMultipleQueues,
        setEnableMultipleQueues,
        queues,
        activeQueueId,
        activeQueueName,
        switchQueue,
        createQueue,
        renameQueue,
        deleteQueue,
        addPlaylistToQueue,
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
