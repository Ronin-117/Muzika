import React, { useEffect, useRef } from 'react';
import { useMusic, usePlaybackTime } from '../../context/MusicContext';
import { Mic2, Loader2, Music, ExternalLink } from 'lucide-react';

export const LyricsView: React.FC = () => {
  const { currentLyrics, isLoadingLyrics, seekTo, themeColors, hapticFeedback } = useMusic();
  const { currentTime } = usePlaybackTime();
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Find active synchronized line based on currentTime
  const activeIndex = React.useMemo(() => {
    if (!currentLyrics?.syncedLyrics || currentLyrics.syncedLyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < currentLyrics.syncedLyrics.length; i++) {
      if (currentLyrics.syncedLyrics[i].time <= currentTime + 0.25) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [currentLyrics?.syncedLyrics, currentTime]);

  // Smooth scroll active line into view
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (isLoadingLyrics) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: themeColors.accent }} />
        <p className="text-sm opacity-60">Fetching synchronized lyrics from LRCLIB...</p>
      </div>
    );
  }

  if (currentLyrics?.instrumental) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Music className="w-12 h-12 mb-3 opacity-40" />
        <h3 className="text-lg font-bold">Instrumental Track</h3>
        <p className="text-xs opacity-60 mt-1">This song does not contain vocal lyrics.</p>
      </div>
    );
  }

  if (!currentLyrics || (!currentLyrics.syncedLyrics && !currentLyrics.plainLyrics)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <Mic2 className="w-10 h-10 mb-3 opacity-30" />
        <h3 className="text-base font-bold">No lyrics available</h3>
        <p className="text-xs opacity-50 mt-1">We couldn&apos;t find synchronized lyrics for this track on LRCLIB.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Scrollable lyrics container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-12 space-y-6 text-center select-none no-scrollbar"
      >
        {currentLyrics.syncedLyrics && currentLyrics.syncedLyrics.length > 0 ? (
          currentLyrics.syncedLyrics.map((line, index) => {
            const isActive = index === activeIndex;
            const isPast = index < activeIndex;

            return (
              <div
                key={`${line.time}-${index}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  hapticFeedback();
                  seekTo(line.time);
                }}
                className={`cursor-pointer transition-all duration-300 py-1.5 px-3 rounded-xl ${
                  isActive
                    ? 'text-xl sm:text-2xl font-black scale-105 opacity-100'
                    : isPast
                    ? 'text-base sm:text-lg font-medium opacity-40 hover:opacity-70'
                    : 'text-base sm:text-lg font-medium opacity-30 hover:opacity-60'
                }`}
                style={{
                  color: isActive ? themeColors.accent : undefined,
                  textShadow: isActive ? `0 0 20px ${themeColors.accent}66` : undefined,
                }}
              >
                {line.text || '♪'}
              </div>
            );
          })
        ) : (
          <div className="text-sm sm:text-base leading-relaxed opacity-75 whitespace-pre-line font-medium">
            {currentLyrics.plainLyrics}
          </div>
        )}
      </div>

      {/* LRCLIB Footer attribution */}
      <div className="p-2 border-t border-white/5 text-[10px] opacity-40 text-center flex items-center justify-center gap-1">
        <span>Synced via LRCLIB Open Lyrics API</span>
        <ExternalLink className="w-2.5 h-2.5" />
      </div>
    </div>
  );
};
