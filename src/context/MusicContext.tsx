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
import { webAudioEqualizer } from '../utils/webAudioEqualizer';

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
  cachingSongIds: Set<string>;
  cachedTracks: CachedTrackRecord[];
  isSongCached: (songId: string) => boolean;
  isSongCaching: (songId: string) => boolean;
  getSongCoverUrl: (song?: { id?: string; thumbnailUrl?: string } | null) => string;
  cacheSong: (song: Song, audioBlob?: Blob, silent?: boolean) => Promise<boolean>;
  removeCachedSong: (songId: string) => Promise<boolean>;
  clearOfflineCache: () => Promise<boolean>;
  batchCacheState: { active: boolean; targetId?: string; total: number; completed: number; failed: number } | null;
  cacheSongsBatch: (songs: Song[], targetId?: string, label?: string) => Promise<void>;
  cancelBatchCache: () => void;
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

  // Modals, Quick Actions & Toast Notifications
  addToPlaylistTargetSong: Song | null;
  setAddToPlaylistTargetSong: (song: Song | null) => void;
  songOptionsMenuTarget: { song: Song; queueContext?: Song[] } | null;
  setSongOptionsMenuTarget: (target: { song: Song; queueContext?: Song[] } | null) => void;
  syncTargetSong: Song | null;
  setSyncTargetSong: (song: Song | null) => void;
  previewingSongId: string | null;
  previewSongCandidate: (candidate: Song) => Promise<void>;
  stopPreviewCandidate: () => void;
  applySongSync: (originalSong: Song, matchedSong: Song, playImmediately?: boolean) => Promise<Song>;
  autoSyncSong: (song: Song) => Promise<Song | null>;
  toastMessage: string | null;
  showToast: (message: string) => void;
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

  // Quick Action Modals & Toast State
  const [addToPlaylistTargetSong, setAddToPlaylistTargetSong] = useState<Song | null>(null);
  const [songOptionsMenuTarget, setSongOptionsMenuTarget] = useState<{ song: Song; queueContext?: Song[] } | null>(null);
  const [syncTargetSong, setSyncTargetSong] = useState<Song | null>(null);
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

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

  const [queue, setQueue] = useState<Song[]>(() => (initialPlaybackState?.queue?.length ? initialPlaybackState.queue : []));
  const [queueIndex, setQueueIndex] = useState<number>(() => initialPlaybackState?.queueIndex ?? 0);
  const [currentSong, setCurrentSong] = useState<Song | null>(() => initialPlaybackState?.song ?? null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => initialPlaybackState?.currentTime ?? 0);
  const [duration, setDuration] = useState<number>(() => initialPlaybackState?.duration ?? 0);
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
  const equalizerSettingsRef = useRef<EqualizerSettings>(equalizerSettings);
  equalizerSettingsRef.current = equalizerSettings;

  // Real-time Web Audio API DSP Equalizer synchronization (stores settings even before Audio mounts)
  useEffect(() => {
    webAudioEqualizer.applySettings(equalizerSettings);
    if (htmlAudioRef.current) {
      webAudioEqualizer.init(htmlAudioRef.current);
      webAudioEqualizer.applySettings(equalizerSettings);
    }
  }, [equalizerSettings]);
  const [theme, setThemeState] = useState<ThemeName>(() => StorageService.getTheme());
  const [dynamicColors, setDynamicColors] = useState<ThemeColors | null>(null);
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);

  // Offline Cache states (IndexedDB)
  const [cachedSongIds, setCachedSongIds] = useState<Set<string>>(new Set());
  const [cachingSongIds, setCachingSongIds] = useState<Set<string>>(new Set());
  const [cachedTracks, setCachedTracks] = useState<CachedTrackRecord[]>([]);
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(DEFAULT_CACHE_CONFIG);
  const cacheConfigRef = useRef<CacheConfig>(DEFAULT_CACHE_CONFIG);
  cacheConfigRef.current = cacheConfig;
  const [batchCacheState, setBatchCacheState] = useState<{
    active: boolean;
    targetId?: string;
    total: number;
    completed: number;
    failed: number;
  } | null>(null);
  const batchCancelRef = useRef<boolean>(false);
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

    const targetSongs = target.songs && target.songs.length > 0 ? target.songs : [];
    const targetIdx = targetSongs.length > 0 ? Math.min(target.queueIndex || 0, targetSongs.length - 1) : 0;
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
    const songsToUse = initialSongs && initialSongs.length > 0 ? initialSongs : (currentSong ? [currentSong] : []);
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
    addToPlaylistTargetSong,
    songOptionsMenuTarget,
    syncTargetSong,
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
      addToPlaylistTargetSong,
      songOptionsMenuTarget,
      syncTargetSong,
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
    addToPlaylistTargetSong,
    songOptionsMenuTarget,
    syncTargetSong,
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

      // 2. Modals & sheets in top-most z-index order
      if (state.syncTargetSong) {
        setSyncTargetSong(null);
        ensureHistoryTrap();
        return;
      }
      if (state.addToPlaylistTargetSong) {
        setAddToPlaylistTargetSong(null);
        ensureHistoryTrap();
        return;
      }
      if (state.songOptionsMenuTarget) {
        setSongOptionsMenuTarget(null);
        ensureHistoryTrap();
        return;
      }
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

      // 3. Full-screen Player sits above Entity Detail screens (z-50 > z-40)
      if (state.isPlayerOpen) {
        setIsPlayerOpenState(false);
        ensureHistoryTrap();
        return;
      }

      // 4. Entity Detail screens
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
    const syncCacheState = async (includeConfig = false) => {
      const all = await offlineCacheService.getAllCachedSongs();
      if (!isMounted) return;
      const validIds = all.filter((s) => s.audioBlob && s.audioBlob.size > 1000).map((s) => s.id);
      setCachedSongIds(new Set(validIds));
      setCachedTracks(all);
      const totalBytes = all.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
      setStorageEstimate({ totalBytes, count: all.length });
      if (includeConfig) {
        const cfg = await offlineCacheService.getCacheConfig();
        if (isMounted) setCacheConfigState(cfg);
      }
    };

    syncCacheState(true);

    const unsub = offlineCacheService.subscribe(() => {
      syncCacheState(false);
    });

    const unsubCaching = offlineCacheService.subscribeCaching((ids) => {
      if (!isMounted) return;
      setCachingSongIds(ids);
    });

    return () => {
      isMounted = false;
      unsub();
      unsubCaching();
    };
  }, []);

  // Audio Engines
  const ytControllerRef = useRef<YouTubeController | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const isPreviewingRef = useRef<boolean>(false);
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
  const isTransitioningRef = useRef<boolean>(false);
  const playRequestIdRef = useRef<number>(0);
  const lastBlobUrlRef = useRef<string | null>(null);
  const preloadTimerRef = useRef<number | null>(null);
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const playIndexRef = useRef<
    (index: number, startAtSecond?: number, overrideQueue?: Song[], overrideSong?: Song) => Promise<void>
  >(async () => {});

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
      if (isPlayingRef.current && !userPausedRef.current && !isTransitioningRef.current) {
        audioFocusManager.start();
        silentKeepAliveRef.current?.play().catch(() => {});
        if (activeEngineRef.current === 'html' && htmlAudioRef.current) {
          const audio = htmlAudioRef.current;
          if (audio.paused && !audio.ended && !!(audio.currentSrc || audio.src)) {
            audio.play().catch(() => {});
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
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    (audio as any).playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    htmlAudioRef.current = audio;
    webAudioEqualizer.applySettings(equalizerSettingsRef.current);

    const handleTimeUpdate = () => {
      if (activeEngineRef.current === 'html') {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };

    const handleEnded = () => {
      if (activeEngineRef.current === 'html' && !isTransitioningRef.current) {
        handleTrackEndedRef.current();
      }
    };

    const handlePlay = () => {
      if (activeEngineRef.current === 'html') {
        setIsPlaying(true);
        webAudioEqualizer.ensureActive(audio, equalizerSettingsRef.current);
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
      }
    };

    const handlePlaying = () => {
      if (activeEngineRef.current === 'html') {
        webAudioEqualizer.ensureActive(audio, equalizerSettingsRef.current);
      }
    };

    const handlePause = () => {
      if (activeEngineRef.current === 'html') {
        if (isTransitioningRef.current) {
          return;
        }
        if (!userPausedRef.current && isPlayingRef.current) {
          const curAudio = htmlAudioRef.current;
          // Only resume unintended OS/background pause if track hasn't ended and has an active source
          if (curAudio && curAudio.paused && !curAudio.ended && !!(curAudio.currentSrc || curAudio.src)) {
            curAudio.play().catch(() => {});
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
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
    };
  }, []);

  // Initialize YouTube Iframe Controller
  useEffect(() => {
    const yt = new YouTubeController('muzika-yt-embed', {
      onStateChange: (state) => {
        // Ignore main player state updates while testing candidates inside Manual Sync modal
        if (isPreviewingRef.current) {
          if (state === 0) {
            isPreviewingRef.current = false;
            setPreviewingSongId(null);
          }
          return;
        }
        // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: video cued
        if (activeEngineRef.current === 'youtube') {
          if (isTransitioningRef.current) return;
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
            handleTrackEndedRef.current();
          }
        }
      },
      onTimeUpdate: (time, dur) => {
        if (isPreviewingRef.current) return;
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
    if (isTransitioningRef.current) return;
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
      playIndexRef.current(curIndex + 1);
    } else if (curRepeat === 'all') {
      playIndexRef.current(0);
    } else {
      setIsPlaying(false);
    }
  };
  handleTrackEndedRef.current = handleTrackEnded;

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
    stopPreviewCandidate();
    if (preloadTimerRef.current) {
      window.clearTimeout(preloadTimerRef.current);
      preloadTimerRef.current = null;
    }

    const activeQueue = overrideQueue || queueRef.current;
    if (index < 0 || index >= activeQueue.length) return;
    const rawSong = overrideSong || activeQueue[index];
    if (!rawSong) return;
    const song = StorageService.applySongSyncOverride(rawSong);

    // Check blacklist: if blacklisted, try skip to next
    if (isBlacklisted(song)) {
      if (index + 1 < activeQueue.length) {
        playIndex(index + 1, 0, activeQueue);
        return;
      }
    }

    const reqId = ++playRequestIdRef.current;
    isTransitioningRef.current = true;
    userPausedRef.current = false;
    audioFocusManager.start();

    // Immediately pause and detach the previous track's audio source BEFORE async resolution
    // so an ended HTML5 <audio> buffer can NEVER replay the previous song during transitions
    if (ytControllerRef.current) {
      try {
        ytControllerRef.current.pause();
      } catch {}
    }
    if (htmlAudioRef.current) {
      try {
        htmlAudioRef.current.pause();
        htmlAudioRef.current.removeAttribute('src');
        htmlAudioRef.current.load();
      } catch {}
    }
    if (lastBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(lastBlobUrlRef.current);
      } catch {}
      lastBlobUrlRef.current = null;
    }

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

    // Check if track has a cached real audio blob in IndexedDB
    const cachedData = await offlineCacheService.getCachedTrackAudioUrl(song.id);
    if (playRequestIdRef.current !== reqId) {
      if (cachedData?.audioUrl) {
        try {
          URL.revokeObjectURL(cachedData.audioUrl);
        } catch {}
      }
      return;
    }
    if (userPausedRef.current) {
      isTransitioningRef.current = false;
      if (cachedData?.audioUrl) {
        try {
          URL.revokeObjectURL(cachedData.audioUrl);
        } catch {}
      }
      setIsPlaying(false);
      return;
    }

    // Unlock & prime WebAudio EQ synchronously on user playback gesture
    if (htmlAudioRef.current) {
      webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
    }

    // 1. If cached real audio is available, play via native HTML5 <audio>
    if (cachedData && cachedData.audioUrl) {
      activeEngineRef.current = 'html';
      lastBlobUrlRef.current = cachedData.audioUrl;
      if (cachedData.coverUrl) {
        const hydratedSong = { ...song, thumbnailUrl: cachedData.coverUrl };
        setCurrentSong(hydratedSong);
        currentSongRef.current = hydratedSong;
      }
      if (ytControllerRef.current) ytControllerRef.current.pause();
      isTransitioningRef.current = false;
      if (htmlAudioRef.current) {
        webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
        htmlAudioRef.current.src = cachedData.audioUrl;
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
      if (playRequestIdRef.current !== reqId) return;
      if (userPausedRef.current) {
        isTransitioningRef.current = false;
        setIsPlaying(false);
        return;
      }

      isTransitioningRef.current = false;
      if (directStreamUrl && htmlAudioRef.current) {
        activeEngineRef.current = 'html';
        if (ytControllerRef.current) ytControllerRef.current.pause();
        htmlAudioRef.current.src = directStreamUrl;
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

    // Pre-resolve next queued track's stream URL in background so track changes are instantaneous
    const nextRawSong = activeQueue[index + 1];
    if (nextRawSong && (typeof navigator === 'undefined' || navigator.onLine)) {
      const nextSong = StorageService.applySongSyncOverride(nextRawSong);
      if (!nextSong.streamUrl && !offlineCacheService.isCachedSync(nextSong.id)) {
        preloadTimerRef.current = window.setTimeout(() => {
          if (playRequestIdRef.current === reqId) {
            OnlineMusicService.resolveStreamUrl(nextSong).catch(() => {});
          }
        }, 1500);
      }
    }

    // Auto-cache real audio stream in background ONLY when enabled, online, not already cached,
    // and playing via direct HTML5 audio stream (YouTube-iframe-only fallback tracks have no downloadable stream)
    const isAlreadyCached = !!(cachedData && cachedData.audioUrl);
    const isOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (
      cacheConfigRef.current.autoCacheOnPlay &&
      !isAlreadyCached &&
      isOnline &&
      activeEngineRef.current === 'html' &&
      !!song.streamUrl
    ) {
      offlineCacheService.cacheSong(song).catch(() => {});
    }
  };
  playIndexRef.current = playIndex;

  const playSong = (song: Song, customQueue?: Song[]) => {
    hapticFeedback();
    userPausedRef.current = false;
    audioFocusManager.start();
    if (htmlAudioRef.current) {
      webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
    }

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
      if (htmlAudioRef.current) {
        webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
      }
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
    let added = false;
    let targetPlTitle = 'Playlist';
    setPlaylists((prev) => {
      const updated = prev.map((pl) => {
        if (pl.id === playlistId) {
          targetPlTitle = pl.title;
          if (!pl.songs.some((s) => s.id === song.id)) {
            added = true;
            const newPl = { ...pl, songs: [...pl.songs, song] };
            if (selectedPlaylist?.id === playlistId) {
              setSelectedPlaylistState(newPl);
            }
            return newPl;
          }
        }
        return pl;
      });
      StorageService.savePlaylists(updated);
      return updated;
    });
    if (added) {
      showToast(`Added "${song.title}" to ${targetPlTitle}`);
    } else {
      showToast(`"${song.title}" is already in ${targetPlTitle}`);
    }
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

  const isSongCaching = (songId: string) => {
    return cachingSongIds.has(songId);
  };

  const getSongCoverUrl = (song?: { id?: string; thumbnailUrl?: string } | null): string => {
    if (!song) return '';
    if (song.id) {
      const offlineCover = offlineCacheService.getCachedCoverUrl(song.id);
      if (offlineCover) return offlineCover;
    }
    return song.thumbnailUrl || '';
  };

  const cacheSong = async (song: Song, audioBlob?: Blob, silent = false) => {
    hapticFeedback();
    if (typeof navigator !== 'undefined' && !navigator.onLine && !audioBlob) {
      if (!silent) showToast('You are offline — connect to internet to cache');
      return false;
    }
    const ok = await offlineCacheService.cacheSong(song, audioBlob);
    if (!silent) {
      if (ok) {
        showToast(`Saved "${song.title}" for offline playback`);
      } else {
        showToast(`Offline audio unavailable for "${song.title}" — try Sync`);
      }
    }
    return ok;
  };

  const cancelBatchCache = () => {
    hapticFeedback();
    batchCancelRef.current = true;
  };

  const cacheSongsBatch = async (songs: Song[], targetId?: string, label = 'playlist') => {
    hapticFeedback();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('You are offline — connect to internet to cache songs');
      return;
    }
    if (!songs || songs.length === 0) return;

    // Deduplicate and skip already cached songs
    const seen = new Set<string>();
    const uncached: Song[] = [];
    for (const s of songs) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      const already = offlineCacheService.isCachedSync(s.id) || (await offlineCacheService.isSongCached(s.id));
      if (!already) uncached.push(s);
    }

    if (uncached.length === 0) {
      showToast(`All tracks in ${label} are already cached offline!`);
      return;
    }

    batchCancelRef.current = false;
    let completed = 0;
    let failed = 0;
    const total = uncached.length;
    setBatchCacheState({ active: true, targetId, total, completed: 0, failed: 0 });
    showToast(`Caching ${total} track${total > 1 ? 's' : ''} from ${label}...`);

    // Process 2 downloads concurrently to stay fast without overwhelming mobile WebKit/IDB
    let cursor = 0;
    const worker = async () => {
      while (cursor < uncached.length && !batchCancelRef.current) {
        const idx = cursor++;
        const item = uncached[idx];
        const ok = await offlineCacheService.cacheSong(item).catch(() => false);
        if (ok) completed++;
        else failed++;
        setBatchCacheState({ active: true, targetId, total, completed, failed });
      }
    };

    await Promise.all([worker(), worker()]);

    const wasCancelled = batchCancelRef.current;
    batchCancelRef.current = false;
    setBatchCacheState(null);

    if (wasCancelled) {
      showToast(`Stopped caching (${completed} of ${total} saved offline)`);
    } else if (failed === 0) {
      showToast(`Cached ${completed} song${completed !== 1 ? 's' : ''} offline!`);
    } else if (completed > 0) {
      showToast(`Cached ${completed}/${total} songs (${failed} stream${failed !== 1 ? 's' : ''} unavailable)`);
    } else {
      showToast(`No downloadable audio streams found for ${label} — try Sync on individual tracks`);
    }
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

  // Stop any active candidate test preview inside SyncSongModal
  const stopPreviewCandidate = () => {
    if (previewAudioRef.current) {
      try {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = '';
      } catch {}
      previewAudioRef.current = null;
    }
    if (isPreviewingRef.current && ytControllerRef.current) {
      try {
        ytControllerRef.current.pause();
      } catch {}
    }
    isPreviewingRef.current = false;
    setPreviewingSongId(null);
  };

  // Preview a candidate song inside Manual Sync without modifying the user's queue or song
  const previewSongCandidate = async (candidate: Song) => {
    hapticFeedback();

    // Toggle off if already previewing this candidate
    if (previewingSongId === candidate.id && isPreviewingRef.current) {
      stopPreviewCandidate();
      return;
    }

    stopPreviewCandidate();

    // Pause active main playback while testing candidate
    userPausedRef.current = true;
    if (htmlAudioRef.current && !htmlAudioRef.current.paused) {
      htmlAudioRef.current.pause();
    }
    if (ytControllerRef.current) {
      ytControllerRef.current.pause();
    }
    setIsPlaying(false);

    isPreviewingRef.current = true;
    setPreviewingSongId(candidate.id);

    // 1. Direct audio stream preview (320kbps MP4 or pre-resolved streamUrl)
    if (candidate.streamUrl) {
      try {
        const audio = new Audio(candidate.streamUrl);
        audio.volume = Math.max(0.2, Math.min(1, volume / 100));
        audio.onended = () => {
          isPreviewingRef.current = false;
          setPreviewingSongId(null);
        };
        audio.onerror = () => {
          isPreviewingRef.current = false;
          setPreviewingSongId(null);
        };
        previewAudioRef.current = audio;
        await audio.play();
        return;
      } catch {
        // fallback to YouTube if available
      }
    }

    // 2. YouTube video preview via unlocked YouTubeController
    const ytId = candidate.youtubeId || (candidate.id.startsWith('yt-') ? candidate.id.replace('yt-', '') : '');
    if (ytId && ytControllerRef.current) {
      ytControllerRef.current.loadVideoById(ytId, 0);
      ytControllerRef.current.play();
    } else {
      showToast('Preview stream unavailable for this candidate');
      stopPreviewCandidate();
    }
  };

  // Rewrite an existing song across all playlists, liked songs, history, queues, and storage
  const applySongSync = async (
    originalSong: Song,
    matchedSong: Song,
    playImmediately = true
  ): Promise<Song> => {
    hapticFeedback();
    stopPreviewCandidate();

    const rewritten: Song = {
      ...originalSong,
      title: matchedSong.title || originalSong.title,
      artist: matchedSong.artist || originalSong.artist,
      album: matchedSong.album ?? originalSong.album,
      duration: matchedSong.duration || originalSong.duration,
      thumbnailUrl: matchedSong.thumbnailUrl || originalSong.thumbnailUrl,
      source: matchedSong.source,
      youtubeId: matchedSong.youtubeId,
      // Explicitly reset stale streamUrl unless matched candidate carries an explicit streamUrl
      streamUrl: matchedSong.source === 'stream' ? matchedSong.streamUrl : undefined,
      syncedAt: Date.now(),
    };

    // 1. Save persistent override so future lookups or re-imports use the fixed version
    StorageService.saveSongSyncOverride(originalSong.id, rewritten);

    // 2. Clear any stale cached audio blob from IndexedDB if cached under old mismatched version
    if (cachedSongIds.has(originalSong.id)) {
      await offlineCacheService.removeCachedSong(originalSong.id).catch(() => {});
    }

    const replaceInList = (list: Song[]) =>
      list.map((s) => (s.id === originalSong.id ? { ...s, ...rewritten, id: s.id } : s));

    // 3. Rewrite inside Playlists & active SelectedPlaylist
    setPlaylists((prev) => {
      const updated = prev.map((pl) => ({
        ...pl,
        songs: replaceInList(pl.songs),
      }));
      StorageService.savePlaylists(updated);
      return updated;
    });
    setSelectedPlaylistState((prev) =>
      prev ? { ...prev, songs: replaceInList(prev.songs) } : null
    );

    // 4. Rewrite inside Liked Songs
    setLikedSongs((prev) => {
      const updated = replaceInList(prev);
      StorageService.saveLikedSongs(updated);
      return updated;
    });

    // 5. Rewrite inside History
    setHistory((prev) => {
      const updated = replaceInList(prev);
      StorageService.saveHistory(updated);
      return updated;
    });

    // 6. Rewrite inside Active Queue & Multi-Queue workspaces
    const updatedActiveQueue = replaceInList(queueRef.current);
    setQueue(updatedActiveQueue);
    queueRef.current = updatedActiveQueue;

    setQueuesState((prev) => {
      const updated = prev.map((q) => ({
        ...q,
        songs: replaceInList(q.songs),
      }));
      StorageService.saveNamedQueues(updated);
      return updated;
    });

    // 7. Rewrite inside Imported / Saved Artists & Albums
    setImportedArtists((prev) => {
      const updated = prev.map((a) => ({ ...a, topSongs: replaceInList(a.topSongs) }));
      StorageService.saveCustomArtists(updated);
      return updated;
    });
    setSavedArtists((prev) => {
      const updated = prev.map((a) => ({ ...a, topSongs: replaceInList(a.topSongs) }));
      StorageService.saveSavedArtists(updated);
      return updated;
    });
    setSelectedArtist((prev) =>
      prev ? { ...prev, topSongs: replaceInList(prev.topSongs) } : null
    );

    setImportedAlbums((prev) => {
      const updated = prev.map((alb) => ({ ...alb, songs: replaceInList(alb.songs) }));
      StorageService.saveCustomAlbums(updated);
      return updated;
    });
    setSavedAlbums((prev) => {
      const updated = prev.map((alb) => ({ ...alb, songs: replaceInList(alb.songs) }));
      StorageService.saveSavedAlbums(updated);
      return updated;
    });
    setSelectedAlbumState((prev) =>
      prev ? { ...prev, songs: replaceInList(prev.songs) } : null
    );

    // 8. Rewrite currentSong if matching
    if (currentSongRef.current?.id === originalSong.id) {
      setCurrentSong(rewritten);
      currentSongRef.current = rewritten;
    }

    // 9. Play immediately with fresh rewritten track details
    if (playImmediately) {
      const idxInQueue = updatedActiveQueue.findIndex((s) => s.id === rewritten.id);
      if (idxInQueue !== -1) {
        playIndex(idxInQueue, 0, updatedActiveQueue, rewritten);
      } else {
        const nextQ = [rewritten, ...updatedActiveQueue];
        setQueue(nextQ);
        queueRef.current = nextQ;
        playIndex(0, 0, nextQ, rewritten);
      }
    }

    showToast(`Synced: "${rewritten.title}" by ${rewritten.artist}`);
    return rewritten;
  };

  // Automatically find best match for a song and rewrite + play immediately
  const autoSyncSong = async (song: Song): Promise<Song | null> => {
    hapticFeedback();
    const vidId = song.youtubeId || (song.id.startsWith('yt-') ? song.id.replace('yt-', '') : '');
    const { resolvedMeta, candidates } = await OnlineMusicService.fetchSyncCandidates({
      title: song.title,
      artist: song.artist,
      vidId,
      limit: 15,
    });

    const bestMatch = OnlineMusicService.pickBestSyncMatch(song, candidates, resolvedMeta);
    if (!bestMatch) {
      showToast('No matching tracks found — try Manual Sync');
      return null;
    }

    return await applySongSync(song, bestMatch, true);
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
        cachingSongIds,
        cachedTracks,
        isSongCached,
        isSongCaching,
        getSongCoverUrl,
        cacheSong,
        removeCachedSong,
        clearOfflineCache,
        batchCacheState,
        cacheSongsBatch,
        cancelBatchCache,
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
        addToPlaylistTargetSong,
        setAddToPlaylistTargetSong,
        songOptionsMenuTarget,
        setSongOptionsMenuTarget,
        syncTargetSong,
        setSyncTargetSong,
        previewingSongId,
        previewSongCandidate,
        stopPreviewCandidate,
        applySongSync,
        autoSyncSong,
        toastMessage,
        showToast,
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
