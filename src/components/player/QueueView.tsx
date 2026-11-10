import React, { useRef, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { Trash2, Music2, Play, Volume2, LocateFixed } from 'lucide-react';

export const QueueView: React.FC = () => {
  const {
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    clearQueue,
    themeColors,
    hapticFeedback,
  } = useMusic();

  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Automatically scroll currently playing song into view
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeItemRef.current) {
        activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [queueIndex]);

  const handleScrollToCurrent = () => {
    hapticFeedback();
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const totalDuration = queue.reduce((acc, s) => acc + (s.duration || 180), 0);
  const totalMins = Math.floor(totalDuration / 60);

  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col h-full min-h-0 overflow-hidden px-2 sm:px-4 pt-1 pb-1">
      {/* Queue Header */}
      <div className="flex items-center justify-between pb-2 shrink-0 border-b border-white/10 px-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Music2 className="w-4 h-4 shrink-0" style={{ color: themeColors.accent }} />
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-bold truncate block">
              Queue ({queue.length} {queue.length === 1 ? 'track' : 'tracks'})
            </span>
            <span className="text-[10px] opacity-50 block font-medium">
              {totalMins > 0 ? `${totalMins} min total` : ''} • Currently #{queueIndex + 1}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleScrollToCurrent}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
            title="Scroll to currently playing track"
          >
            <LocateFixed className="w-3.5 h-3.5" />
          </button>

          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="text-[11px] text-red-400 hover:text-red-300 transition flex items-center gap-1 font-semibold px-2 py-1 rounded-xl bg-white/5 hover:bg-red-500/10 active:scale-95 border border-white/5"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Queue List - Optimized for mobile viewport */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto mt-2 space-y-1.5 no-scrollbar pb-6 overscroll-contain"
      >
        {queue.map((song, idx) => {
          const isCurrent = idx === queueIndex;
          return (
            <div
              key={`${song.id}-${idx}`}
              ref={isCurrent ? activeItemRef : null}
              onClick={() => {
                hapticFeedback();
                playSong(song);
              }}
              className={`flex items-center justify-between p-2 rounded-2xl transition cursor-pointer active:scale-[0.99] w-full border ${
                isCurrent
                  ? 'bg-white/15 shadow-lg border-white/25'
                  : 'hover:bg-white/10 bg-white/[0.03] opacity-80 hover:opacity-100 border-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Track Number / Playing Icon */}
                <div className="w-5 text-center shrink-0 flex items-center justify-center">
                  {isCurrent ? (
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" style={{ color: themeColors.accent }} />
                  ) : (
                    <span className="text-[10px] font-mono opacity-40 font-semibold">{idx + 1}</span>
                  )}
                </div>

                {/* Cover Art */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md">
                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                  {isCurrent && (
                    <div
                      className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center"
                      style={{ color: themeColors.accent }}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                  )}
                </div>

                {/* Track Details */}
                <div className="min-w-0 flex-1 pr-1">
                  <div
                    className={`text-xs sm:text-sm truncate leading-tight ${
                      isCurrent ? 'font-black' : 'font-semibold'
                    }`}
                    style={{ color: isCurrent ? themeColors.accent : undefined }}
                  >
                    {song.title}
                  </div>
                  <div className="text-[10px] sm:text-[11px] opacity-60 truncate mt-0.5 font-medium">
                    {song.artist}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] font-mono opacity-40 min-w-[28px] text-right">
                  {Math.floor((song.duration || 180) / 60)}:
                  {((song.duration || 180) % 60).toString().padStart(2, '0')}
                </span>

                {queue.length > 1 && (
                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition active:scale-95"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
