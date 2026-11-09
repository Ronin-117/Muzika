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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
      {/* Queue Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4" style={{ color: themeColors.accent }} />
          <span className="text-sm font-bold">Playback Queue ({queue.length})</span>
        </div>
        {queue.length > 1 && (
          <button
            onClick={clearQueue}
            className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto mt-2 space-y-2 no-scrollbar pb-6">
        {queue.map((song, idx) => {
          const isCurrent = idx === queueIndex;
          return (
            <div
              key={`${song.id}-${idx}`}
              onClick={() => {
                hapticFeedback();
                playSong(song);
              }}
              className={`flex items-center justify-between p-2.5 rounded-2xl transition cursor-pointer ${
                isCurrent
                  ? 'bg-white/10 shadow-md border border-white/10'
                  : 'hover:bg-white/5 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0">
                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                  {isCurrent && (
                    <div
                      className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                      style={{ color: themeColors.accent }}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm truncate leading-tight ${
                      isCurrent ? 'font-bold' : 'font-medium'
                    }`}
                    style={{ color: isCurrent ? themeColors.accent : undefined }}
                  >
                    {song.title}
                  </div>
                  <div className="text-xs opacity-60 truncate mt-0.5">{song.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {queue.length > 1 && (
                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:text-red-400 transition"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="p-1.5 opacity-30 cursor-grab">
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
