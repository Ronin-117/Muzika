import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { Trash2, Music2, GripVertical, Play } from 'lucide-react';

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

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden px-4 pt-2 pb-2">
      {/* Queue Header */}
      <div className="flex items-center justify-between pb-3 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 shrink-0" style={{ color: themeColors.accent }} />
          <span className="text-sm font-bold truncate">Playback Queue ({queue.length})</span>
        </div>
        {queue.length > 1 && (
          <button
            onClick={clearQueue}
            className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1 font-semibold px-2 py-1 rounded-lg hover:bg-white/5 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 no-scrollbar pb-32 max-h-full">
        {queue.map((song, idx) => {
          const isCurrent = idx === queueIndex;
          return (
            <div
              key={`${song.id}-${idx}`}
              onClick={() => {
                hapticFeedback();
                playSong(song);
              }}
              className={`flex items-center justify-between p-2.5 rounded-2xl shrink-0 transition cursor-pointer active:scale-[0.99] ${
                isCurrent
                  ? 'bg-white/12 shadow-lg border border-white/15'
                  : 'hover:bg-white/5 bg-white/[0.02] opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md">
                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                  {isCurrent && (
                    <div
                      className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center text-white"
                      style={{ color: themeColors.accent }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 pr-2">
                  <div
                    className={`text-sm truncate leading-tight ${
                      isCurrent ? 'font-bold' : 'font-semibold'
                    }`}
                    style={{ color: isCurrent ? themeColors.accent : undefined }}
                  >
                    {song.title}
                  </div>
                  <div className="text-xs opacity-60 truncate mt-1 font-medium">{song.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {queue.length > 1 && (
                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="p-2 rounded-xl opacity-40 hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition active:scale-95"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="p-2 opacity-30 cursor-grab">
                  <GripVertical className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
