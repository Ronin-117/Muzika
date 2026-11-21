import React, { useRef } from 'react';
import { useMusic, usePlaybackTime } from '../../context/MusicContext';
import { Play, Pause, SkipForward, SkipBack, Heart } from 'lucide-react';

const SWIPE_THRESHOLD = 54;
const FLICK_MIN_DISTANCE = 26;
const FLICK_MAX_MS = 240;
const FLICK_MIN_VELOCITY = 0.34;
const MAX_OFFSET = 96;

export const MiniPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleLike,
    isLiked,
    setIsPlayerOpen,
    getSongCoverUrl,
    themeColors,
    hapticFeedback,
  } = useMusic();
  const { currentTime, duration } = usePlaybackTime();

  const cardInnerRef = useRef<HTMLDivElement | null>(null);
  const leftHintRef = useRef<HTMLDivElement | null>(null);
  const rightHintRef = useRef<HTMLDivElement | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const dragXRef = useRef(0);
  const trackingRef = useRef(false);
  const horizontalLockRef = useRef<boolean | null>(null);
  const didSwipeRef = useRef(false);
  const thresholdHapticRef = useRef(false);

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const liked = isLiked(currentSong.id);

  const resetVisuals = (animate = true) => {
    dragXRef.current = 0;
    const inner = cardInnerRef.current;
    if (inner) {
      inner.style.transition = animate ? 'transform 190ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
      inner.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (leftHintRef.current) {
      leftHintRef.current.style.transition = animate ? 'opacity 160ms ease-out' : 'none';
      leftHintRef.current.style.opacity = '0';
    }
    if (rightHintRef.current) {
      rightHintRef.current.style.transition = animate ? 'opacity 160ms ease-out' : 'none';
      rightHintRef.current.style.opacity = '0';
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    startTimeRef.current = performance.now();
    dragXRef.current = 0;
    trackingRef.current = true;
    horizontalLockRef.current = null;
    didSwipeRef.current = false;
    thresholdHapticRef.current = false;

    if (cardInnerRef.current) {
      cardInnerRef.current.style.transition = 'none';
    }
    if (leftHintRef.current) leftHintRef.current.style.transition = 'none';
    if (rightHintRef.current) rightHintRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!trackingRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    if (horizontalLockRef.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        const isHoriz = Math.abs(dx) >= Math.abs(dy) * 0.85;
        horizontalLockRef.current = isHoriz;
        if (!isHoriz) {
          trackingRef.current = false;
          resetVisuals(false);
          return;
        }
      } else {
        return;
      }
    }

    if (horizontalLockRef.current) {
      didSwipeRef.current = true;
      const abs = Math.abs(dx);
      const sign = dx >= 0 ? 1 : -1;
      const damped = abs <= 64 ? dx : sign * (64 + (abs - 64) * 0.35);
      const clampedX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, damped));
      dragXRef.current = clampedX;

      if (cardInnerRef.current) {
        cardInnerRef.current.style.transform = `translate3d(${clampedX}px, 0px, 0px)`;
      }

      const progress = Math.min(1, Math.abs(clampedX) / SWIPE_THRESHOLD);
      const isReady = Math.abs(clampedX) >= SWIPE_THRESHOLD;

      if (isReady && !thresholdHapticRef.current) {
        thresholdHapticRef.current = true;
        hapticFeedback();
      } else if (!isReady) {
        thresholdHapticRef.current = false;
      }

      if (leftHintRef.current) {
        leftHintRef.current.style.opacity = clampedX > 0 ? String(progress) : '0';
      }
      if (rightHintRef.current) {
        rightHintRef.current.style.opacity = clampedX < 0 ? String(progress) : '0';
      }
    }
  };

  const handleTouchEnd = (cancelled = false) => {
    if (!trackingRef.current) return;
    trackingRef.current = false;

    const finalX = dragXRef.current;
    const elapsed = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(finalX) / elapsed;

    resetVisuals(true);

    if (cancelled || !horizontalLockRef.current) {
      horizontalLockRef.current = null;
      return;
    }

    const isFlick =
      Math.abs(finalX) >= FLICK_MIN_DISTANCE &&
      elapsed <= FLICK_MAX_MS &&
      velocity >= FLICK_MIN_VELOCITY;

    if (Math.abs(finalX) >= SWIPE_THRESHOLD || isFlick) {
      hapticFeedback();
      if (finalX < 0) {
        // Swiped left -> Next track
        nextTrack();
      } else {
        // Swiped right -> Previous track
        prevTrack();
      }
    }

    horizontalLockRef.current = null;
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (didSwipeRef.current) {
      e.stopPropagation();
      e.preventDefault();
      didSwipeRef.current = false;
    }
  };

  return (
    <div
      onClick={() => {
        if (didSwipeRef.current) {
          didSwipeRef.current = false;
          return;
        }
        hapticFeedback();
        setIsPlayerOpen(true);
      }}
      onClickCapture={handleClickCapture}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => handleTouchEnd(false)}
      onTouchCancel={() => handleTouchEnd(true)}
      className="fixed bottom-[60px] left-2 right-2 max-w-md mx-auto z-[45] rounded-2xl shadow-2xl overflow-hidden cursor-pointer backdrop-blur-xl border border-white/10 transition-transform active:scale-[0.99] touch-pan-y select-none"
      style={{
        backgroundColor: `${themeColors.background1}f2`,
        color: themeColors.text,
      }}
    >
      {/* Progress Bar Header */}
      <div className="w-full h-1 bg-white/10 overflow-hidden relative z-20">
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progressPercent))}%`,
            backgroundColor: themeColors.accent,
          }}
        />
      </div>

      {/* Swipe Directional Peek Hints (underneath sliding content) */}
      <div
        ref={leftHintRef}
        className="absolute inset-y-0 left-3 flex items-center gap-1.5 text-xs font-bold pointer-events-none z-0"
        style={{ opacity: 0, color: themeColors.accent }}
      >
        <SkipBack className="w-4 h-4 fill-current" />
        <span>Prev</span>
      </div>
      <div
        ref={rightHintRef}
        className="absolute inset-y-0 right-3 flex items-center gap-1.5 text-xs font-bold pointer-events-none z-0"
        style={{ opacity: 0, color: themeColors.accent }}
      >
        <span>Next</span>
        <SkipForward className="w-4 h-4 fill-current" />
      </div>

      {/* Sliding MiniPlayer Content */}
      <div
        ref={cardInnerRef}
        className="flex items-center justify-between p-2.5 relative z-10"
        style={{ backgroundColor: `${themeColors.background1}f2` }}
      >
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
                  <span className="w-0.5 h-full bg-white muzika-eq-bar" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-full bg-white muzika-eq-bar" style={{ animationDelay: '200ms' }} />
                  <span className="w-0.5 h-full bg-white muzika-eq-bar" style={{ animationDelay: '400ms' }} />
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
