import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
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
  QueueSchedule,
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
import {
  RiplaySqliteImporter,
  RiplayImportSummary,
  RiplayExportResult,
} from '../services/riplaySqliteImporter';
import { riplaySyncStore } from '../services/riplaySyncStore';
import { OnlineMusicService } from '../services/onlineMusicService';
import { getSubAudibleAudioUri, audioFocusManager } from '../utils/audioWakeLock';
import { extractDynamicPalette } from '../utils/colorExtractor';
import { webAudioEqualizer } from '../utils/webAudioEqualizer';

interface PlaybackTimeContextType {
  currentTime: number;
  duration: number;
}

const PlaybackTimeContext = createContext<PlaybackTimeContextType>({ currentTime: 0, duration: 0 });

export const usePlaybackTime = () => useContext(PlaybackTimeContext);

const parseScheduleMinutes = (hhmm: string): number | null => {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

export const isQueueScheduleActive = (schedule: QueueSchedule, now: Date = new Date()): boolean => {
  if (schedule.enabled === false) return false;
  const startMins = parseScheduleMinutes(schedule.startTime);
  const endMins = parseScheduleMinutes(schedule.endTime);
  if (startMins === null || endMins === null || startMins === endMins) return false;

  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const days = schedule.days;
  const matchesDay = (day: number) => !days || days.length === 0 || days.includes(day);

  if (startMins < endMins) {
    return matchesDay(today) && nowMins >= startMins && nowMins < endMins;
  }
  // Overnight window (e.g., 22:00 -> 06:00)
  return (matchesDay(today) && nowMins >= startMins) || (matchesDay(yesterday) && nowMins < endMins);
};

export const findMatchingScheduledQueue = (queues: NamedQueue[], now: Date = new Date()): NamedQueue | null => {
  for (const q of queues) {
    if (q.schedules && q.schedules.some((s) => isQueueScheduleActive(s, now))) {
      return q;
    }
  }
  return null;
};

interface MusicContextType {
  // Current playback state
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Song[];
  queueIndex: number;
  playerMode: 'audio' | 'lyrics';
  setPlayerMode: (mode: 'audio' | 'lyrics') => void;

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
  riplayModalMode: 'import' | 'export';
  setRiplayModalMode: (mode: 'import' | 'export') => void;
  openRiplayModal: (mode?: 'import' | 'export') => void;
  isExitConfirmOpen: boolean;
  setIsExitConfirmOpen: (open: boolean) => void;
  confirmExitApp: () => void;

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
  updateQueueSchedules: (queueId: string, schedules: QueueSchedule[]) => void;
  toggleDefaultQueue: (queueId: string) => void;
  addPlaylistToQueue: (playlistOrSongs: Playlist | Song[], mode?: 'replace' | 'append' | 'next') => void;

  // Call & Audio Interruption Auto-Resume (Default ON)
  autoResumeOnCall: boolean;
  setAutoResumeOnCall: (enabled: boolean) => void;

  // Skip non-background-playable (YouTube IFrame fallback) tracks (Default OFF)
  skipNonBgSongs: boolean;
  setSkipNonBgSongs: (enabled: boolean) => void;

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

  // RiPlay SQLite Database 2-Way Sync (.db / .backup)
  importRiplaySqliteBackup: (file: File, onLog?: (msg: string) => void) => Promise<RiplayImportSummary>;
  exportRiplaySqliteBackup: (onLog?: (msg: string) => void) => Promise<RiplayExportResult>;
  importedArtists: Artist[];
  importedAlbums: Album[];
  lastImportSummary: RiplayImportSummary | null;

  // Saved / Followed Library items
  savedArtists: Artist[];
  toggleFollowArtist: (artist: Artist) => void;
  isArtistFollowed: (artistId: string) => boolean;
  updateArtistTracks: (artistId: string, topSongs: Song[], meta?: Partial<Artist>) => void;
  savedAlbums: Album[];
  toggleSaveAlbum: (album: Album) => void;
  isAlbumSaved: (albumId: string) => boolean;
  updateAlbumTracks: (albumId: string, songs: Song[], meta?: Partial<Album>) => void;

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
  cacheRestoreProgress: { active: boolean; total: number; completed: number; justFinished?: boolean } | null;
  registerBackHandler: (id: string, onBack: () => void) => () => void;
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

  const historySeqRef = useRef<number>(1);
  const entriesAboveRootRef = useRef<number>(1);
  const localBackHandlersRef = useRef<{ id: string; close: () => void }[]>([]);

  const pushHistoryLayer = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const seq = ++historySeqRef.current;
      const hasUserActivation =
        typeof (navigator as any).userActivation !== 'undefined'
          ? !!(navigator as any).userActivation?.isActive
          : true;

      window.history.pushState(
        { muzikaLayer: true, seq, ua: hasUserActivation },
        ''
      );
      entriesAboveRootRef.current += 1;
      if (hasUserActivation) {
        trapActivatedRef.current = true;
      }
    } catch {}
  }, []);

  const registerBackHandler = useCallback((id: string, closeFn: () => void) => {
    localBackHandlersRef.current = [
      ...localBackHandlersRef.current.filter((h) => h.id !== id),
      { id, close: closeFn },
    ];
    pushHistoryLayer();
    return () => {
      localBackHandlersRef.current = localBackHandlersRef.current.filter((h) => h.id !== id);
    };
  }, [pushHistoryLayer]);

  const setActiveTab = useCallback((tab: 'home' | 'explore' | 'search' | 'library' | 'rewind' | 'settings') => {
    const prevTab = navStateRef.current.activeTab;
    setActiveTabState(tab);
    navStateRef.current.activeTab = tab;
    if (typeof window !== 'undefined') {
      localStorage.setItem('muzika_active_tab', tab);
    }
    if (tab !== 'home' && tab !== prevTab) {
      pushHistoryLayer();
    }
  }, [pushHistoryLayer]);

  const [isPlayerOpen, setIsPlayerOpenState] = useState(false);
  const [isQueueOpen, setIsQueueOpenState] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpenState] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpenState] = useState(false);
  const [isSongInfoOpen, setIsSongInfoOpenState] = useState(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpenState] = useState(false);
  const [isRiplayImportOpen, setIsRiplayImportOpenState] = useState(false);
  const [riplayModalMode, setRiplayModalMode] = useState<'import' | 'export'>('import');
  const isRiplayImportingRef = useRef<boolean>(false);
  const isRiplayExportingRef = useRef<boolean>(false);
  const [isExitConfirmOpen, setIsExitConfirmOpenState] = useState(false);
  const [playerMode, setPlayerMode] = useState<'audio' | 'lyrics'>('audio');

  const [selectedPlaylist, setSelectedPlaylistState] = useState<Playlist | null>(null);
  const [selectedArtistId, setSelectedArtistIdState] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbumState] = useState<Album | null>(null);

  // Quick Action Modals & Toast State
  const [addToPlaylistTargetSong, setAddToPlaylistTargetSongState] = useState<Song | null>(null);
  const [songOptionsMenuTarget, setSongOptionsMenuTargetState] = useState<{ song: Song; queueContext?: Song[] } | null>(null);
  const [syncTargetSong, setSyncTargetSongState] = useState<Song | null>(null);
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cacheRestoreProgress, setCacheRestoreProgress] = useState<{
    active: boolean;
    total: number;
    completed: number;
    justFinished?: boolean;
  } | null>(null);
  const restoreClearTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const trapActivatedRef = useRef<boolean>(false);
  const isExitingAppRef = useRef<boolean>(false);

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const setIsPlayerOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isPlayerOpen) pushHistoryLayer();
    navStateRef.current.isPlayerOpen = open;
    setIsPlayerOpenState(open);
  }, [pushHistoryLayer]);
  const setIsQueueOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isQueueOpen) pushHistoryLayer();
    navStateRef.current.isQueueOpen = open;
    setIsQueueOpenState(open);
  }, [pushHistoryLayer]);
  const setIsEqualizerOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isEqualizerOpen) pushHistoryLayer();
    navStateRef.current.isEqualizerOpen = open;
    setIsEqualizerOpenState(open);
  }, [pushHistoryLayer]);
  const setIsSleepTimerOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isSleepTimerOpen) pushHistoryLayer();
    navStateRef.current.isSleepTimerOpen = open;
    setIsSleepTimerOpenState(open);
  }, [pushHistoryLayer]);
  const setIsSongInfoOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isSongInfoOpen) pushHistoryLayer();
    navStateRef.current.isSongInfoOpen = open;
    setIsSongInfoOpenState(open);
  }, [pushHistoryLayer]);
  const setIsPWAInstallModalOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isPWAInstallModalOpen) pushHistoryLayer();
    navStateRef.current.isPWAInstallModalOpen = open;
    setIsPWAInstallModalOpenState(open);
  }, [pushHistoryLayer]);
  const setIsRiplayImportOpen = useCallback((open: boolean) => {
    if (open && !navStateRef.current.isRiplayImportOpen) pushHistoryLayer();
    navStateRef.current.isRiplayImportOpen = open;
    setIsRiplayImportOpenState(open);
  }, [pushHistoryLayer]);
  const openRiplayModal = useCallback((mode: 'import' | 'export' = 'import') => {
    setRiplayModalMode(mode);
    setIsRiplayImportOpen(true);
  }, [setIsRiplayImportOpen]);
  const setSelectedPlaylist = useCallback((playlist: Playlist | null) => {
    if (playlist && !navStateRef.current.selectedPlaylist) pushHistoryLayer();
    navStateRef.current.selectedPlaylist = playlist;
    setSelectedPlaylistState(playlist);
  }, [pushHistoryLayer]);
  const setSelectedArtistId = useCallback((artistId: string | null) => {
    if (artistId && !navStateRef.current.selectedArtistId) pushHistoryLayer();
    navStateRef.current.selectedArtistId = artistId;
    setSelectedArtistIdState(artistId);
    if (!artistId) setSelectedArtist(null);
  }, [pushHistoryLayer]);
  const setSelectedAlbum = useCallback((album: Album | null) => {
    if (album && !navStateRef.current.selectedAlbum) pushHistoryLayer();
    navStateRef.current.selectedAlbum = album;
    setSelectedAlbumState(album);
  }, [pushHistoryLayer]);
  const setAddToPlaylistTargetSong = useCallback((song: Song | null) => {
    if (song && !navStateRef.current.addToPlaylistTargetSong) pushHistoryLayer();
    navStateRef.current.addToPlaylistTargetSong = song;
    setAddToPlaylistTargetSongState(song);
  }, [pushHistoryLayer]);
  const setSongOptionsMenuTarget = useCallback((target: { song: Song; queueContext?: Song[] } | null) => {
    if (target && !navStateRef.current.songOptionsMenuTarget) pushHistoryLayer();
    navStateRef.current.songOptionsMenuTarget = target;
    setSongOptionsMenuTargetState(target);
  }, [pushHistoryLayer]);
  const setSyncTargetSong = useCallback((song: Song | null) => {
    if (song && !navStateRef.current.syncTargetSong) pushHistoryLayer();
    navStateRef.current.syncTargetSong = song;
    setSyncTargetSongState(song);
  }, [pushHistoryLayer]);

  const setIsExitConfirmOpen = useCallback((open: boolean) => {
    setIsExitConfirmOpenState(open);
    navStateRef.current.isExitConfirmOpen = open;
    if (!open && !isExitingAppRef.current) {
      if (typeof window !== 'undefined') {
        try {
          if (window.history.state?.muzikaRoot === true || entriesAboveRootRef.current < 1) {
            const seq = ++historySeqRef.current;
            window.history.pushState({ muzikaGuard: true, seq, ua: true }, '');
            entriesAboveRootRef.current = 1;
            trapActivatedRef.current = true;
          }
        } catch {}
      }
    }
  }, []);

  const confirmExitApp = useCallback(() => {
    isExitingAppRef.current = true;
    setIsExitConfirmOpenState(false);
    if (typeof window !== 'undefined') {
      try {
        window.close();
      } catch {}
      try {
        const steps = Math.max(1, entriesAboveRootRef.current + 1);
        window.history.go(-steps);
        window.setTimeout(() => {
          try {
            window.history.back();
          } catch {}
        }, 50);
      } catch {}
    }
  }, []);

  // Playback state restored from last session (Rewind support) & startup-only Queue Schedule check
  const initialPlaybackState = useMemo(() => StorageService.getLastPlaybackState(), []);

  const startupQueueResolution = useMemo(() => {
    const savedMultiEnabled = StorageService.getEnableMultipleQueues();
    const savedActiveId = StorageService.getActiveQueueId();
    const savedNamedQueues = StorageService.getNamedQueues();

    const defaultQueue: Song[] = initialPlaybackState?.queue?.length ? initialPlaybackState.queue : [];
    const defaultQueueIdx: number = initialPlaybackState?.queueIndex ?? 0;
    const defaultSong: Song | null = initialPlaybackState?.song ?? null;
    const defaultCurrentTime: number = initialPlaybackState?.currentTime ?? 0;
    const defaultDuration: number = initialPlaybackState?.duration ?? 0;

    const baseQueues: NamedQueue[] =
      savedNamedQueues && savedNamedQueues.length > 0
        ? savedNamedQueues
        : [{ id: 'queue-main', name: 'Main Queue', songs: [...defaultQueue], queueIndex: defaultQueueIdx, createdAt: Date.now() }];

    if (!savedMultiEnabled || baseQueues.length === 0) {
      return {
        enableMultipleQueues: savedMultiEnabled,
        activeQueueId: savedActiveId,
        queues: baseQueues,
        queue: defaultQueue,
        queueIndex: defaultQueueIdx,
        currentSong: defaultSong,
        currentTime: defaultCurrentTime,
        duration: defaultDuration,
        switchedToName: null as string | null,
        switchedReason: null as 'schedule' | 'default' | null,
        pickedDefaultId: null as string | null,
      };
    }

    // Keep previous active queue snapshot synced before evaluating startup schedules/defaults
    const syncedQueues = baseQueues.map((q) =>
      q.id === savedActiveId && defaultQueue.length > 0
        ? { ...q, songs: [...defaultQueue], queueIndex: defaultQueueIdx, currentTime: defaultCurrentTime }
        : q
    );

    // Priority 1: Active timing schedule
    let targetQueue = findMatchingScheduledQueue(syncedQueues, new Date());
    let reason: 'schedule' | 'default' | null = targetQueue ? 'schedule' : null;
    let pickedDefaultId: string | null = null;

    // Priority 2: If no schedule matches, fall back to Default queue(s) if any are selected
    if (!targetQueue) {
      const defaultQueues = syncedQueues.filter((q) => q.isDefault === true);
      if (defaultQueues.length === 1) {
        targetQueue = defaultQueues[0];
        reason = 'default';
        pickedDefaultId = targetQueue.id;
      } else if (defaultQueues.length > 1) {
        const lastDefaultId = StorageService.getLastDefaultQueueId();
        const lastIdx = defaultQueues.findIndex((q) => q.id === lastDefaultId);
        const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % defaultQueues.length;
        targetQueue = defaultQueues[nextIdx];
        reason = 'default';
        pickedDefaultId = targetQueue.id;
      }
    }

    if (targetQueue && targetQueue.id !== savedActiveId) {
      const targetSongs = targetQueue.songs && targetQueue.songs.length > 0 ? [...targetQueue.songs] : [];
      const targetIdx =
        targetSongs.length > 0
          ? Math.min(Math.max(0, targetQueue.queueIndex || 0), targetSongs.length - 1)
          : 0;
      const targetSong = targetSongs[targetIdx] || targetSongs[0] || null;
      const targetTime = targetQueue.currentTime ?? 0;
      const targetDuration = targetSong?.duration || 0;

      return {
        enableMultipleQueues: savedMultiEnabled,
        activeQueueId: targetQueue.id,
        queues: syncedQueues,
        queue: targetSongs,
        queueIndex: targetIdx,
        currentSong: targetSong,
        currentTime: targetTime,
        duration: targetDuration,
        switchedToName: targetQueue.name,
        switchedReason: reason,
        pickedDefaultId,
      };
    }

    return {
      enableMultipleQueues: savedMultiEnabled,
      activeQueueId: savedActiveId,
      queues: syncedQueues,
      queue: defaultQueue,
      queueIndex: defaultQueueIdx,
      currentSong: defaultSong,
      currentTime: defaultCurrentTime,
      duration: defaultDuration,
      switchedToName: null as string | null,
      switchedReason: null as 'schedule' | 'default' | null,
      pickedDefaultId,
    };
  }, [initialPlaybackState]);

  const [queue, setQueue] = useState<Song[]>(() => startupQueueResolution.queue);
  const [queueIndex, setQueueIndex] = useState<number>(() => startupQueueResolution.queueIndex);
  const [currentSong, setCurrentSong] = useState<Song | null>(() => startupQueueResolution.currentSong);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => startupQueueResolution.currentTime);
  const [duration, setDuration] = useState<number>(() => startupQueueResolution.duration);
  const currentTimeRef = useRef<number>(currentTime);
  const durationRef = useRef<number>(duration);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;
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

  // Synchronized refs for O(N) non-blocking RiPlay import/export merges
  const likedSongsRef = useRef<Song[]>(likedSongs);
  likedSongsRef.current = likedSongs;
  const playlistsRef = useRef<Playlist[]>(playlists);
  playlistsRef.current = playlists;
  const historyRef = useRef<Song[]>(history);
  historyRef.current = history;
  const blacklistRef = useRef(blacklist);
  blacklistRef.current = blacklist;
  const userStatsRef = useRef<UserStats>(userStats);
  userStatsRef.current = userStats;
  const importedArtistsRef = useRef<Artist[]>(importedArtists);
  importedArtistsRef.current = importedArtists;
  const importedAlbumsRef = useRef<Album[]>(importedAlbums);
  importedAlbumsRef.current = importedAlbums;
  const savedArtistsRef = useRef<Artist[]>(savedArtists);
  savedArtistsRef.current = savedArtists;
  const savedAlbumsRef = useRef<Album[]>(savedAlbums);
  savedAlbumsRef.current = savedAlbums;

  // Hydrate persisted album & artist tracklists from IndexedDB on startup so saved/imported entities always open & play offline
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [albumMap, artistMap] = await Promise.all([
          riplaySyncStore.getAllAlbumTracks(),
          riplaySyncStore.getAllArtistTracks(),
        ]);
        if (!mounted) return;

        if (Object.keys(albumMap).length > 0) {
          setSavedAlbums((prev) => {
            let changed = false;
            const next = prev.map((a) => {
              if ((!a.songs || a.songs.length === 0) && albumMap[a.id]?.length) {
                changed = true;
                return { ...a, songs: albumMap[a.id] };
              }
              return a;
            });
            return changed ? next : prev;
          });
          setImportedAlbums((prev) => {
            let changed = false;
            const next = prev.map((a) => {
              if ((!a.songs || a.songs.length === 0) && albumMap[a.id]?.length) {
                changed = true;
                return { ...a, songs: albumMap[a.id] };
              }
              return a;
            });
            return changed ? next : prev;
          });
        }

        if (Object.keys(artistMap).length > 0) {
          setSavedArtists((prev) => {
            let changed = false;
            const next = prev.map((a) => {
              const cached = artistMap[a.id];
              if (cached?.topSongs?.length && (!a.topSongs || a.topSongs.length === 0)) {
                changed = true;
                return {
                  ...a,
                  topSongs: cached.topSongs,
                  bannerUrl: a.bannerUrl || cached.bannerUrl,
                  subscribers: a.subscribers || cached.subscribers,
                  bio: a.bio || cached.bio,
                };
              }
              return a;
            });
            return changed ? next : prev;
          });
          setImportedArtists((prev) => {
            let changed = false;
            const next = prev.map((a) => {
              const cached = artistMap[a.id];
              if (cached?.topSongs?.length && (!a.topSongs || a.topSongs.length === 0)) {
                changed = true;
                return {
                  ...a,
                  topSongs: cached.topSongs,
                  bannerUrl: a.bannerUrl || cached.bannerUrl,
                  subscribers: a.subscribers || cached.subscribers,
                  bio: a.bio || cached.bio,
                };
              }
              return a;
            });
            return changed ? next : prev;
          });
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Call / External Audio Interruption Auto-Pause & Auto-Resume (Default ON)
  const [autoResumeOnCall, setAutoResumeOnCallState] = useState<boolean>(() => StorageService.getAutoResumeOnCall());
  const autoResumeOnCallRef = useRef<boolean>(autoResumeOnCall);
  autoResumeOnCallRef.current = autoResumeOnCall;

  // Skip Non-Background-Playable (IFrame-only) Songs (Default OFF)
  const [skipNonBgSongs, setSkipNonBgSongsState] = useState<boolean>(() => StorageService.getSkipNonBgSongs());
  const skipNonBgSongsRef = useRef<boolean>(skipNonBgSongs);
  skipNonBgSongsRef.current = skipNonBgSongs;

  // Multiple Queues feature (Toggleable in Settings)
  const [enableMultipleQueues, setEnableMultipleQueuesState] = useState<boolean>(() => startupQueueResolution.enableMultipleQueues);
  const enableMultipleQueuesRef = useRef<boolean>(enableMultipleQueues);
  enableMultipleQueuesRef.current = enableMultipleQueues;
  const [activeQueueId, setActiveQueueIdState] = useState<string>(() => startupQueueResolution.activeQueueId);
  const activeQueueIdRef = useRef<string>(activeQueueId);
  const [queues, setQueuesState] = useState<NamedQueue[]>(() => startupQueueResolution.queues);
  const queuesRef = useRef<NamedQueue[]>(queues);

  const startupScheduleToastShownRef = useRef<boolean>(false);
  useEffect(() => {
    if (startupScheduleToastShownRef.current) return;
    startupScheduleToastShownRef.current = true;
    if (startupQueueResolution.pickedDefaultId) {
      StorageService.saveLastDefaultQueueId(startupQueueResolution.pickedDefaultId);
    }
    if (startupQueueResolution.switchedToName && startupQueueResolution.switchedReason) {
      StorageService.saveNamedQueues(startupQueueResolution.queues);
      StorageService.saveActiveQueueId(startupQueueResolution.activeQueueId);
      if (startupQueueResolution.currentSong) {
        StorageService.saveLastPlaybackState({
          song: startupQueueResolution.currentSong,
          currentTime: startupQueueResolution.currentTime,
          duration: startupQueueResolution.duration,
          queueIndex: startupQueueResolution.queueIndex,
          queue: startupQueueResolution.queue,
        });
      } else {
        StorageService.clearLastPlaybackState();
      }
      const label = startupQueueResolution.switchedReason === 'schedule' ? 'scheduled' : 'default';
      showToast(`Switched to ${label} queue "${startupQueueResolution.switchedToName}"`);
    }
  }, [startupQueueResolution]);

  const setEnableMultipleQueues = (enabled: boolean) => {
    hapticFeedback();
    setEnableMultipleQueuesState(enabled);
    enableMultipleQueuesRef.current = enabled;
    StorageService.saveEnableMultipleQueues(enabled);
  };

  const activeQueueName = useMemo(() => {
    const q = queues.find((item) => item.id === activeQueueId);
    return q ? q.name : 'Main Queue';
  }, [queues, activeQueueId]);

  // Keep current active queue in queues state synchronized (defer localStorage serialization to keep swipes 60fps)
  const namedQueuesSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enableMultipleQueues) return;
    const curActiveId = activeQueueId;
    const currentList = queuesRef.current;
    const idx = currentList.findIndex((q) => q.id === curActiveId);

    if (idx !== -1) {
      const existing = currentList[idx];
      // Skip redundant sync when switchQueue/createQueue already committed this exact queue state
      if (existing.songs === queue && existing.queueIndex === queueIndex) {
        return;
      }
      const updated = [...currentList];
      updated[idx] = { ...existing, songs: [...queue], queueIndex };
      queuesRef.current = updated;
      setQueuesState(updated);
      if (namedQueuesSaveTimerRef.current) {
        window.clearTimeout(namedQueuesSaveTimerRef.current);
      }
      namedQueuesSaveTimerRef.current = window.setTimeout(() => {
        namedQueuesSaveTimerRef.current = null;
        StorageService.saveNamedQueues(updated);
      }, 180);
    } else {
      const newQueueItem: NamedQueue = {
        id: curActiveId,
        name: curActiveId === 'queue-main' ? 'Main Queue' : 'Custom Queue',
        songs: [...queue],
        queueIndex,
        createdAt: Date.now(),
      };
      const updated = [...currentList, newQueueItem];
      queuesRef.current = updated;
      setQueuesState(updated);
      if (namedQueuesSaveTimerRef.current) {
        window.clearTimeout(namedQueuesSaveTimerRef.current);
      }
      namedQueuesSaveTimerRef.current = window.setTimeout(() => {
        namedQueuesSaveTimerRef.current = null;
        StorageService.saveNamedQueues(updated);
      }, 180);
    }
  }, [queue, queueIndex, activeQueueId, enableMultipleQueues]);

  const switchQueue = (queueId: string) => {
    hapticFeedback();
    clearInterruptionStateRef.current();
    const prevQueueId = activeQueueIdRef.current;
    if (queueId === prevQueueId) return;

    const currentList = queuesRef.current;
    const target = currentList.find((q) => q.id === queueId);
    if (!target) return;

    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }

    // Snapshot previous active queue BEFORE mutating queueRef/activeQueueIdRef
    const prevSongsSnapshot = [...queueRef.current];
    const prevIdxSnapshot = Math.max(0, queueIndexRef.current || 0);

    const savedQueues = currentList.map((q) =>
      q.id === prevQueueId
        ? { ...q, songs: prevSongsSnapshot, queueIndex: prevIdxSnapshot }
        : q
    );
    queuesRef.current = savedQueues;
    setQueuesState(savedQueues);
    StorageService.saveNamedQueues(savedQueues);

    // Clone target queue songs so independent queues never share mutable array references
    const targetSongs = target.songs && target.songs.length > 0 ? [...target.songs] : [];
    const targetIdx =
      targetSongs.length > 0
        ? Math.min(Math.max(0, target.queueIndex || 0), targetSongs.length - 1)
        : 0;

    activeQueueIdRef.current = queueId;
    setActiveQueueIdState(queueId);
    StorageService.saveActiveQueueId(queueId);

    queueRef.current = targetSongs;
    queueIndexRef.current = targetIdx;
    setQueue(targetSongs);
    setQueueIndex(targetIdx);

    const targetSong = targetSongs[targetIdx] || targetSongs[0];
    if (targetSong) {
      playIndex(targetIdx, 0, targetSongs, targetSong);
    }
  };

  const createQueue = (name: string, initialSongs?: Song[]) => {
    hapticFeedback();
    clearInterruptionStateRef.current();
    const newId = `queue-${Date.now()}`;
    const songsToUse =
      initialSongs && initialSongs.length > 0
        ? [...initialSongs]
        : currentSongRef.current
        ? [currentSongRef.current]
        : [];
    const newQueueItem: NamedQueue = {
      id: newId,
      name: name.trim() || 'New Queue',
      songs: songsToUse,
      queueIndex: 0,
      createdAt: Date.now(),
    };

    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }

    // Snapshot previous active queue cleanly before switching to newly created queue
    const prevQueueId = activeQueueIdRef.current;
    const prevSongsSnapshot = [...queueRef.current];
    const prevIdxSnapshot = Math.max(0, queueIndexRef.current || 0);

    const nextQueues = [
      ...queuesRef.current.map((q) =>
        q.id === prevQueueId
          ? { ...q, songs: prevSongsSnapshot, queueIndex: prevIdxSnapshot }
          : q
      ),
      newQueueItem,
    ];
    queuesRef.current = nextQueues;
    setQueuesState(nextQueues);
    StorageService.saveNamedQueues(nextQueues);

    activeQueueIdRef.current = newId;
    setActiveQueueIdState(newId);
    StorageService.saveActiveQueueId(newId);

    const nextTargetSongs = [...songsToUse];
    queueRef.current = nextTargetSongs;
    queueIndexRef.current = 0;
    setQueue(nextTargetSongs);
    setQueueIndex(0);

    if (nextTargetSongs[0]) {
      playIndex(0, 0, nextTargetSongs, nextTargetSongs[0]);
    }
  };

  const renameQueue = (queueId: string, newName: string) => {
    hapticFeedback();
    if (!newName.trim()) return;
    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }
    const updated = queuesRef.current.map((q) =>
      q.id === queueId ? { ...q, name: newName.trim() } : q
    );
    queuesRef.current = updated;
    setQueuesState(updated);
    StorageService.saveNamedQueues(updated);
  };

  const deleteQueue = (queueId: string) => {
    hapticFeedback();
    if (queueId === 'queue-main') return;
    const wasActive = activeQueueIdRef.current === queueId;
    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }
    const updated = queuesRef.current.filter((q) => q.id !== queueId);
    queuesRef.current = updated;
    setQueuesState(updated);
    StorageService.saveNamedQueues(updated);
    if (wasActive) {
      switchQueue('queue-main');
    }
  };

  const updateQueueSchedules = (queueId: string, schedules: QueueSchedule[]) => {
    hapticFeedback();
    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }
    const updated = queuesRef.current.map((q) =>
      q.id === queueId ? { ...q, schedules } : q
    );
    queuesRef.current = updated;
    setQueuesState(updated);
    StorageService.saveNamedQueues(updated);
  };

  const toggleDefaultQueue = (queueId: string) => {
    hapticFeedback();
    if (namedQueuesSaveTimerRef.current) {
      window.clearTimeout(namedQueuesSaveTimerRef.current);
      namedQueuesSaveTimerRef.current = null;
    }
    const updated = queuesRef.current.map((q) =>
      q.id === queueId ? { ...q, isDefault: !q.isDefault } : q
    );
    queuesRef.current = updated;
    setQueuesState(updated);
    StorageService.saveNamedQueues(updated);
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
        if (window.history.state?.muzikaRoot === true || entriesAboveRootRef.current < 1) {
          const seq = ++historySeqRef.current;
          const hasUserActivation =
            typeof (navigator as any).userActivation !== 'undefined'
              ? !!(navigator as any).userActivation?.isActive
              : false;
          window.history.pushState(
            { muzikaGuard: true, seq, ua: hasUserActivation },
            ''
          );
          entriesAboveRootRef.current = 1;
          trapActivatedRef.current = hasUserActivation;
        }
      } catch {}
    }
  };

  // Initialize history trap and handle hardware back button navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({ muzikaRoot: true, seq: 0 }, '');
        window.history.pushState({ muzikaGuard: true, seq: 1 }, '');
        entriesAboveRootRef.current = 1;
        trapActivatedRef.current = false;
      } catch {}
    }

    // Only re-push guard on gesture if history actually fell back to root (avoids double-push on same tap)
    const activateTrapOnGesture = () => {
      if (isExitingAppRef.current) return;
      if (typeof window === 'undefined') return;
      if (navStateRef.current.isExitConfirmOpen) return;

      trapActivatedRef.current = true;
      const curState = window.history.state;
      if (curState?.muzikaRoot === true || (!curState?.muzikaGuard && !curState?.muzikaLayer)) {
        try {
          const seq = ++historySeqRef.current;
          window.history.pushState({ muzikaGuard: true, seq, ua: true }, '');
          entriesAboveRootRef.current += 1;
        } catch {}
      }
    };

    const keepInsideAppGuard = () => {
      if (typeof window === 'undefined') return;
      if (window.history.state?.muzikaRoot === true || entriesAboveRootRef.current < 1) {
        try {
          const seq = ++historySeqRef.current;
          window.history.pushState({ muzikaGuard: true, seq }, '');
          entriesAboveRootRef.current = 1;
          trapActivatedRef.current = false;
        } catch {}
      }
    };

    const handlePopState = () => {
      if (isExitingAppRef.current) return;
      entriesAboveRootRef.current = Math.max(0, entriesAboveRootRef.current - 1);
      const state = navStateRef.current;

      // 1. If Exit confirmation modal is open, back button dismisses it
      if (state.isExitConfirmOpen) {
        setIsExitConfirmOpenState(false);
        navStateRef.current.isExitConfirmOpen = false;
        ensureHistoryTrap();
        return;
      }

      // 2. Highest-priority global quick-action modals
      if (state.syncTargetSong) {
        setSyncTargetSongState(null);
        navStateRef.current.syncTargetSong = null;
        keepInsideAppGuard();
        return;
      }
      if (state.songOptionsMenuTarget) {
        setSongOptionsMenuTargetState(null);
        navStateRef.current.songOptionsMenuTarget = null;
        keepInsideAppGuard();
        return;
      }

      // 3. Any open local dialog / sheet registered via useBackHandler (Create Playlist, Queue Selector, Delete Confirm, Queue Options, AddToPlaylist Create Form)
      if (localBackHandlersRef.current.length > 0) {
        const topHandler = localBackHandlersRef.current[localBackHandlersRef.current.length - 1];
        localBackHandlersRef.current = localBackHandlersRef.current.slice(0, -1);
        try {
          topHandler.close();
        } catch {}
        keepInsideAppGuard();
        return;
      }

      // 4. Global modals & sheets in top-most z-index order
      if (state.addToPlaylistTargetSong) {
        setAddToPlaylistTargetSongState(null);
        navStateRef.current.addToPlaylistTargetSong = null;
        keepInsideAppGuard();
        return;
      }
      if (state.isEqualizerOpen) {
        setIsEqualizerOpenState(false);
        navStateRef.current.isEqualizerOpen = false;
        keepInsideAppGuard();
        return;
      }
      if (state.isSongInfoOpen) {
        setIsSongInfoOpenState(false);
        navStateRef.current.isSongInfoOpen = false;
        keepInsideAppGuard();
        return;
      }
      if (state.isSleepTimerOpen) {
        setIsSleepTimerOpenState(false);
        navStateRef.current.isSleepTimerOpen = false;
        keepInsideAppGuard();
        return;
      }
      if (state.isRiplayImportOpen) {
        setIsRiplayImportOpenState(false);
        navStateRef.current.isRiplayImportOpen = false;
        keepInsideAppGuard();
        return;
      }
      if (state.isPWAInstallModalOpen) {
        setIsPWAInstallModalOpenState(false);
        navStateRef.current.isPWAInstallModalOpen = false;
        keepInsideAppGuard();
        return;
      }
      if (state.isQueueOpen) {
        setIsQueueOpenState(false);
        navStateRef.current.isQueueOpen = false;
        keepInsideAppGuard();
        return;
      }

      // 5. Full-screen Player sits above Entity Detail screens (z-50 > z-40)
      if (state.isPlayerOpen) {
        setIsPlayerOpenState(false);
        navStateRef.current.isPlayerOpen = false;
        keepInsideAppGuard();
        return;
      }

      // 6. Entity Detail screens
      if (state.selectedPlaylist) {
        setSelectedPlaylistState(null);
        navStateRef.current.selectedPlaylist = null;
        keepInsideAppGuard();
        return;
      }
      if (state.selectedArtistId || state.selectedArtist) {
        setSelectedArtistIdState(null);
        setSelectedArtist(null);
        navStateRef.current.selectedArtistId = null;
        navStateRef.current.selectedArtist = null;
        keepInsideAppGuard();
        return;
      }
      if (state.selectedAlbum) {
        setSelectedAlbumState(null);
        navStateRef.current.selectedAlbum = null;
        keepInsideAppGuard();
        return;
      }

      // 7. If on another tab, navigate back to Home screen
      if (state.activeTab !== 'home') {
        setActiveTabState('home');
        navStateRef.current.activeTab = 'home';
        if (typeof window !== 'undefined') {
          localStorage.setItem('muzika_active_tab', 'home');
        }
        keepInsideAppGuard();
        return;
      }

      // 8. We are on Home with no modals/dialogs open: Prompt user before quitting!
      trapActivatedRef.current = false;
      setIsExitConfirmOpenState(true);
      navStateRef.current.isExitConfirmOpen = true;
    };

    window.addEventListener('pointerdown', activateTrapOnGesture, { capture: true, passive: true });
    window.addEventListener('keydown', activateTrapOnGesture, { capture: true, passive: true });
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('pointerdown', activateTrapOnGesture, { capture: true } as any);
      window.removeEventListener('keydown', activateTrapOnGesture, { capture: true } as any);
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

    const unsubRestore = offlineCacheService.subscribeRestore((evt) => {
      if (!isMounted) return;
      if (restoreClearTimerRef.current) {
        window.clearTimeout(restoreClearTimerRef.current);
        restoreClearTimerRef.current = null;
      }
      if (evt.phase === 'start' || evt.phase === 'progress') {
        if (evt.total > 0) {
          setCacheRestoreProgress({ active: true, total: evt.total, completed: evt.completed });
        }
      } else if (evt.phase === 'done') {
        if (evt.completed > 0) {
          setCacheRestoreProgress({
            active: false,
            total: evt.total,
            completed: evt.completed,
            justFinished: true,
          });
          restoreClearTimerRef.current = window.setTimeout(() => {
            if (isMounted) setCacheRestoreProgress(null);
          }, 2800);
        } else {
          setCacheRestoreProgress(null);
        }
      }
    });

    return () => {
      isMounted = false;
      if (restoreClearTimerRef.current) window.clearTimeout(restoreClearTimerRef.current);
      unsub();
      unsubCaching();
      unsubRestore();
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
  const isShuffleRef = useRef<boolean>(isShuffle);
  isShuffleRef.current = isShuffle;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const userPausedRef = useRef<boolean>(false);
  const sessionStoppedRef = useRef<boolean>(true);
  const isTransitioningRef = useRef<boolean>(false);
  const playRequestIdRef = useRef<number>(0);
  const lastBlobUrlRef = useRef<string | null>(null);
  const preloadTimerRef = useRef<number | null>(null);
  const interruptedBySystemRef = useRef<boolean>(false);
  const attemptingResumeRef = useRef<boolean>(false);
  const pauseVerifyTimerRef = useRef<number | null>(null);
  const resumeVerifyTimerRef = useRef<number | null>(null);
  const interruptionRecoveryTimerRef = useRef<number | null>(null);
  const clearInterruptionStateRef = useRef<() => void>(() => {});
  const startInterruptionRecoveryRef = useRef<() => void>(() => {});
  const attemptInterruptionResumeRef = useRef<() => void>(() => {});
  const pausePlaybackRef = useRef<() => void>(() => {});
  const resumePlaybackRef = useRef<() => void>(() => {});
  const stopPlaybackSessionRef = useRef<() => void>(() => {});
  const prevTrackRef = useRef<() => void>(() => {});
  const nextTrackRef = useRef<() => void>(() => {});
  const seekToRef = useRef<(seconds: number) => void>(() => {});
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const playIndexRef = useRef<
    (
      index: number,
      startAtSecond?: number,
      overrideQueue?: Song[],
      overrideSong?: Song,
      skipCtx?: { direction: 1 | -1; visited: number[]; skippedCount: number }
    ) => Promise<void>
  >(async () => {});

  const assertPausedMediaSessionState = () => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = sessionStoppedRef.current ? 'none' : 'paused';
    }
  };

  const clearInterruptionState = () => {
    interruptedBySystemRef.current = false;
    attemptingResumeRef.current = false;
    if (pauseVerifyTimerRef.current) {
      window.clearTimeout(pauseVerifyTimerRef.current);
      pauseVerifyTimerRef.current = null;
    }
    if (resumeVerifyTimerRef.current) {
      window.clearTimeout(resumeVerifyTimerRef.current);
      resumeVerifyTimerRef.current = null;
    }
    if (interruptionRecoveryTimerRef.current) {
      window.clearInterval(interruptionRecoveryTimerRef.current);
      interruptionRecoveryTimerRef.current = null;
    }
  };
  clearInterruptionStateRef.current = clearInterruptionState;

  const attemptInterruptionResume = async () => {
    if (
      !interruptedBySystemRef.current ||
      !autoResumeOnCallRef.current ||
      userPausedRef.current ||
      isTransitioningRef.current ||
      attemptingResumeRef.current
    ) {
      return;
    }
    attemptingResumeRef.current = true;
    try {
      if (activeEngineRef.current === 'html' && htmlAudioRef.current) {
        const audio = htmlAudioRef.current;
        if (!(audio.currentSrc || audio.src) || audio.ended) {
          clearInterruptionState();
          return;
        }
        audioFocusManager.start();
        webAudioEqualizer.ensureActive(audio, equalizerSettingsRef.current);
        silentKeepAliveRef.current?.play().catch(() => {});
        try {
          await audio.play();
        } catch {
          silentKeepAliveRef.current?.pause();
          return;
        }
        // Confirm playback stayed active after ~320ms (OS isn't re-pausing during active call)
        if (resumeVerifyTimerRef.current) window.clearTimeout(resumeVerifyTimerRef.current);
        resumeVerifyTimerRef.current = window.setTimeout(() => {
          resumeVerifyTimerRef.current = null;
          if (!interruptedBySystemRef.current || userPausedRef.current) return;
          const a = htmlAudioRef.current;
          if (a && !a.paused && !a.ended) {
            clearInterruptionState();
            setIsPlaying(true);
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          } else {
            silentKeepAliveRef.current?.pause();
          }
        }, 320);
      } else if (activeEngineRef.current === 'youtube' && ytControllerRef.current) {
        audioFocusManager.start();
        silentKeepAliveRef.current?.play().catch(() => {});
        ytControllerRef.current.play();
        if (resumeVerifyTimerRef.current) window.clearTimeout(resumeVerifyTimerRef.current);
        resumeVerifyTimerRef.current = window.setTimeout(() => {
          resumeVerifyTimerRef.current = null;
          if (!interruptedBySystemRef.current || userPausedRef.current) return;
          if (ytControllerRef.current?.getPlayerState() === 1) {
            clearInterruptionState();
            setIsPlaying(true);
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          } else {
            silentKeepAliveRef.current?.pause();
          }
        }, 550);
      }
    } finally {
      window.setTimeout(() => {
        attemptingResumeRef.current = false;
      }, 380);
    }
  };
  attemptInterruptionResumeRef.current = attemptInterruptionResume;

  const startInterruptionRecovery = () => {
    if (!autoResumeOnCallRef.current || userPausedRef.current) return;
    if (interruptedBySystemRef.current) return;
    interruptedBySystemRef.current = true;
    // Pause keepalive carrier while call holds telecom audio focus
    silentKeepAliveRef.current?.pause();
    if (interruptionRecoveryTimerRef.current) {
      window.clearInterval(interruptionRecoveryTimerRef.current);
    }
    interruptionRecoveryTimerRef.current = window.setInterval(() => {
      attemptInterruptionResumeRef.current();
    }, 2000);
  };
  startInterruptionRecoveryRef.current = startInterruptionRecovery;

  const setAutoResumeOnCall = (enabled: boolean) => {
    hapticFeedback();
    setAutoResumeOnCallState(enabled);
    autoResumeOnCallRef.current = enabled;
    StorageService.saveAutoResumeOnCall(enabled);
    if (!enabled) {
      clearInterruptionState();
    }
  };

  const setSkipNonBgSongs = (enabled: boolean) => {
    hapticFeedback();
    setSkipNonBgSongsState(enabled);
    skipNonBgSongsRef.current = enabled;
    StorageService.saveSkipNonBgSongs(enabled);
    showToast(
      enabled
        ? 'Skipping non-background songs enabled'
        : 'Skipping non-background songs disabled'
    );
  };

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

  // Initialize Hardware Audio Wake-Lock Carrier Loop & OS Interruption Listener
  useEffect(() => {
    const carrierUri = getSubAudibleAudioUri();
    const silentAudio = new Audio(carrierUri);
    silentAudio.loop = true;
    silentAudio.volume = 0.02; // Active during playback to satisfy Android hardware AudioTrack wake-lock
    (silentAudio as any).playsInline = true;
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('x-webkit-airplay', 'allow');
    silentKeepAliveRef.current = silentAudio;

    const handleCarrierPlay = () => {
      if (interruptedBySystemRef.current && autoResumeOnCallRef.current && !userPausedRef.current) {
        attemptInterruptionResumeRef.current();
      }
    };
    silentAudio.addEventListener('play', handleCarrierPlay);

    // iOS Safari / WebKit fires AudioContext state transitions 'interrupted' <-> 'running' on phone calls
    const unsubInterruption = audioFocusManager.onInterruptionChange((interrupted) => {
      if (interrupted) {
        if (isPlayingRef.current && !userPausedRef.current && !isTransitioningRef.current) {
          if (activeEngineRef.current === 'html' && htmlAudioRef.current) {
            try {
              htmlAudioRef.current.pause();
            } catch {}
          } else if (activeEngineRef.current === 'youtube' && ytControllerRef.current) {
            try {
              ytControllerRef.current.pause();
            } catch {}
          }
          setIsPlaying(false);
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          if (autoResumeOnCallRef.current) {
            startInterruptionRecoveryRef.current();
          }
        }
      } else {
        if (interruptedBySystemRef.current && autoResumeOnCallRef.current && !userPausedRef.current) {
          attemptInterruptionResumeRef.current();
        } else if (!isPlayingRef.current && !sessionStoppedRef.current && currentSongRef.current) {
          audioFocusManager.start();
          assertPausedMediaSessionState();
        }
      }
    });

    return () => {
      unsubInterruption();
      silentAudio.removeEventListener('play', handleCarrierPlay);
      clearInterruptionStateRef.current();
      silentAudio.pause();
      audioFocusManager.stop();
    };
  }, []);

  // Synchronize HTML5 Keep-Alive Carrier & WebAudio Focus:
  // - While playing: keep both AudioContext & silentKeepAlive <audio> running
  // - While paused (app open): pause silentKeepAlive <audio> so Android notification immediately switches to ▶ Play
  //   and Bluetooth AVRCP accepts 'play', while keeping AudioContext running so background tab isn't frozen!
  useEffect(() => {
    if (isPlaying) {
      sessionStoppedRef.current = false;
      audioFocusManager.start();
      silentKeepAliveRef.current?.play().catch(() => {});
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        (navigator as any).wakeLock?.request('screen').catch(() => {});
      }
    } else {
      silentKeepAliveRef.current?.pause();
      if (!sessionStoppedRef.current && currentSongRef.current && !interruptedBySystemRef.current) {
        audioFocusManager.start();
        assertPausedMediaSessionState();
      } else if (!interruptedBySystemRef.current && audioFocusManager.getState() !== 'interrupted') {
        audioFocusManager.stop();
      }
    }
  }, [isPlaying]);

  // Handle visibilitychange & window focus safeguard (prevent mobile OS from throttling background playback & resume after call)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (interruptedBySystemRef.current && autoResumeOnCallRef.current && !userPausedRef.current && !isTransitioningRef.current) {
        attemptInterruptionResumeRef.current();
        return;
      }
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
      } else if (!sessionStoppedRef.current && currentSongRef.current && !interruptedBySystemRef.current) {
        audioFocusManager.start();
        assertPausedMediaSessionState();
      }
    };

    const handleWindowFocus = () => {
      if (interruptedBySystemRef.current && autoResumeOnCallRef.current && !userPausedRef.current && !isTransitioningRef.current) {
        attemptInterruptionResumeRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
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
        const t = audio.currentTime;
        currentTimeRef.current = t;
        setCurrentTime(t);
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          durationRef.current = audio.duration;
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
        if (pauseVerifyTimerRef.current) {
          window.clearTimeout(pauseVerifyTimerRef.current);
          pauseVerifyTimerRef.current = null;
        }
        webAudioEqualizer.ensureActive(audio, equalizerSettingsRef.current);
        if (interruptedBySystemRef.current) {
          // Confirm playback actually holds past 300ms (ignore transient focus bounce during an ongoing call)
          if (resumeVerifyTimerRef.current) window.clearTimeout(resumeVerifyTimerRef.current);
          resumeVerifyTimerRef.current = window.setTimeout(() => {
            resumeVerifyTimerRef.current = null;
            if (!audio.paused && !audio.ended && !userPausedRef.current) {
              clearInterruptionStateRef.current();
              setIsPlaying(true);
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
              }
            }
          }, 300);
          return;
        }
        setIsPlaying(true);
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
        if (resumeVerifyTimerRef.current) {
          window.clearTimeout(resumeVerifyTimerRef.current);
          resumeVerifyTimerRef.current = null;
        }
        if (interruptedBySystemRef.current) {
          setIsPlaying(false);
          if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
          return;
        }
        if (!userPausedRef.current && isPlayingRef.current) {
          const curAudio = htmlAudioRef.current;
          // Preserve existing immediate anti-throttle retry for screen-off playback
          if (curAudio && curAudio.paused && !curAudio.ended && !!(curAudio.currentSrc || curAudio.src)) {
            curAudio.play().catch(() => {});
            // If OS telecom/call holds audio focus and playback stays paused after 350ms,
            // pause UI cleanly and arm auto-resume when the call/interruption ends.
            if (pauseVerifyTimerRef.current) window.clearTimeout(pauseVerifyTimerRef.current);
            pauseVerifyTimerRef.current = window.setTimeout(() => {
              pauseVerifyTimerRef.current = null;
              if (userPausedRef.current || isTransitioningRef.current || activeEngineRef.current !== 'html') {
                return;
              }
              const a = htmlAudioRef.current;
              if (a && a.paused && !a.ended && !!(a.currentSrc || a.src)) {
                setIsPlaying(false);
                if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'paused';
                }
                if (autoResumeOnCallRef.current) {
                  startInterruptionRecoveryRef.current();
                }
              }
            }, 350);
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
          durationRef.current = audio.duration;
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
            if (pauseVerifyTimerRef.current) {
              window.clearTimeout(pauseVerifyTimerRef.current);
              pauseVerifyTimerRef.current = null;
            }
            if (interruptedBySystemRef.current) {
              if (resumeVerifyTimerRef.current) window.clearTimeout(resumeVerifyTimerRef.current);
              resumeVerifyTimerRef.current = window.setTimeout(() => {
                resumeVerifyTimerRef.current = null;
                if (!userPausedRef.current && ytControllerRef.current?.getPlayerState() === 1) {
                  clearInterruptionStateRef.current();
                  setIsPlaying(true);
                  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'playing';
                  }
                }
              }, 450);
              return;
            }
            setIsPlaying(true);
            userPausedRef.current = false;
            if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }
          } else if (state === 2) {
            if (resumeVerifyTimerRef.current) {
              window.clearTimeout(resumeVerifyTimerRef.current);
              resumeVerifyTimerRef.current = null;
            }
            if (interruptedBySystemRef.current) {
              setIsPlaying(false);
              if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
              }
              return;
            }
            // Check if this was a user-initiated pause or browser background throttle pause
            if (!userPausedRef.current && isPlayingRef.current) {
              console.log('[YouTube Player] Background throttle pause intercepted; resuming playback...');
              ytControllerRef.current?.play();
              if (pauseVerifyTimerRef.current) window.clearTimeout(pauseVerifyTimerRef.current);
              pauseVerifyTimerRef.current = window.setTimeout(() => {
                pauseVerifyTimerRef.current = null;
                if (userPausedRef.current || isTransitioningRef.current || activeEngineRef.current !== 'youtube') {
                  return;
                }
                if (ytControllerRef.current?.getPlayerState() !== 1) {
                  setIsPlaying(false);
                  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                  }
                  if (autoResumeOnCallRef.current) {
                    startInterruptionRecoveryRef.current();
                  }
                }
              }, 500);
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
          currentTimeRef.current = time;
          setCurrentTime(time);
          if (dur > 0) {
            durationRef.current = dur;
            setDuration(dur);
          }
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

  // 1. Register MediaSession action handlers ONCE on mount using latest refs (never reset on play/pause!)
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      resumePlaybackRef.current();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      pausePlaybackRef.current();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevTrackRef.current();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrackRef.current();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seekToRef.current(details.seekTime);
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = details.seekOffset || 10;
      seekToRef.current(Math.max(0, currentTimeRef.current - skip));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = details.seekOffset || 10;
      seekToRef.current(Math.min(durationRef.current, currentTimeRef.current + skip));
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      stopPlaybackSessionRef.current();
    });
  }, []);

  // 2. Update MediaMetadata ONLY when the track itself changes (prevents notification flicker/reset on pause)
  // Also preloads & normalizes artwork to an inline 384x384 JPEG data URL (with proxy + retry) so Android notification
  // & lockscreen players never get stuck on Chrome/Muzika placeholders when covers load slowly or from blob/CORS sources.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentSong) {
      document.title = `${currentSong.title} • ${currentSong.artist} — Muzika`;
    } else {
      document.title = 'Muzika - Music Player';
    }

    if (!('mediaSession' in navigator)) return;
    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const ytId =
      currentSong.youtubeId ||
      (currentSong.id.startsWith('yt-') ? currentSong.id.replace('yt-', '') : '');
    const candidates: string[] = [];
    if (currentSong.thumbnailUrl && currentSong.thumbnailUrl.startsWith('http')) {
      candidates.push(currentSong.thumbnailUrl);
    }
    if (ytId && !ytId.startsWith('online-') && !ytId.startsWith('local-')) {
      const hq = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      const mq = `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
      if (!candidates.includes(hq)) candidates.push(hq);
      if (!candidates.includes(mq)) candidates.push(mq);
    }

    const cacheKey = `${currentSong.id}::${candidates[0] || ''}`;
    const cacheMap: Map<string, string> =
      (window as any).__muzikaMediaArtworkCache ||
      ((window as any).__muzikaMediaArtworkCache = new Map<string, string>());

    const applyMetadata = (artworkList: MediaImage[]) => {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.artist,
          album: currentSong.album || 'Muzika',
          artwork: artworkList,
        });
      } catch {}
    };

    const cachedDataUrl = cacheMap.get(cacheKey);
    if (cachedDataUrl) {
      applyMetadata([
        { src: cachedDataUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: cachedDataUrl, sizes: '512x512', type: 'image/jpeg' },
      ]);
      return;
    }

    // Immediate HTTP(S) pass (omit `type` so browser never rejects WebP/PNG labeled as JPEG; avoid blob: URLs)
    if (candidates.length > 0) {
      applyMetadata(
        candidates.slice(0, 2).map((src) => ({ src, sizes: '512x512' }))
      );
    } else {
      applyMetadata([]);
    }

    let cancelled = false;

    const blobToJpegDataUrl = async (blob: Blob): Promise<string | null> => {
      if (!blob || blob.size < 200) return null;
      return new Promise((resolve) => {
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          try {
            const size = 384;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const iw = img.naturalWidth || size;
              const ih = img.naturalHeight || size;
              const minSide = Math.min(iw, ih);
              const sx = Math.max(0, (iw - minSide) / 2);
              const sy = Math.max(0, (ih - minSide) / 2);
              ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              URL.revokeObjectURL(objUrl);
              resolve(dataUrl);
              return;
            }
          } catch {}
          URL.revokeObjectURL(objUrl);
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        };
        img.src = objUrl;
      });
    };

    const fetchUrlAsBlob = async (imgUrl: string): Promise<Blob | null> => {
      // 1. Direct CORS fetch
      try {
        const ctrl = new AbortController();
        const t = window.setTimeout(() => ctrl.abort(), 5000);
        try {
          const resp = await fetch(imgUrl, { mode: 'cors', signal: ctrl.signal });
          if (resp.ok) {
            const b = await resp.blob();
            if (b.size > 200) return b;
          }
        } finally {
          window.clearTimeout(t);
        }
      } catch {}

      // 2. Fallback to same-origin cover proxy if direct CORS was blocked
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const ctrl = new AbortController();
          const t = window.setTimeout(() => ctrl.abort(), 7000);
          try {
            const resp = await fetch(`/api/cover-proxy?url=${encodeURIComponent(imgUrl)}`, {
              signal: ctrl.signal,
            });
            if (resp.ok) {
              const b = await resp.blob();
              if (b.size > 200) return b;
            }
          } finally {
            window.clearTimeout(t);
          }
        } catch {}
      }
      return null;
    };

    (async () => {
      let resolvedDataUrl: string | null = null;

      // 1. Offline/cached artwork blob from IndexedDB first (works 100% offline & avoids blob: URL IPC rejection)
      const cachedBlob = await offlineCacheService.getCachedCoverBlob(currentSong.id);
      if (cancelled) return;
      if (cachedBlob) {
        resolvedDataUrl = await blobToJpegDataUrl(cachedBlob);
      }

      // 2. Online HTTP(S) cover candidates with retry for slow initial loads
      if (!resolvedDataUrl && (typeof navigator === 'undefined' || navigator.onLine)) {
        for (let pass = 0; pass < 2 && !resolvedDataUrl && !cancelled; pass++) {
          if (pass === 1) {
            await new Promise((r) => setTimeout(r, 900));
            if (cancelled) return;
          }
          for (const url of candidates) {
            if (cancelled) return;
            const blob = await fetchUrlAsBlob(url);
            if (cancelled) return;
            if (blob) {
              resolvedDataUrl = await blobToJpegDataUrl(blob);
              if (resolvedDataUrl) break;
            }
          }
        }
      }

      if (cancelled || !resolvedDataUrl) return;

      if (cacheMap.size >= 35) {
        const oldestKey = cacheMap.keys().next().value;
        if (oldestKey) cacheMap.delete(oldestKey);
      }
      cacheMap.set(cacheKey, resolvedDataUrl);

      applyMetadata([
        { src: resolvedDataUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: resolvedDataUrl, sizes: '512x512', type: 'image/jpeg' },
      ]);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, currentSong?.thumbnailUrl, currentSong?.title, currentSong?.artist, currentSong?.album, currentSong?.youtubeId]);

  // 3. Keep MediaSession playbackState synchronized cleanly
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState =
      !currentSong || sessionStoppedRef.current
        ? 'none'
        : isPlaying
        ? 'playing'
        : 'paused';
  }, [currentSong?.id, isPlaying]);

  // Sync MediaSession position (immediate on play/pause/track switch, throttled every ~1.5s while playing)
  const lastMediaSessionPosSyncRef = useRef<number>(0);
  const lastMediaSessionPlayingRef = useRef<boolean>(isPlaying);
  const lastMediaSessionSongIdRef = useRef<string | null>(currentSong?.id ?? null);
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) {
      return;
    }
    if (duration <= 0) return;
    const now = Date.now();
    const stateOrTrackChanged =
      lastMediaSessionPlayingRef.current !== isPlaying ||
      lastMediaSessionSongIdRef.current !== (currentSong?.id ?? null);
    if (!stateOrTrackChanged && now - lastMediaSessionPosSyncRef.current < 1500) return;
    lastMediaSessionPosSyncRef.current = now;
    lastMediaSessionPlayingRef.current = isPlaying;
    lastMediaSessionSongIdRef.current = currentSong?.id ?? null;
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(1, duration),
        playbackRate: isPlaying ? 1 : 0,
        position: Math.max(0, Math.min(currentTime, duration)),
      });
    } catch {}
  }, [currentTime, duration, isPlaying, currentSong?.id]);

  // Persist playback state throttled cleanly (avoids serializing large queues to localStorage 4x/sec)
  const lastSavedPlaybackSecRef = useRef<number>(-99);
  const lastSavedSongIdRef = useRef<string | null>(null);
  const playbackSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentSong) return;
    const sec = Math.floor(currentTime);
    const trackChanged = lastSavedSongIdRef.current !== currentSong.id;
    if (!trackChanged && Math.abs(sec - lastSavedPlaybackSecRef.current) < 4) {
      return;
    }
    lastSavedPlaybackSecRef.current = sec;
    lastSavedSongIdRef.current = currentSong.id;
    StorageService.saveLastPlaybackState({
      song: currentSong,
      currentTime: sec,
      duration,
      queueIndex,
      queue,
    });
  }, [currentSong, currentTime, duration]);

  // Defer saving on queue structure changes so swipe-to-queue / queue reordering stays 60fps
  useEffect(() => {
    if (!currentSongRef.current) return;
    if (playbackSaveTimerRef.current) window.clearTimeout(playbackSaveTimerRef.current);
    playbackSaveTimerRef.current = window.setTimeout(() => {
      if (!currentSongRef.current) return;
      StorageService.saveLastPlaybackState({
        song: currentSongRef.current,
        currentTime: Math.floor(currentTimeRef.current),
        duration: durationRef.current,
        queueIndex: queueIndexRef.current,
        queue: queueRef.current,
      });
    }, 200);
    return () => {
      if (playbackSaveTimerRef.current) window.clearTimeout(playbackSaveTimerRef.current);
    };
  }, [queueIndex, queue]);

  // Save on page exit / unload using refs (registered ONCE cleanly)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSongRef.current) {
        StorageService.saveLastPlaybackState({
          song: currentSongRef.current,
          currentTime: Math.floor(currentTimeRef.current),
          duration: durationRef.current,
          queueIndex: queueIndexRef.current,
          queue: queueRef.current,
        });
      }
      if (enableMultipleQueuesRef.current) {
        if (namedQueuesSaveTimerRef.current) {
          window.clearTimeout(namedQueuesSaveTimerRef.current);
          namedQueuesSaveTimerRef.current = null;
        }
        const curId = activeQueueIdRef.current;
        const flushed = queuesRef.current.map((q) =>
          q.id === curId
            ? { ...q, songs: [...queueRef.current], queueIndex: queueIndexRef.current || 0 }
            : q
        );
        StorageService.saveNamedQueues(flushed);
      }
      sessionStoppedRef.current = true;
      silentKeepAliveRef.current?.pause();
      audioFocusManager.stop();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

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
      playIndexRef.current(curIndex + 1, 0, undefined, undefined, {
        direction: 1,
        visited: [],
        skippedCount: 0,
      });
    } else if (curRepeat === 'all') {
      playIndexRef.current(0, 0, undefined, undefined, {
        direction: 1,
        visited: [],
        skippedCount: 0,
      });
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

  const playIndex = async (
    index: number,
    startAtSecond?: number,
    overrideQueue?: Song[],
    overrideSong?: Song,
    skipCtx?: { direction: 1 | -1; visited: number[]; skippedCount: number }
  ) => {
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
      const blVisited = new Set<number>(skipCtx?.visited || []);
      blVisited.add(index);
      if (index + 1 < activeQueue.length && !blVisited.has(index + 1)) {
        playIndex(index + 1, 0, activeQueue, undefined, {
          direction: skipCtx?.direction ?? 1,
          visited: Array.from(blVisited),
          skippedCount: skipCtx?.skippedCount ?? 0,
        });
        return;
      }
    }

    const reqId = ++playRequestIdRef.current;
    isTransitioningRef.current = true;
    sessionStoppedRef.current = false;
    userPausedRef.current = false;
    clearInterruptionState();
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
      recordPlay(song);
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
        recordPlay(song);
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
        // 3. Fallback: YouTube iframe engine (no direct stream; won't continue in background)
        if (skipNonBgSongsRef.current) {
          const dir: 1 | -1 = skipCtx?.direction ?? 1;
          const visitedSet = new Set<number>(skipCtx?.visited || []);
          visitedSet.add(index);

          let nextIdx = -1;
          if (isShuffleRef.current && activeQueue.length > 1) {
            const unvisited: number[] = [];
            for (let idxCand = 0; idxCand < activeQueue.length; idxCand++) {
              if (!visitedSet.has(idxCand)) unvisited.push(idxCand);
            }
            if (unvisited.length > 0) {
              nextIdx = unvisited[Math.floor(Math.random() * unvisited.length)];
            }
          } else if (dir === 1) {
            if (index + 1 < activeQueue.length && !visitedSet.has(index + 1)) {
              nextIdx = index + 1;
            } else if (repeatModeRef.current === 'all' && activeQueue.length > 0 && !visitedSet.has(0)) {
              nextIdx = 0;
            }
          } else {
            if (index - 1 >= 0 && !visitedSet.has(index - 1)) {
              nextIdx = index - 1;
            } else if (
              repeatModeRef.current === 'all' &&
              activeQueue.length > 0 &&
              !visitedSet.has(activeQueue.length - 1)
            ) {
              nextIdx = activeQueue.length - 1;
            }
          }

          if (nextIdx !== -1 && (skipCtx?.skippedCount ?? 0) < activeQueue.length) {
            showToast(`Skipped "${song.title}" (not BG playable)`);
            await playIndex(nextIdx, 0, activeQueue, undefined, {
              direction: dir,
              visited: Array.from(visitedSet),
              skippedCount: (skipCtx?.skippedCount ?? 0) + 1,
            });
            return;
          }

          activeEngineRef.current = 'html';
          if (ytControllerRef.current) ytControllerRef.current.pause();
          silentKeepAliveRef.current?.pause();
          audioFocusManager.stop();
          setIsPlaying(false);
          showToast('No background-playable songs remaining in queue');
          return;
        }

        recordPlay(song);
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

  const playSong = (rawSong: Song, customQueue?: Song[]) => {
    hapticFeedback();
    clearInterruptionState();
    sessionStoppedRef.current = false;
    userPausedRef.current = false;
    audioFocusManager.start();
    if (htmlAudioRef.current) {
      webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
    }

    const song = StorageService.applySongSyncOverride(rawSong);
    let newQueue: Song[];
    let targetIndex: number;

    if (customQueue && customQueue.length > 0) {
      newQueue = customQueue.map((s) => (s.id === song.id ? song : StorageService.applySongSyncOverride(s)));
      targetIndex = newQueue.findIndex((s) => s.id === song.id);
      if (targetIndex === -1) {
        newQueue = [song, ...newQueue];
        targetIndex = 0;
      }
    } else {
      const currentQ = queueRef.current;
      const existingIdx = currentQ.findIndex((s) => s.id === song.id);
      if (existingIdx !== -1) {
        newQueue = currentQ.map((s) => (s.id === song.id ? song : s));
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

  const pausePlayback = () => {
    clearInterruptionState();
    userPausedRef.current = true;
    sessionStoppedRef.current = false;

    if (htmlAudioRef.current && activeEngineRef.current === 'html') {
      htmlAudioRef.current.pause();
    }
    if (ytControllerRef.current && activeEngineRef.current === 'youtube') {
      ytControllerRef.current.pause();
    }
    // Pause HTML5 silent carrier so Chrome Android flips notification button to Play (▶) and Bluetooth AVRCP accepts 'play',
    // while keeping WebAudio AudioFocus context running so background tab isn't frozen while paused.
    silentKeepAliveRef.current?.pause();
    if (currentSongRef.current) {
      audioFocusManager.start();
    }

    setIsPlaying(false);
    assertPausedMediaSessionState();
  };
  pausePlaybackRef.current = pausePlayback;

  const resumePlayback = () => {
    clearInterruptionState();
    const curSong = currentSongRef.current;
    if (!curSong) {
      if (queueRef.current.length > 0) playIndex(0);
      return;
    }

    sessionStoppedRef.current = false;
    userPausedRef.current = false;
    audioFocusManager.start();
    if (htmlAudioRef.current) {
      webAudioEqualizer.ensureActive(htmlAudioRef.current, equalizerSettingsRef.current);
    }
    silentKeepAliveRef.current?.play().catch(() => {});
    const resumePos = currentTimeRef.current > 0 ? currentTimeRef.current : 0;

    if (activeEngineRef.current === 'html' && htmlAudioRef.current && (htmlAudioRef.current.currentSrc || htmlAudioRef.current.src)) {
      if (ytControllerRef.current) ytControllerRef.current.pause();
      if (resumePos > 0 && Math.abs(htmlAudioRef.current.currentTime - resumePos) > 2) {
        try {
          htmlAudioRef.current.currentTime = resumePos;
        } catch {}
      }
      htmlAudioRef.current.play().catch(() => {
        if (!userPausedRef.current) {
          playIndex(queueIndexRef.current, resumePos);
        }
      });
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
      playIndex(queueIndexRef.current, resumePos);
    }
  };
  resumePlaybackRef.current = resumePlayback;

  const stopPlaybackSession = () => {
    clearInterruptionState();
    userPausedRef.current = true;
    sessionStoppedRef.current = true;
    if (htmlAudioRef.current && activeEngineRef.current === 'html') {
      htmlAudioRef.current.pause();
    }
    if (ytControllerRef.current && activeEngineRef.current === 'youtube') {
      ytControllerRef.current.pause();
    }
    silentKeepAliveRef.current?.pause();
    audioFocusManager.stop();
    setIsPlaying(false);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  };
  stopPlaybackSessionRef.current = stopPlaybackSession;

  const togglePlay = () => {
    hapticFeedback();
    if (!currentSongRef.current) {
      if (queueRef.current.length > 0) playIndex(0);
      return;
    }
    if (isPlayingRef.current) {
      pausePlayback();
    } else {
      resumePlayback();
    }
  };

  const seekTo = (seconds: number) => {
    const activeDur = durationRef.current || 0;
    const clamped = Math.max(0, Math.min(seconds, activeDur));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    if (activeEngineRef.current === 'youtube') {
      ytControllerRef.current?.seekTo(clamped);
    }
    if (activeEngineRef.current === 'html' && htmlAudioRef.current && htmlAudioRef.current.src) {
      try {
        htmlAudioRef.current.currentTime = clamped;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && activeDur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, activeDur),
          playbackRate: isPlayingRef.current ? 1 : 0,
          position: clamped,
        });
      } catch {}
    }
  };
  seekToRef.current = seekTo;

  const nextTrack = () => {
    hapticFeedback();
    if (queue.length === 0) return;
    const fwdCtx = { direction: 1 as const, visited: [], skippedCount: 0 };
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playIndex(randomIndex, 0, undefined, undefined, fwdCtx);
    } else if (queueIndex < queue.length - 1) {
      playIndex(queueIndex + 1, 0, undefined, undefined, fwdCtx);
    } else if (repeatMode === 'all') {
      playIndex(0, 0, undefined, undefined, fwdCtx);
    }
  };
  nextTrackRef.current = nextTrack;

  const prevTrack = () => {
    hapticFeedback();
    if (currentTimeRef.current > 4) {
      seekTo(0);
      return;
    }
    if (queueIndex > 0) {
      playIndex(queueIndex - 1, 0, undefined, undefined, {
        direction: -1,
        visited: [],
        skippedCount: 0,
      });
    } else {
      seekTo(0);
    }
  };
  prevTrackRef.current = prevTrack;

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

  // Queue actions (stable callbacks using queueIndexRef so SwipeableSongRow updates in 1 frame)
  const addToQueue = useCallback((song: Song) => {
    hapticFeedback();
    setQueue((prev) => {
      const updated = [...prev, song];
      queueRef.current = updated;
      return updated;
    });
  }, []);

  const playNextInQueue = useCallback((song: Song) => {
    hapticFeedback();
    setQueue((prev) => {
      const newQ = [...prev];
      const insertAt = Math.min(newQ.length, Math.max(0, queueIndexRef.current + 1));
      newQ.splice(insertAt, 0, song);
      queueRef.current = newQ;
      return newQ;
    });
  }, []);

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
          stopPlaybackSessionRef.current();
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

  const updateArtistTracks = useCallback((artistId: string, topSongs: Song[], meta?: Partial<Artist>) => {
    if (!artistId || !topSongs || topSongs.length === 0) return;

    // Persist in durable IndexedDB regardless of localStorage size limits
    riplaySyncStore
      .saveArtistTracks(artistId, {
        topSongs,
        bannerUrl: meta?.bannerUrl,
        subscribers: meta?.subscribers,
        bio: meta?.bio,
      })
      .catch(() => {});

    setSavedArtists((prev) => {
      if (!prev.some((a) => a.id === artistId)) return prev;
      const updated = prev.map((a) =>
        a.id === artistId
          ? {
              ...a,
              ...meta,
              bannerUrl: meta?.bannerUrl || a.bannerUrl,
              subscribers: meta?.subscribers || a.subscribers,
              bio: meta?.bio || a.bio,
              topSongs,
            }
          : a
      );
      StorageService.saveSavedArtists(updated);
      return updated;
    });

    setImportedArtists((prev) => {
      if (!prev.some((a) => a.id === artistId)) return prev;
      const updated = prev.map((a) =>
        a.id === artistId
          ? {
              ...a,
              ...meta,
              bannerUrl: meta?.bannerUrl || a.bannerUrl,
              subscribers: meta?.subscribers || a.subscribers,
              bio: meta?.bio || a.bio,
              topSongs,
            }
          : a
      );
      StorageService.saveCustomArtists(updated);
      return updated;
    });

    setSelectedArtist((prev) =>
      prev && prev.id === artistId
        ? {
            ...prev,
            ...meta,
            bannerUrl: meta?.bannerUrl || prev.bannerUrl,
            subscribers: meta?.subscribers || prev.subscribers,
            bio: meta?.bio || prev.bio,
            topSongs,
          }
        : prev
    );
  }, []);

  const toggleFollowArtist = (artist: Artist) => {
    hapticFeedback();
    const currentlyFollowed = savedArtistsRef.current.some((a) => a.id === artist.id);

    if (currentlyFollowed) {
      const updated = savedArtistsRef.current.filter((a) => a.id !== artist.id);
      setSavedArtists(updated);
      StorageService.saveSavedArtists(updated);
      return;
    }

    // Attach best-known tracklist immediately from imported/selected records
    const fromImported = importedArtistsRef.current.find((a) => a.id === artist.id);
    const bestTopSongs =
      artist.topSongs && artist.topSongs.length > 0
        ? artist.topSongs
        : fromImported?.topSongs && fromImported.topSongs.length > 0
        ? fromImported.topSongs
        : [];
    const enrichedArtist: Artist = {
      ...fromImported,
      ...artist,
      bookmarkedAt: artist.bookmarkedAt || Date.now(),
      topSongs: bestTopSongs,
    };

    const updated = [enrichedArtist, ...savedArtistsRef.current];
    setSavedArtists(updated);
    StorageService.saveSavedArtists(updated);

    if (bestTopSongs.length > 0) {
      updateArtistTracks(artist.id, bestTopSongs, {
        bannerUrl: enrichedArtist.bannerUrl,
        subscribers: enrichedArtist.subscribers,
        bio: enrichedArtist.bio,
      });
    } else if (typeof navigator === 'undefined' || navigator.onLine) {
      // Background fetch top songs immediately so artist works offline right after saving
      OnlineMusicService.fetchArtistTopSongs(artist.id)
        .then((data) => {
          if (data?.topSongs && data.topSongs.length > 0) {
            updateArtistTracks(artist.id, data.topSongs, {
              bannerUrl: data.bannerUrl || artist.bannerUrl,
              subscribers: artist.subscribers,
              bio: artist.bio,
            });
          }
        })
        .catch(() => {});
    }
  };

  const isAlbumSaved = (albumId: string) => {
    return savedAlbums.some((a) => a.id === albumId);
  };

  const updateAlbumTracks = useCallback((albumId: string, songs: Song[], meta?: Partial<Album>) => {
    if (!albumId || !songs || songs.length === 0) return;

    // Persist in durable IndexedDB so large tracklists survive quota pressure & work offline
    riplaySyncStore.saveAlbumTracks(albumId, songs).catch(() => {});

    setSavedAlbums((prev) => {
      if (!prev.some((a) => a.id === albumId)) return prev;
      const updated = prev.map((a) =>
        a.id === albumId ? { ...a, ...meta, songs } : a
      );
      StorageService.saveSavedAlbums(updated);
      return updated;
    });

    setImportedAlbums((prev) => {
      if (!prev.some((a) => a.id === albumId)) return prev;
      const updated = prev.map((a) =>
        a.id === albumId ? { ...a, ...meta, songs } : a
      );
      StorageService.saveCustomAlbums(updated);
      return updated;
    });

    setSelectedAlbumState((prev) =>
      prev && prev.id === albumId ? { ...prev, ...meta, songs } : prev
    );
  }, []);

  const toggleSaveAlbum = (album: Album) => {
    hapticFeedback();
    const currentlySaved = savedAlbumsRef.current.some((a) => a.id === album.id);

    if (currentlySaved) {
      const updated = savedAlbumsRef.current.filter((a) => a.id !== album.id);
      setSavedAlbums(updated);
      StorageService.saveSavedAlbums(updated);
      return;
    }

    // Attach best-known tracklist immediately from imported/selected records
    const fromImported = importedAlbumsRef.current.find((a) => a.id === album.id);
    const bestSongs =
      album.songs && album.songs.length > 0
        ? album.songs
        : fromImported?.songs && fromImported.songs.length > 0
        ? fromImported.songs
        : [];
    const enrichedAlbum: Album = {
      ...fromImported,
      ...album,
      bookmarkedAt: album.bookmarkedAt || Date.now(),
      songs: bestSongs,
    };

    const updated = [enrichedAlbum, ...savedAlbumsRef.current];
    setSavedAlbums(updated);
    StorageService.saveSavedAlbums(updated);

    if (bestSongs.length > 0) {
      updateAlbumTracks(album.id, bestSongs);
    } else if (typeof navigator === 'undefined' || navigator.onLine) {
      // Background fetch album tracks immediately so album opens offline right away
      OnlineMusicService.fetchAlbumTracks(album.id)
        .then((tracks) => {
          if (tracks && tracks.length > 0) {
            updateAlbumTracks(album.id, tracks);
          }
        })
        .catch(() => {});
    }
  };

  const importRiplaySqliteBackup = async (
    file: File,
    onLog?: (msg: string) => void
  ): Promise<RiplayImportSummary> => {
    if (isRiplayImportingRef.current) {
      throw new Error('An import is already in progress. Please wait for it to complete.');
    }
    isRiplayImportingRef.current = true;
    const tStart = performance.now();
    const collectedLogs: string[] = [];
    const emit = (msg: string) => {
      const elapsed = ((performance.now() - tStart) / 1000).toFixed(2);
      const line = `[+${elapsed}s] ${msg}`;
      collectedLogs.push(line);
      onLog?.(line);
    };
    const yieldMain = () => new Promise<void>((r) => setTimeout(r, 0));

    const persistWithLog = (label: string, fn: () => void, payload?: unknown) => {
      try {
        fn();
        if (payload !== undefined) {
          // Estimate size cleanly only when needed for diagnostics
          const countHint = Array.isArray(payload) ? `${payload.length} items` : 'object';
          emit(`Saved ${label} (${countHint})`);
        } else {
          emit(`Saved ${label}`);
        }
      } catch (e: any) {
        emit(`Warning saving ${label}: ${String(e?.message || e)}`);
      }
    };

    try {
      hapticFeedback();
      emit(`Selected file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
      const buffer = await file.arrayBuffer();
      emit(`Read file ArrayBuffer into memory (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

      await yieldMain();
      const summary = await RiplaySqliteImporter.importFromDatabaseBuffer(buffer, (importerLine) => {
        // Importer already formats timestamped lines or step text; forward directly without double-prefix
        collectedLogs.push(importerLine);
        onLog?.(importerLine);
      });
      await yieldMain();

      // Build O(1) lookup maps of freshly imported songs to enrich existing library items on re-import
      emit('Starting non-blocking library merge...');
      const songById = new Map<string, Song>();
      summary.importedSongs.forEach((s) => songById.set(s.id, s));

      const enrichSong = (existing: Song): Song => {
        const fresh = songById.get(existing.id);
        if (!fresh) return existing;
        const mergedPlayCount = Math.max(existing.playCount || 0, fresh.playCount || 0);
        const mergedPlayTime = Math.max(existing.totalPlayTimeMs || 0, fresh.totalPlayTimeMs || 0);
        return {
          ...existing,
          artistId: existing.artistId || fresh.artistId,
          albumId: existing.albumId || fresh.albumId,
          album: existing.album || fresh.album,
          likedAt: existing.likedAt || fresh.likedAt,
          lyrics: existing.lyrics || fresh.lyrics,
          playCount: mergedPlayCount,
          totalPlayTimeMs: mergedPlayTime || undefined,
          thumbnailUrl: existing.thumbnailUrl || fresh.thumbnailUrl,
        };
      };

      // 1. Merge Playlists cleanly in O(N) (avoid duplicates + append newly discovered tracks on re-import)
      const prevPlaylists = playlistsRef.current;
      const incomingPlById = new Map<string, Playlist>();
      const incomingPlByTitle = new Map<string, Playlist>();
      summary.importedPlaylists.forEach((pl) => {
        incomingPlById.set(pl.id, pl);
        const tKey = (pl.title || '').toLowerCase().trim();
        if (tKey && !incomingPlByTitle.has(tKey)) incomingPlByTitle.set(tKey, pl);
      });

      const matchedIncomingIds = new Set<string>();
      const updatedExistingPlaylists = prevPlaylists.map((pl) => {
        const tKey = (pl.title || '').toLowerCase().trim();
        const match = incomingPlById.get(pl.id) || (tKey ? incomingPlByTitle.get(tKey) : undefined);
        if (!match) {
          return { ...pl, songs: pl.songs.map(enrichSong) };
        }
        matchedIncomingIds.add(match.id);
        const existingTrackIds = new Set(pl.songs.map((s) => s.id));
        const newTracks = match.songs.filter((s) => !existingTrackIds.has(s.id));
        const enrichedExisting = pl.songs.map(enrichSong);
        return {
          ...pl,
          browseId: pl.browseId || match.browseId,
          coverUrl: pl.coverUrl || match.coverUrl,
          songs: newTracks.length > 0 ? [...enrichedExisting, ...newTracks] : enrichedExisting,
        };
      });

      const brandNewPlaylists = summary.importedPlaylists.filter((p) => !matchedIncomingIds.has(p.id));
      const combinedPlaylists = [...brandNewPlaylists, ...updatedExistingPlaylists];
      setPlaylists(combinedPlaylists);
      persistWithLog('playlists', () => StorageService.savePlaylists(combinedPlaylists), combinedPlaylists);
      emit(
        `Playlists merged: ${brandNewPlaylists.length} new, ${updatedExistingPlaylists.length} updated/kept`
      );
      await yieldMain();

      // 2. Merge Liked Songs in O(N)
      const prevLiked = likedSongsRef.current;
      const existingLikedIds = new Set(prevLiked.map((s) => s.id));
      const existingLikedKeys = new Set(
        prevLiked.map((s) => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`)
      );
      const newLiked = summary.importedLikedSongs.filter(
        (s) =>
          !existingLikedIds.has(s.id) &&
          !existingLikedKeys.has(`${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`)
      );
      const combinedLiked = [...newLiked, ...prevLiked.map(enrichSong)];
      setLikedSongs(combinedLiked);
      persistWithLog('likedSongs', () => StorageService.saveLikedSongs(combinedLiked), combinedLiked);
      emit(`Liked songs merged: ${newLiked.length} new, ${combinedLiked.length} total`);
      await yieldMain();

      // 3. Merge History in O(N)
      if (summary.importedHistory.length > 0) {
        const prevHist = historyRef.current;
        const existingHistIds = new Set(prevHist.map((s) => s.id));
        const newHist = summary.importedHistory.filter((s) => !existingHistIds.has(s.id));
        const combinedHist = [...newHist, ...prevHist.map(enrichSong)].slice(0, 50);
        setHistory(combinedHist);
        persistWithLog('history', () => StorageService.saveHistory(combinedHist), combinedHist);
      }

      // 4. Merge Blacklist in O(N)
      if (summary.importedBlacklist.length > 0) {
        const prevBl = blacklistRef.current;
        const existingBlIds = new Set(prevBl.map((b) => b.id));
        const newBl = summary.importedBlacklist.filter((b) => !existingBlIds.has(b.id));
        if (newBl.length > 0) {
          const combinedBl = [...prevBl, ...newBl];
          setBlacklist(combinedBl);
          persistWithLog('blacklist', () => StorageService.saveBlacklist(combinedBl), combinedBl);
        }
      }
      await yieldMain();

      // 5. Merge Imported Artists & ONLY Bookmarked Saved Artists (never duplicate all 1000+ browse artists twice)
      if (summary.importedArtists.length > 0) {
        const prevImpArtists = importedArtistsRef.current;
        const incomingById = new Map<string, Artist>();
        const incomingByName = new Map<string, Artist>();
        summary.importedArtists.forEach((a) => {
          incomingById.set(a.id, a);
          const nKey = (a.name || '').toLowerCase().trim();
          if (nKey && !incomingByName.has(nKey)) incomingByName.set(nKey, a);
        });

        const matchedArtIds = new Set<string>();
        const updatedImpArtists = prevImpArtists.map((existing) => {
          const nKey = (existing.name || '').toLowerCase().trim();
          const fresh = incomingById.get(existing.id) || (nKey ? incomingByName.get(nKey) : undefined);
          if (!fresh) return existing;
          matchedArtIds.add(fresh.id);
          return {
            ...existing,
            thumbnailUrl: existing.thumbnailUrl || fresh.thumbnailUrl,
            bookmarkedAt: existing.bookmarkedAt || fresh.bookmarkedAt,
            timestamp: fresh.timestamp || existing.timestamp,
            topSongs: fresh.topSongs && fresh.topSongs.length > 0 ? fresh.topSongs : existing.topSongs,
          };
        });
        const newImpArtists = summary.importedArtists.filter((a) => !matchedArtIds.has(a.id));
        const combinedImpArtists = [...updatedImpArtists, ...newImpArtists];
        setImportedArtists(combinedImpArtists);
        persistWithLog(
          'importedArtists',
          () => StorageService.saveCustomArtists(combinedImpArtists),
          combinedImpArtists
        );

        // Only add explicitly bookmarked artists to savedArtists (prevents 2x storage bloat & re-import lag)
        const bookmarkedIncoming = summary.importedArtists.filter(
          (a) => typeof a.bookmarkedAt === 'number' && a.bookmarkedAt > 0
        );
        if (bookmarkedIncoming.length > 0) {
          const prevSavedArt = savedArtistsRef.current;
          const savedIds = new Set(prevSavedArt.map((a) => a.id));
          const savedNames = new Set(prevSavedArt.map((a) => (a.name || '').toLowerCase().trim()));
          const newSavedArt = bookmarkedIncoming.filter(
            (a) => !savedIds.has(a.id) && !savedNames.has((a.name || '').toLowerCase().trim())
          );
          if (newSavedArt.length > 0) {
            const combinedSavedArt = [...prevSavedArt, ...newSavedArt];
            setSavedArtists(combinedSavedArt);
            persistWithLog(
              'savedArtists',
              () => StorageService.saveSavedArtists(combinedSavedArt),
              combinedSavedArt
            );
          }
        }
        emit(
          `Artists merged: ${newImpArtists.length} new (${combinedImpArtists.length} total, ${bookmarkedIncoming.length} bookmarked)`
        );
      }
      await yieldMain();

      // 6. Merge Imported Albums & ONLY Bookmarked Saved Albums
      if (summary.importedAlbums.length > 0) {
        const prevImpAlbums = importedAlbumsRef.current;
        const incomingAlbById = new Map<string, Album>();
        const incomingAlbByTitle = new Map<string, Album>();
        summary.importedAlbums.forEach((a) => {
          incomingAlbById.set(a.id, a);
          const tKey = (a.title || '').toLowerCase().trim();
          if (tKey && !incomingAlbByTitle.has(tKey)) incomingAlbByTitle.set(tKey, a);
        });

        const matchedAlbIds = new Set<string>();
        const updatedImpAlbums = prevImpAlbums.map((existing) => {
          const tKey = (existing.title || '').toLowerCase().trim();
          const fresh = incomingAlbById.get(existing.id) || (tKey ? incomingAlbByTitle.get(tKey) : undefined);
          if (!fresh) return existing;
          matchedAlbIds.add(fresh.id);
          return {
            ...existing,
            coverUrl: existing.coverUrl || fresh.coverUrl,
            bookmarkedAt: existing.bookmarkedAt || fresh.bookmarkedAt,
            shareUrl: existing.shareUrl || fresh.shareUrl,
            timestamp: fresh.timestamp || existing.timestamp,
            songs: fresh.songs && fresh.songs.length > 0 ? fresh.songs : existing.songs,
          };
        });
        const newImpAlbums = summary.importedAlbums.filter((a) => !matchedAlbIds.has(a.id));
        const combinedImpAlbums = [...updatedImpAlbums, ...newImpAlbums];
        setImportedAlbums(combinedImpAlbums);
        persistWithLog(
          'importedAlbums',
          () => StorageService.saveCustomAlbums(combinedImpAlbums),
          combinedImpAlbums
        );

        const bookmarkedIncomingAlbums = summary.importedAlbums.filter(
          (a) => typeof a.bookmarkedAt === 'number' && a.bookmarkedAt > 0
        );
        if (bookmarkedIncomingAlbums.length > 0) {
          const prevSavedAlb = savedAlbumsRef.current;
          const savedIds = new Set(prevSavedAlb.map((a) => a.id));
          const savedTitles = new Set(prevSavedAlb.map((a) => (a.title || '').toLowerCase().trim()));
          const newSavedAlb = bookmarkedIncomingAlbums.filter(
            (a) => !savedIds.has(a.id) && !savedTitles.has((a.title || '').toLowerCase().trim())
          );
          if (newSavedAlb.length > 0) {
            const combinedSavedAlb = [...prevSavedAlb, ...newSavedAlb];
            setSavedAlbums(combinedSavedAlb);
            persistWithLog(
              'savedAlbums',
              () => StorageService.saveSavedAlbums(combinedSavedAlb),
              combinedSavedAlb
            );
          }
        }
        emit(
          `Albums merged: ${newImpAlbums.length} new (${combinedImpAlbums.length} total, ${bookmarkedIncomingAlbums.length} bookmarked)`
        );
      }

      // Mirror non-empty imported artist & album tracklists into IndexedDB for offline resilience
      riplaySyncStore
        .saveArtistTracksBatch(
          summary.importedArtists
            .filter((a) => a.topSongs && a.topSongs.length > 0)
            .map((a) => ({ id: a.id, topSongs: a.topSongs, bannerUrl: a.bannerUrl, subscribers: a.subscribers, bio: a.bio }))
        )
        .catch(() => {});
      riplaySyncStore
        .saveAlbumTracksBatch(
          summary.importedAlbums
            .filter((a) => a.songs && a.songs.length > 0)
            .map((a) => ({ id: a.id, songs: a.songs }))
        )
        .catch(() => {});
      await yieldMain();

      // 7. Idempotent User Stats merge (never double-count plays on re-import!)
      const prevStats = userStatsRef.current;
      const mergedSongPlayCounts: Record<string, number> = { ...(prevStats.songPlayCounts || {}) };
      const mergedArtistPlayCounts: Record<string, number> = { ...(prevStats.artistPlayCounts || {}) };
      let deltaPlays = 0;
      let deltaSeconds = 0;

      summary.importedSongs.forEach((s) => {
        const inc = s.playCount || 0;
        const old = mergedSongPlayCounts[s.id] || 0;
        if (inc > old) {
          const diff = inc - old;
          mergedSongPlayCounts[s.id] = inc;
          deltaPlays += diff;
          deltaSeconds += diff * (s.duration || 180);
          if (s.artist) {
            mergedArtistPlayCounts[s.artist] = (mergedArtistPlayCounts[s.artist] || 0) + diff;
          }
        }
      });

      const updatedStats: UserStats = {
        ...prevStats,
        totalPlays: prevStats.totalPlays + deltaPlays,
        totalMinutes: prevStats.totalMinutes + Math.round(deltaSeconds / 60),
        songPlayCounts: mergedSongPlayCounts,
        artistPlayCounts: mergedArtistPlayCounts,
      };
      setUserStats(updatedStats);
      persistWithLog('userStats', () => StorageService.saveUserStats(updatedStats));

      // 8. Only initialize queue if current queue is empty (don't clobber active listening session on re-import!)
      if (queueRef.current.length === 0) {
        if (summary.importedPlaylists.length > 0 && summary.importedPlaylists[0].songs.length > 0) {
          const firstPl = summary.importedPlaylists[0];
          setQueue(firstPl.songs);
          setQueueIndex(0);
          setCurrentSong(firstPl.songs[0]);
          emit(`Initialized empty queue with playlist "${firstPl.title}"`);
        } else if (summary.importedLikedSongs.length > 0) {
          setQueue(summary.importedLikedSongs);
          setQueueIndex(0);
          setCurrentSong(summary.importedLikedSongs[0]);
          emit(`Initialized empty queue with Liked Songs`);
        }
      } else {
        // Enrich current queue tracks in-place without interrupting playback
        setQueue((prev) => prev.map(enrichSong));
      }

      setLastImportSummary(summary);
      persistWithLog('lastImportSummary', () => StorageService.saveLastImportSummary(summary));
      emit('Re-import & merge finished cleanly with zero errors.');

      summary.logs = collectedLogs;
      return summary;
    } finally {
      isRiplayImportingRef.current = false;
    }
  };

  const exportRiplaySqliteBackup = async (
    onLog?: (msg: string) => void
  ): Promise<RiplayExportResult> => {
    if (isRiplayExportingRef.current) {
      throw new Error('An export is already in progress. Please wait.');
    }
    isRiplayExportingRef.current = true;
    try {
      hapticFeedback();
      await new Promise<void>((r) => setTimeout(r, 10));

      const result = await RiplaySqliteImporter.exportToDatabaseBuffer(
        {
          playlists: playlistsRef.current,
          likedSongs: likedSongsRef.current,
          history: historyRef.current,
          blacklist: blacklistRef.current,
          importedArtists: importedArtistsRef.current,
          savedArtists: savedArtistsRef.current,
          importedAlbums: importedAlbumsRef.current,
          savedAlbums: savedAlbumsRef.current,
          userStats: userStatsRef.current,
          queue: queueRef.current,
        },
        onLog
      );

      // Trigger file download cleanly across desktop & Android/iOS PWAs
      const blob = new Blob([new Uint8Array(result.buffer)], {
        type: 'application/x-sqlite3',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);

      showToast(`Exported ${result.fileName} (${result.songsCount} songs, ${result.playlistsCount} playlists)`);
      return result;
    } finally {
      isRiplayExportingRef.current = false;
    }
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

    const matchedYoutubeId =
      matchedSong.source === 'stream'
        ? undefined
        : matchedSong.youtubeId || (matchedSong.id?.startsWith('yt-') ? matchedSong.id.replace('yt-', '') : undefined);

    const rewritten: Song = {
      ...originalSong,
      title: matchedSong.title || originalSong.title,
      artist: matchedSong.artist || originalSong.artist,
      album: matchedSong.album ?? originalSong.album,
      duration: matchedSong.duration || originalSong.duration,
      thumbnailUrl: matchedSong.thumbnailUrl || originalSong.thumbnailUrl,
      source: matchedSong.source,
      youtubeId: matchedYoutubeId,
      // Explicitly reset stale streamUrl unless matched candidate carries an explicit streamUrl
      streamUrl: matchedSong.source === 'stream' ? matchedSong.streamUrl : undefined,
      syncedAt: Date.now(),
    };
    if (matchedSong.source !== 'stream') {
      delete rewritten.streamUrl;
    } else {
      delete rewritten.youtubeId;
    }

    // 1. Save persistent override so future lookups or re-imports use the fixed version
    StorageService.saveSongSyncOverride(originalSong.id, rewritten);

    // 2. Always clear any stale cached audio/cover blob from IndexedDB for this song ID
    await offlineCacheService.removeCachedSong(originalSong.id).catch(() => {});
    offlineCacheService.clearIntentionallyRemoved(originalSong.id);

    // Reset saved-track guard so lastPlaybackState immediately persists updated metadata
    lastSavedSongIdRef.current = null;

    const replaceInList = (list: Song[]) =>
      list.map((s) => {
        if (s.id !== originalSong.id) return s;
        const next: Song = { ...s, ...rewritten, id: s.id };
        if (rewritten.source !== 'stream') delete next.streamUrl;
        else delete next.youtubeId;
        return next;
      });

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

    const updatedNamedQueues = queuesRef.current.map((q) => ({
      ...q,
      songs: replaceInList(q.songs),
    }));
    queuesRef.current = updatedNamedQueues;
    setQueuesState(updatedNamedQueues);
    StorageService.saveNamedQueues(updatedNamedQueues);

    // 7. Rewrite inside Imported / Saved Artists, Albums & IndexedDB Track Cache
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
    riplaySyncStore.rewriteSyncedSong(originalSong.id, rewritten).catch(() => {});

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
      limit: 20,
    });

    const bestMatch = OnlineMusicService.pickBestSyncMatch(song, candidates, resolvedMeta);
    if (!bestMatch) {
      showToast('No matching tracks found — try Manual Sync');
      return null;
    }

    return await applySongSync(song, bestMatch, true);
  };

  const playbackTimeValue = useMemo(
    () => ({ currentTime, duration }),
    [currentTime, duration]
  );

  return (
    <PlaybackTimeContext.Provider value={playbackTimeValue}>
      <MusicContext.Provider
        value={{
          currentSong,
          isPlaying,
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
          confirmExitApp,
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
          exportRiplaySqliteBackup,
          riplayModalMode,
          setRiplayModalMode,
          openRiplayModal,
          importedArtists,
          importedAlbums,
          lastImportSummary,
          savedArtists,
          toggleFollowArtist,
          isArtistFollowed,
          updateArtistTracks,
          savedAlbums,
          toggleSaveAlbum,
          isAlbumSaved,
          updateAlbumTracks,
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
          cacheRestoreProgress,
          registerBackHandler,
          enableMultipleQueues,
          setEnableMultipleQueues,
          queues,
          activeQueueId,
          activeQueueName,
          switchQueue,
          createQueue,
          renameQueue,
          deleteQueue,
          updateQueueSchedules,
          toggleDefaultQueue,
          addPlaylistToQueue,
          autoResumeOnCall,
          setAutoResumeOnCall,
          skipNonBgSongs,
          setSkipNonBgSongs,
        }}
      >
        {children}
      </MusicContext.Provider>
    </PlaybackTimeContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};

export function useBackHandler(isOpen: boolean, onBack: () => void) {
  const { registerBackHandler } = useMusic();
  const idRef = useRef(`bh-${Math.random().toString(36).slice(2, 10)}`);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(idRef.current, () => onBackRef.current());
  }, [isOpen, registerBackHandler]);
}
