import React, { useState, useRef, useEffect, memo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { ListPlus, CornerDownRight, Check } from 'lucide-react';
import { Song } from '../../types/music';
import { isSameSong } from './PlayingBars';

interface SwipeableSongRowProps {
  song: Song;
  children: React.ReactNode;
  onSwipeAdd?: (song: Song, mode: 'next' | 'end') => void;
  className?: string;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 52;
const FLICK_MIN_DISTANCE = 28;
const FLICK_MAX_MS = 240;
const FLICK_MIN_VELOCITY = 0.32;
const MAX_OFFSET = 114;
const MOVE_CANCEL_PX = 6;
const LONG_PRESS_MS = 520;

export const SwipeableSongRow: React.FC<SwipeableSongRowProps> = memo(({
  song,
  children,
  onSwipeAdd,
  className = '',
  disabled = false,
}) => {
  const {
    addToQueue,
    playNextInQueue,
    setSongOptionsMenuTarget,
    hapticFeedback,
    currentSong,
    themeColors,
  } = useMusic();
  const [addedMode, setAddedMode] = useState<'next' | 'end' | null>(null);

  const isCurrentlyActive = isSameSong(currentSong, song);

  const foregroundRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const leftLabelRef = useRef<HTMLDivElement | null>(null);
  const rightLabelRef = useRef<HTMLDivElement | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const thresholdHapticFiredRef = useRef(false);
  const wasDraggedRef = useRef(false);
  const touchMovedRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const flashTimerRef = useRef<number | null>(null);
  const scrollCancelAttachedRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (scrollCancelAttachedRef.current) {
      window.removeEventListener('scroll', clearLongPressTimer, true);
      scrollCancelAttachedRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const resetVisuals = (animate = true) => {
    dragOffsetRef.current = 0;
    const fg = foregroundRef.current;
    const bg = bgRef.current;

    if (fg) {
      fg.style.transition = animate ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
      fg.style.transform = 'translate3d(0px, 0px, 0px)';
      if (!animate) {
        fg.style.willChange = 'transform';
      } else {
        window.setTimeout(() => {
          if (foregroundRef.current && !isTrackingRef.current) {
            foregroundRef.current.style.willChange = 'auto';
          }
        }, 190);
      }
    }

    if (bg) {
      bg.style.transition = animate ? 'opacity 160ms ease-out' : 'none';
      bg.style.opacity = '0';
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) {
      clearLongPressTimer();
      return;
    }
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    startTimeRef.current = performance.now();
    dragOffsetRef.current = 0;
    isHorizontalSwipeRef.current = null;
    thresholdHapticFiredRef.current = false;
    wasDraggedRef.current = false;
    touchMovedRef.current = false;
    isLongPressRef.current = false;
    isTrackingRef.current = true;

    if (foregroundRef.current) {
      foregroundRef.current.style.transition = 'none';
      foregroundRef.current.style.willChange = 'transform';
    }
    if (bgRef.current) {
      bgRef.current.style.transition = 'none';
    }

    clearLongPressTimer();
    window.addEventListener('scroll', clearLongPressTimer, { capture: true, passive: true, once: true });
    scrollCancelAttachedRef.current = true;

    longPressTimerRef.current = window.setTimeout(() => {
      if (touchMovedRef.current || isHorizontalSwipeRef.current !== null) {
        clearLongPressTimer();
        return;
      }
      clearLongPressTimer();
      isLongPressRef.current = true;
      isTrackingRef.current = false;
      hapticFeedback();
      resetVisuals(true);
      setSongOptionsMenuTarget({ song });
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    if (e.touches.length !== 1) {
      clearLongPressTimer();
      isTrackingRef.current = false;
      return;
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Cancel long-press immediately on ANY scroll or swipe movement (> 6px), even after vertical lock
    if (Math.abs(deltaX) > MOVE_CANCEL_PX || Math.abs(deltaY) > MOVE_CANCEL_PX) {
      touchMovedRef.current = true;
      clearLongPressTimer();
    }

    if (!isTrackingRef.current) return;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > MOVE_CANCEL_PX || Math.abs(deltaY) > MOVE_CANCEL_PX) {
        const horizontal = Math.abs(deltaX) >= Math.abs(deltaY) * 0.8;
        isHorizontalSwipeRef.current = horizontal;
        clearLongPressTimer();
        touchMovedRef.current = true;
        if (!horizontal) {
          isTrackingRef.current = false;
          resetVisuals(false);
          return;
        }
      } else {
        return;
      }
    }

    if (isHorizontalSwipeRef.current) {
      wasDraggedRef.current = true;
      touchMovedRef.current = true;
      clearLongPressTimer();
      const abs = Math.abs(deltaX);
      const sign = deltaX >= 0 ? 1 : -1;
      const damped = abs <= 86 ? deltaX : sign * (86 + (abs - 86) * 0.3);
      const clampedX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, damped));
      dragOffsetRef.current = clampedX;

      if (foregroundRef.current) {
        foregroundRef.current.style.transform = `translate3d(${clampedX}px, 0px, 0px)`;
      }

      const absOffset = Math.abs(clampedX);
      const isRight = clampedX > 0;
      const isReady = absOffset >= SWIPE_THRESHOLD;

      if (isReady && !thresholdHapticFiredRef.current) {
        thresholdHapticFiredRef.current = true;
        hapticFeedback();
      } else if (!isReady) {
        thresholdHapticFiredRef.current = false;
      }

      if (bgRef.current) {
        bgRef.current.style.opacity = String(Math.min(1, absOffset / SWIPE_THRESHOLD));
        bgRef.current.style.backgroundColor = isRight
          ? isReady
            ? 'rgb(37 99 235)'
            : 'rgba(37, 99, 235, 0.72)'
          : isReady
          ? 'rgb(5 150 105)'
          : 'rgba(5, 150, 105, 0.72)';
      }

      if (leftLabelRef.current) {
        leftLabelRef.current.style.display = isRight ? 'flex' : 'none';
      }
      if (rightLabelRef.current) {
        rightLabelRef.current.style.display = !isRight && clampedX !== 0 ? 'flex' : 'none';
      }
    }
  };

  const finishSwipe = (cancelled = false) => {
    clearLongPressTimer();
    if (!isTrackingRef.current) return;
    isTrackingRef.current = false;

    const finalX = dragOffsetRef.current;
    const elapsed = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(finalX) / elapsed;

    resetVisuals(true);

    if (disabled || isLongPressRef.current || cancelled || !isHorizontalSwipeRef.current) {
      isHorizontalSwipeRef.current = null;
      return;
    }

    const isFlick =
      Math.abs(finalX) >= FLICK_MIN_DISTANCE &&
      elapsed <= FLICK_MAX_MS &&
      velocity >= FLICK_MIN_VELOCITY;

    if (Math.abs(finalX) >= SWIPE_THRESHOLD || isFlick) {
      if (!thresholdHapticFiredRef.current) {
        hapticFeedback();
      }
      const mode: 'next' | 'end' = finalX > 0 ? 'next' : 'end';

      if (onSwipeAdd) {
        onSwipeAdd(song, mode);
      } else if (mode === 'next') {
        playNextInQueue(song);
      } else {
        addToQueue(song);
      }

      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      setAddedMode(mode);
      flashTimerRef.current = window.setTimeout(() => setAddedMode(null), 650);
    }

    isHorizontalSwipeRef.current = null;
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (wasDraggedRef.current || isLongPressRef.current) {
      e.stopPropagation();
      e.preventDefault();
      wasDraggedRef.current = false;
      isLongPressRef.current = false;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Never fire touch-hold contextmenu if user scrolled or swiped
    if (touchMovedRef.current || wasDraggedRef.current) return;
    clearLongPressTimer();
    hapticFeedback();
    setSongOptionsMenuTarget({ song });
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none touch-pan-y transition-shadow ${className}`}
      style={
        isCurrentlyActive
          ? {
              boxShadow: `inset 0 0 0 1px ${themeColors.accent}66, 0 0 14px -4px ${themeColors.accent}35`,
              backgroundColor: `${themeColors.accent}14`,
            }
          : undefined
      }
    >
      {/* GPU-driven Background Swipe Action Indicator (no React re-renders during drag) */}
      <div
        ref={bgRef}
        className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none"
        style={{ opacity: 0 }}
      >
        <div
          ref={leftLabelRef}
          className="items-center gap-2 text-white font-black text-xs"
          style={{ display: 'none' }}
        >
          <CornerDownRight className="w-4 h-4" />
          <span>Play Next</span>
        </div>
        <div />
        <div
          ref={rightLabelRef}
          className="items-center gap-2 text-white font-black text-xs"
          style={{ display: 'none' }}
        >
          <span>Add to End of Queue</span>
          <ListPlus className="w-4 h-4" />
        </div>
      </div>

      {/* Foreground Song Row Content */}
      <div
        ref={foregroundRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => finishSwipe(false)}
        onTouchCancel={() => finishSwipe(true)}
        onClickCapture={handleClickCapture}
        onContextMenu={handleContextMenu}
        className="relative z-10 w-full"
      >
        {children}
      </div>

      {/* Fast Non-Blocking Confirmation Flash */}
      {addedMode && (
        <div
          className={`absolute inset-0 z-20 pointer-events-none flex items-center justify-center gap-2 text-white text-xs font-black animate-in fade-in duration-100 ${
            addedMode === 'next' ? 'bg-blue-600/90' : 'bg-emerald-600/90'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{addedMode === 'next' ? 'Playing Next' : 'Added to End of Queue'}</span>
        </div>
      )}
    </div>
  );
});

SwipeableSongRow.displayName = 'SwipeableSongRow';
