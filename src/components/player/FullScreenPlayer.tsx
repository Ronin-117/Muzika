import React, { useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import {
  ChevronDown,
  MoreVertical,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Mic2,
  Video,
  Disc3,
  Sliders,
  Moon,
  Info,
  Share2,
  Ban,
  DownloadCloud,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { LyricsView } from './LyricsView';
import { QueueView } from './QueueView';
import { VisualizerCanvas } from './VisualizerCanvas';

export const FullScreenPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seekTo,
    nextTrack,
    prevTrack,
    repeatMode,
    cycleRepeat,
    isShuffle,
    toggleShuffle,
    toggleLike,
    isLiked,
    isPlayerOpen,
    setIsPlayerOpen,
    playerMode,
    setPlayerMode,
    setIsEqualizerOpen,
    setIsSleepTimerOpen,
    setIsSongInfoOpen,
    addToBlacklist,
    setSelectedArtistId,
    themeColors,
    hapticFeedback,
    isSongCached,
    cacheSong,
    removeCachedSong,
    setAddToPlaylistTargetSong,
    setSongOptionsMenuTarget,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<'cover' | 'video' | 'lyrics' | 'queue'>('cover');

  if (!isPlayerOpen || !currentSong) return null;

  const liked = isLiked(currentSong.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom duration-300 backdrop-blur-2xl"
      style={{ backgroundColor: themeColors.background0, color: themeColors.text }}
    >
      {/* Background ambient glow matching cover art */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: themeColors.accent }}
      />
      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ backgroundColor: themeColors.accent }}
      />

      {/* Top Header Bar */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => {
            hapticFeedback();
            if (typeof window !== 'undefined' && window.history.length > 1) {
              window.history.back();
            } else {
              setIsPlayerOpen(false);
            }
          }}
          className="p-2 rounded-full hover:bg-white/10 transition text-white/80"
          title="Minimize player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center max-w-[200px]">
          <span className="text-[10px] tracking-wider uppercase font-semibold opacity-50">
            Playing From
          </span>
          <span className="text-xs font-bold truncate">
            {currentSong.album || 'Muzika Library'}
          </span>
        </div>

        <button
          onClick={() => {
            hapticFeedback();
            setSongOptionsMenuTarget({ song: currentSong });
          }}
          className="p-2 rounded-full hover:bg-white/10 transition text-white/80 active:scale-95"
          title="Player options & Add to Playlist"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Main Center Area: Swappable Views (Cover / Video / Lyrics / Queue) */}
      <div
        className={`relative z-10 flex-1 flex flex-col min-h-0 ${
          activeTab === 'cover'
            ? 'items-center justify-center px-6 py-2'
            : 'w-full px-2 sm:px-6 py-1 overflow-hidden'
        }`}
      >
        {activeTab === 'cover' && (
          <div className="flex flex-col items-center justify-center w-full max-w-sm h-full my-auto">
            {/* Spinning Vinyl Record with Album Center */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full p-2.5 bg-gradient-to-tr from-neutral-900 via-neutral-800 to-black shadow-2xl flex items-center justify-center border-4 border-neutral-900/80">
              {/* Vinyl Grooves */}
              <div
                className={`w-full h-full rounded-full border-2 border-white/5 flex items-center justify-center ${
                  isPlaying ? 'animate-[spin_16s_linear_infinite]' : ''
                }`}
                style={{
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.5)',
                }}
              >
                {/* Center Label / Cover Art */}
                <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden shadow-inner border-2 border-white/20">
                  <img
                    src={currentSong.thumbnailUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                  {/* Center Spindle Hole */}
                  <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-neutral-950 border-2 border-white/30 shadow-md" />
                </div>
              </div>
            </div>

            {/* Live Audio Visualizer Canvas */}
            <div className="w-full max-w-xs mt-4">
              <VisualizerCanvas styleType="bars" />
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="w-full max-w-sm h-56 rounded-3xl overflow-hidden bg-black/60 shadow-2xl flex flex-col items-center justify-center my-auto border border-white/10 p-4 text-center">
            <Video className="w-8 h-8 mb-2 opacity-50" style={{ color: themeColors.accent }} />
            <div className="text-xs font-bold text-white mb-1">Live YouTube Video Stream</div>
            <div className="text-[11px] opacity-60">Streaming video directly on your mobile device</div>
          </div>
        )}

        {activeTab === 'lyrics' && <LyricsView />}

        {activeTab === 'queue' && <QueueView />}
      </div>

      {/* View Switcher Chips (Cover, Video, Lyrics, Queue) */}
      <div className="relative z-10 flex items-center justify-center gap-2 py-1.5 px-4">
        {[
          { id: 'cover', label: 'Vinyl', icon: Disc3 },
          { id: 'video', label: 'Video', icon: Video },
          { id: 'lyrics', label: 'Lyrics', icon: Mic2 },
          { id: 'queue', label: 'Queue', icon: ListMusic },
        ].map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                hapticFeedback();
                setActiveTab(id as any);
                if (id === 'video') {
                  setPlayerMode('video');
                } else {
                  setPlayerMode('audio');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                isActive
                  ? 'text-white shadow-md'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
              style={{
                backgroundColor: isActive ? themeColors.accent : undefined,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Bottom Controls Area */}
      <div
        className={`relative z-10 max-w-md mx-auto w-full flex flex-col ${
          activeTab === 'queue'
            ? 'px-4 pb-3 pt-1 gap-1.5'
            : 'px-6 pb-6 pt-2 gap-3'
        }`}
      >
        {/* Track Title, Artist & Like */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-3">
            <h1
              className={`font-black truncate leading-tight ${
                activeTab === 'queue' ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'
              }`}
            >
              {currentSong.title}
            </h1>
            <p
              onClick={() => {
                hapticFeedback();
                if (currentSong.artistId) {
                  setSelectedArtistId(currentSong.artistId);
                  setIsPlayerOpen(false);
                }
              }}
              className="text-sm opacity-70 truncate mt-1 hover:underline cursor-pointer"
            >
              {currentSong.artist}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Offline Cache Download Button */}
            <button
              onClick={() => {
                hapticFeedback();
                if (isSongCached(currentSong.id)) {
                  removeCachedSong(currentSong.id);
                } else {
                  cacheSong(currentSong);
                }
              }}
              className="p-3 rounded-full hover:bg-white/10 transition"
              title={
                isSongCached(currentSong.id)
                  ? 'Cached for Offline (Click to remove)'
                  : 'Download for Offline Listening'
              }
            >
              {isSongCached(currentSong.id) ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <DownloadCloud className="w-6 h-6 text-white/60 hover:text-white" />
              )}
            </button>

            <button
              onClick={() => toggleLike(currentSong)}
              className="p-3 rounded-full hover:bg-white/10 transition"
              title="Like track"
            >
              <Heart
                className={`w-6 h-6 transition transform active:scale-125 ${
                  liked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white/60'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Seekbar Slider */}
        <div className="w-full space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg cursor-pointer bg-white/10 transition"
            style={{ accentColor: themeColors.accent }}
          />
          <div className="flex items-center justify-between text-[11px] font-mono opacity-60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main Transport Controls */}
        <div className="flex items-center justify-between mt-1">
          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
            className={`p-2 rounded-full transition ${
              isShuffle ? 'text-white' : 'opacity-40 hover:opacity-80'
            }`}
            style={{ color: isShuffle ? themeColors.accent : undefined }}
            title="Toggle shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 transition"
            title="Previous"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          {/* 10s Rewind */}
          <button
            onClick={() => seekTo(Math.max(0, currentTime - 10))}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 transition"
            title="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause Main FAB */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition transform active:scale-95"
            style={{
              backgroundColor: themeColors.accent,
              boxShadow: `0 8px 30px ${themeColors.accent}66`,
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white text-white" />
            ) : (
              <Play className="w-7 h-7 fill-white text-white ml-1" />
            )}
          </button>

          {/* 30s Fast Forward */}
          <button
            onClick={() => seekTo(Math.min(duration, currentTime + 30))}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 transition"
            title="Forward 30s"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 transition"
            title="Next"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          {/* Repeat Mode */}
          <button
            onClick={cycleRepeat}
            className={`p-2 rounded-full transition ${
              repeatMode !== 'off' ? 'text-white' : 'opacity-40 hover:opacity-80'
            }`}
            style={{ color: repeatMode !== 'off' ? themeColors.accent : undefined }}
            title={`Repeat mode: ${repeatMode}`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
