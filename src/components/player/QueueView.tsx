import React, { useRef, useEffect, useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { Trash2, Music2, Play, Volume2, LocateFixed, Layers, Plus, Edit2, Check, X, ChevronDown } from 'lucide-react';

export const QueueView: React.FC = () => {
  const {
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    clearQueue,
    themeColors,
    hapticFeedback,
    enableMultipleQueues,
    queues,
    activeQueueId,
    activeQueueName,
    switchQueue,
    createQueue,
    renameQueue,
    deleteQueue,
  } = useMusic();

  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Selector & Delete confirmation state
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editQueueName, setEditQueueName] = useState('');
  const [deletingQueue, setDeletingQueue] = useState<{ id: string; name: string } | null>(null);

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

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    createQueue(newQueueName.trim());
    setNewQueueName('');
    setIsCreating(false);
  };

  const handleSaveRename = (queueId: string) => {
    if (editQueueName.trim()) {
      renameQueue(queueId, editQueueName.trim());
    }
    setEditingQueueId(null);
    setEditQueueName('');
  };

  const totalDuration = queue.reduce((acc, s) => acc + (s.duration || 180), 0);
  const totalMins = Math.floor(totalDuration / 60);

  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col h-full min-h-0 overflow-hidden px-2 sm:px-4 pt-1 pb-1">
      {/* Multiple Queues Selector Header Pill */}
      {enableMultipleQueues && (
        <div className="mb-2 shrink-0">
          <button
            onClick={() => {
              hapticFeedback();
              setIsSelectorOpen(true);
            }}
            className="w-full p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-between transition shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${themeColors.accent}25`, color: themeColors.accent }}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">Active Listening Queue</div>
                <div className="text-xs sm:text-sm font-black text-white truncate group-hover:text-emerald-400 transition">
                  {activeQueueName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold opacity-75">
              <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-mono">
                {queues.length} {queues.length === 1 ? 'queue' : 'queues'}
              </span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

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

      {/* Multiple Queues Manager Modal - Guaranteed top stacking (z-[100]) */}
      {isSelectorOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => {
            setIsSelectorOpen(false);
            setDeletingQueue(null);
          }}
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-5 space-y-4 max-h-[80vh] flex flex-col shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: themeColors.accent }} />
                <h3 className="font-black text-base text-white">Switch Listening Queue</h3>
              </div>
              <button
                onClick={() => {
                  setIsSelectorOpen(false);
                  setDeletingQueue(null);
                }}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-App Delete Confirmation Prompt */}
            {deletingQueue ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3 animate-fadeIn shrink-0">
                <div className="text-sm font-bold text-red-400">Delete Queue "{deletingQueue.name}"?</div>
                <p className="text-xs opacity-75 leading-relaxed">
                  Are you sure you want to delete this listening queue? This action cannot be undone.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => setDeletingQueue(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      hapticFeedback();
                      deleteQueue(deletingQueue.id);
                      setDeletingQueue(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition active:scale-95"
                  >
                    Yes, Delete Queue
                  </button>
                </div>
              </div>
            ) : (
              /* Create Queue Button or Form */
              <div className="shrink-0">
                {!isCreating ? (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-xs flex items-center justify-center gap-2 text-white transition active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Create New Queue (e.g. Workout, Focus)</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateNew} className="flex gap-2">
                    <input
                      type="text"
                      value={newQueueName}
                      onChange={(e) => setNewQueueName(e.target.value)}
                      placeholder="Queue Name (e.g. Late Night Lofi)"
                      autoFocus
                      className="flex-1 bg-black/40 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-2 py-2 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-xs"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1">
              {queues.map((q) => {
                const isActive = q.id === activeQueueId;
                const isEditing = editingQueueId === q.id;
                const trackCount = q.songs ? q.songs.length : 0;

                return (
                  <div
                    key={q.id}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-500/40'
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editQueueName}
                          onChange={(e) => setEditQueueName(e.target.value)}
                          autoFocus
                          className="flex-1 bg-black/40 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          onClick={() => handleSaveRename(q.id)}
                          className="p-1.5 rounded-lg bg-emerald-500 text-black font-bold"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          switchQueue(q.id);
                          setIsSelectorOpen(false);
                        }}
                        className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
                      >
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            isActive ? 'bg-emerald-400 animate-pulse shadow-md' : 'bg-white/20'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className={`text-xs sm:text-sm font-bold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                            {q.name}
                          </div>
                          <div className="text-[10px] opacity-50 font-mono">
                            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                          </div>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingQueueId(q.id);
                            setEditQueueName(q.name);
                          }}
                          className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:bg-white/10 text-white transition"
                          title="Rename queue"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {q.id !== 'queue-main' && (
                          <button
                            onClick={() => {
                              hapticFeedback();
                              setDeletingQueue({ id: q.id, name: q.name });
                            }}
                            className="p-1.5 rounded-lg opacity-40 hover:opacity-100 hover:bg-red-500/20 text-red-400 transition"
                            title="Delete queue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

