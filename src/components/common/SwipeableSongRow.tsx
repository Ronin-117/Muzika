import React, { useState, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { ListPlus, CornerDownRight, Check } from 'lucide-react';
import { Song } from '../../types/music';

interface SwipeableSongRowProps {
  song: Song;
  children: React.ReactNode;
  onSwipeAdd?: (song: Song, mode: 'next' | 'end') => void;
  className?: string;
  disabled?: boolean;
}

export const SwipeableSongRow: React.FC<SwipeableSongRowProps> = ({
  song,
  children,
  onSwipeAdd,
  className = '',
  disabled = false,
}) => {
  const { addToQueue, playNextInQueue, setSongOptionsMenuTarget, hapticFeedback } = useMusic();
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [addedMode, setAddedMode] = useState<'next' | 'end' | null>(null);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = null;
    isLongPressRef.current = false;
    setIsSwiping(true);

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      hapticFeedback();
      setSongOptionsMenuTarget({ song });
      setIsSwiping(false);
      setTranslateX(0);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isSwiping) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startXRef.current;
    const deltaY = currentY - startYRef.current;

    // Cancel long press if finger moved significantly
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearLongPressTimer();
    }

    // Determine swipe axis on first movement
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // Only handle horizontal swipe
    if (isHorizontalSwipeRef.current) {
      const maxOffset = 110;
      const clampedX = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
      setTranslateX(clampedX);
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    if (disabled || !isSwiping || isLongPressRef.current) {
      setIsSwiping(false);
      return;
    }
    setIsSwiping(false);

    const threshold = 65; // minimum swipe distance
    if (Math.abs(translateX) >= threshold) {
      hapticFeedback();
      const mode: 'next' | 'end' = translateX > 0 ? 'next' : 'end';

      if (onSwipeAdd) {
        onSwipeAdd(song, mode);
      } else {
        if (mode === 'next') {
          playNextInQueue(song);
        } else {
          addToQueue(song);
        }
      }

      setAddedMode(mode);
      setTimeout(() => setAddedMode(null), 1300);
    }

    setTranslateX(0);
    isHorizontalSwipeRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    hapticFeedback();
    setSongOptionsMenuTarget({ song });
  };

  const isRightSwipe = translateX > 0;
  const opacityRatio = Math.min(1, Math.abs(translateX) / 70);

  return (
    <div className={`relative overflow-hidden rounded-2xl select-none touch-pan-y ${className}`}>
      {/* Background Swipe Action Indicator */}
      <div
        className={`absolute inset-0 flex items-center justify-between px-4 transition-colors duration-150 ${
          isRightSwipe
            ? Math.abs(translateX) >= 65
              ? 'bg-blue-600'
              : 'bg-blue-600/70'
            : Math.abs(translateX) >= 65
            ? 'bg-emerald-600'
            : 'bg-emerald-600/70'
        }`}
        style={{ opacity: opacityRatio }}
      >
        {/* Swipe Right Action: Play Next */}
        {isRightSwipe && (
          <div className="flex items-center gap-2 text-white font-black text-xs">
            <CornerDownRight className="w-4 h-4 animate-bounce" />
            <span>Play Next</span>
          </div>
        )}
        <div />
        {/* Swipe Left Action: Add to End */}
        {!isRightSwipe && (
          <div className="flex items-center gap-2 text-white font-black text-xs">
            <span>Add to End of Queue</span>
            <ListPlus className="w-4 h-4 animate-bounce" />
          </div>
        )}
      </div>

      {/* Foreground Song Row Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={handleContextMenu}
        className={`relative z-10 w-full transition-transform ${
          isSwiping ? 'transition-none' : 'duration-200 ease-out'
        }`}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>

      {/* Quick Toast Flash */}
      {addedMode && (
        <div
          className={`absolute inset-0 z-20 backdrop-blur-sm flex items-center justify-center gap-2 text-white text-xs font-black animate-in fade-in zoom-in-95 duration-150 ${
            addedMode === 'next' ? 'bg-blue-600/90' : 'bg-emerald-600/90'
          }`}
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{addedMode === 'next' ? 'Playing Next' : 'Added to End of Queue'}</span>
        </div>
      )}
    </div>
  );
};
