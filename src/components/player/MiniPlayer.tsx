import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { Play, Pause, SkipForward, Heart } from 'lucide-react';

export const MiniPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    toggleLike,
    isLiked,
    setIsPlayerOpen,
    getSongCoverUrl,
    themeColors,
    hapticFeedback,
  } = useMusic();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const liked = isLiked(currentSong.id);

  return (
    <div
      onClick={() => {
        hapticFeedback();
        setIsPlayerOpen(true);
      }}
      className="fixed bottom-[60px] left-2 right-2 max-w-md mx-auto z-[45] rounded-2xl shadow-2xl overflow-hidden cursor-pointer backdrop-blur-xl border border-white/10 transition-transform active:scale-[0.99]"
      style={{
        backgroundColor: `${themeColors.background1}f2`,
        color: themeColors.text,
      }}
    >
      {/* Progress Bar Header */}
      <div className="w-full h-1 bg-white/10 overflow-hidden">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            backgroundColor: themeColors.accent,
          }}
        />
      </div>

      <div className="flex items-center justify-between p-2.5">
        {/* Thumbnail & Title */}
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-2">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
            <img
              src={getSongCoverUrl(currentSong)}
              alt={currentSong.title}
              className={`w-full h-full object-cover ${isPlaying ? 'brightness-105' : 'brightness-90'}`}
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-full bg-white animate-pulse" />
                  <span className="w-0.5 h-2 bg-white animate-pulse delay-75" />
                  <span className="w-0.5 h-2.5 bg-white animate-pulse delay-150" />
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden flex-1 min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{currentSong.title}</div>
            <div className="text-xs opacity-60 truncate mt-0.5 flex items-center gap-1.5">
              <span>{currentSong.artist}</span>
              {currentTime > 0 && !isPlaying && (
                <span className="font-mono text-[10px] text-amber-400 bg-amber-400/10 px-1 rounded">
                  {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleLike(currentSong)}
            className="p-2 rounded-full hover:bg-white/10 transition"
            title="Like track"
          >
            <Heart
              className={`w-4 h-4 transition ${liked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white/60'}`}
            />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition transform active:scale-95"
            style={{ backgroundColor: themeColors.accent }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white text-white" />
            ) : (
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 rounded-full hover:bg-white/10 text-white/80 transition"
            title="Next Track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
