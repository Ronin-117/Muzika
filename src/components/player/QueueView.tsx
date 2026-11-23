import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMusic, useBackHandler, isQueueScheduleActive } from '../../context/MusicContext';
import { QueueSchedule } from '../../types/music';
import { Trash2, Music2, LocateFixed, Layers, Plus, Edit2, Check, X, ChevronDown, MoreVertical, Clock, ArrowLeft, Star } from 'lucide-react';
import { PlayingBars } from '../common/PlayingBars';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatScheduleSummary = (schedules?: QueueSchedule[]): string | null => {
  if (!schedules || schedules.length === 0) return null;
  const enabled = schedules.filter((s) => s.enabled !== false);
  if (enabled.length === 0) return null;
  const first = enabled[0];
  const dayTag =
    !first.days || first.days.length === 0 || first.days.length === 7
      ? ''
      : first.days.length === 5 && [1, 2, 3, 4, 5].every((d) => first.days!.includes(d))
      ? ' • Weekdays'
      : first.days.length === 2 && first.days.includes(0) && first.days.includes(6)
      ? ' • Weekends'
      : ` • ${first.days.map((d) => DAY_SHORT[d]).join(', ')}`;
  const extra = enabled.length > 1 ? ` +${enabled.length - 1} more` : '';
  return `${first.startTime}–${first.endTime}${dayTag}${extra}`;
};

export const QueueView: React.FC = () => {
  const {
    queue,
    queueIndex,
    isPlaying,
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
    updateQueueSchedules,
    toggleDefaultQueue,
    getSongCoverUrl,
    setSongOptionsMenuTarget,
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
  const [schedulingQueueId, setSchedulingQueueId] = useState<string | null>(null);

  useBackHandler(isSelectorOpen, () => {
    setIsSelectorOpen(false);
    setDeletingQueue(null);
    setIsCreating(false);
    setSchedulingQueueId(null);
  });
  useBackHandler(!!deletingQueue, () => setDeletingQueue(null));
  useBackHandler(!!schedulingQueueId, () => setSchedulingQueueId(null));

  const schedulingQueue = schedulingQueueId ? queues.find((q) => q.id === schedulingQueueId) || null : null;

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

  const handleAddSchedule = (queueId: string) => {
    const target = queues.find((q) => q.id === queueId);
    const existing = target?.schedules || [];
    const nextSchedule: QueueSchedule = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startTime: '08:00',
      endTime: '10:00',
      enabled: true,
    };
    updateQueueSchedules(queueId, [...existing, nextSchedule]);
  };

  const handleUpdateScheduleItem = (
    queueId: string,
    scheduleId: string,
    patch: Partial<QueueSchedule>
  ) => {
    const target = queues.find((q) => q.id === queueId);
    if (!target) return;
    const next = (target.schedules || []).map((s) =>
      s.id === scheduleId ? { ...s, ...patch } : s
    );
    updateQueueSchedules(queueId, next);
  };

  const handleToggleScheduleDay = (queueId: string, scheduleId: string, dayIdx: number) => {
    const target = queues.find((q) => q.id === queueId);
    const sched = target?.schedules?.find((s) => s.id === scheduleId);
    if (!sched) return;
    const currentDays = sched.days || [];
    let nextDays: number[];
    if (currentDays.includes(dayIdx)) {
      nextDays = currentDays.filter((d) => d !== dayIdx);
    } else {
      nextDays = [...currentDays, dayIdx].sort((a, b) => a - b);
    }
    // Selecting all 7 days normalizes back to "Every Day" (empty array)
    handleUpdateScheduleItem(queueId, scheduleId, {
      days: nextDays.length === 7 ? [] : nextDays,
    });
  };

  const handleDeleteScheduleItem = (queueId: string, scheduleId: string) => {
    const target = queues.find((q) => q.id === queueId);
    if (!target) return;
    const next = (target.schedules || []).filter((s) => s.id !== scheduleId);
    updateQueueSchedules(queueId, next);
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
              style={
                isCurrent
                  ? {
                      boxShadow: `inset 0 0 0 1px ${themeColors.accent}77`,
                      backgroundColor: `${themeColors.accent}18`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Track Number / Playing Icon */}
                <div className="w-5 text-center shrink-0 flex items-center justify-center">
                  {isCurrent ? (
                    <PlayingBars accentColor={themeColors.accent} isPlaying={isPlaying} size="sm" />
                  ) : (
                    <span className="text-[10px] font-mono opacity-40 font-semibold">{idx + 1}</span>
                  )}
                </div>

                {/* Cover Art */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md">
                  <img src={getSongCoverUrl(song)} alt={song.title} className="w-full h-full object-cover" />
                  {isCurrent && (
                    <div
                      className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center"
                      style={{ color: themeColors.accent }}
                    >
                      <PlayingBars accentColor={themeColors.accent} isPlaying={isPlaying} size="md" />
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

                <button
                  onClick={() => {
                    hapticFeedback();
                    setSongOptionsMenuTarget({ song });
                  }}
                  className="p-1 rounded-lg opacity-40 hover:opacity-100 hover:bg-white/10 text-white transition active:scale-95"
                  title="Song options & Add to Playlist"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

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

      {/* Multiple Queues Manager Modal - Portaled to document.body above FullScreenPlayer (z-[120]) */}
      {isSelectorOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
            onClick={() => {
              setIsSelectorOpen(false);
              setDeletingQueue(null);
              setSchedulingQueueId(null);
            }}
          >
            <div
              className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-4 sm:p-5 space-y-3.5 max-h-[84dvh] flex flex-col shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
            {schedulingQueue ? (
              /* Queue Timing Schedules Editor */
              <>
                <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => {
                        hapticFeedback();
                        setSchedulingQueueId(null);
                      }}
                      className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition shrink-0"
                      title="Back to queues"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <h3 className="font-black text-sm sm:text-base text-white truncate">
                        Schedules: {schedulingQueue.name}
                      </h3>
                      <p className="text-[10px] opacity-50">Startup auto-switch timing rules</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsSelectorOpen(false);
                      setSchedulingQueueId(null);
                    }}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-[11px] text-white/70 leading-relaxed shrink-0">
                  Muzika checks these windows <span className="text-white font-semibold">once when opened</span> and switches to this queue automatically if matched. You can still change queues manually anytime.
                </div>

                {/* Default Queue Toggle (Used when no schedule is active) */}
                <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Star
                        className={`w-3.5 h-3.5 shrink-0 ${
                          schedulingQueue.isDefault ? 'text-amber-400 fill-amber-400' : 'text-white/50'
                        }`}
                      />
                      <span>Default Queue (No Schedule)</span>
                    </div>
                    <p className="text-[10px] text-white/55 leading-snug mt-0.5">
                      Selected on startup when no schedule matches. Multiple defaults rotate; if none are set, your last queue stays selected.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDefaultQueue(schedulingQueue.id)}
                    className={`w-10 h-5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shrink-0 ${
                      schedulingQueue.isDefault ? 'bg-amber-400' : 'bg-white/15'
                    }`}
                    title={schedulingQueue.isDefault ? 'Remove default status' : 'Set as default queue'}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        schedulingQueue.isDefault ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
                  {(!schedulingQueue.schedules || schedulingQueue.schedules.length === 0) ? (
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 text-center space-y-2">
                      <Clock className="w-6 h-6 mx-auto opacity-40" />
                      <div className="text-xs font-semibold text-white/75">No timing schedules yet</div>
                      <p className="text-[11px] opacity-50">
                        Add one or multiple time windows to auto-select &ldquo;{schedulingQueue.name}&rdquo; on app startup.
                      </p>
                    </div>
                  ) : (
                    schedulingQueue.schedules.map((sched, sIdx) => {
                      const isEnabled = sched.enabled !== false;
                      const isOvernight = sched.endTime < sched.startTime;
                      const isActiveNow = isQueueScheduleActive(sched);
                      const selectedDays = sched.days || [];
                      const isEveryDay = selectedDays.length === 0;
                      const isWeekdays =
                        selectedDays.length === 5 && [1, 2, 3, 4, 5].every((d) => selectedDays.includes(d));
                      const isWeekends =
                        selectedDays.length === 2 && selectedDays.includes(0) && selectedDays.includes(6);

                      return (
                        <div
                          key={sched.id}
                          className={`p-3.5 rounded-2xl border space-y-3 transition ${
                            isEnabled
                              ? 'bg-white/[0.06] border-white/15'
                              : 'bg-white/[0.02] border-white/5 opacity-60'
                          }`}
                        >
                          {/* Rule header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-white">Schedule #{sIdx + 1}</span>
                              {isActiveNow && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-black"
                                  style={{ backgroundColor: themeColors.accent }}
                                >
                                  Active Now
                                </span>
                              )}
                              {isOvernight && (
                                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-semibold">
                                  Overnight
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduleItem(schedulingQueue.id, sched.id, {
                                    enabled: !isEnabled,
                                  })
                                }
                                className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                                  isEnabled ? 'bg-emerald-500' : 'bg-white/15'
                                }`}
                                title={isEnabled ? 'Disable schedule' : 'Enable schedule'}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteScheduleItem(schedulingQueue.id, sched.id)}
                                className="p-1 rounded-lg opacity-50 hover:opacity-100 hover:bg-red-500/20 text-red-400 transition"
                                title="Remove schedule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Time inputs */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <label className="space-y-1 block">
                              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-55 block">
                                Start Time
                              </span>
                              <input
                                type="time"
                                value={sched.startTime}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateScheduleItem(schedulingQueue.id, sched.id, {
                                      startTime: e.target.value,
                                    });
                                  }
                                }}
                                className="w-full bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white [color-scheme:dark] focus:outline-none focus:border-emerald-400"
                              />
                            </label>
                            <label className="space-y-1 block">
                              <span className="text-[10px] font-semibold uppercase tracking-wider opacity-55 block">
                                End Time
                              </span>
                              <input
                                type="time"
                                value={sched.endTime}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateScheduleItem(schedulingQueue.id, sched.id, {
                                      endTime: e.target.value,
                                    });
                                  }
                                }}
                                className="w-full bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white [color-scheme:dark] focus:outline-none focus:border-emerald-400"
                              />
                            </label>
                          </div>

                          {/* Day presets + day selector */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduleItem(schedulingQueue.id, sched.id, { days: [] })
                                }
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  isEveryDay
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                                }`}
                              >
                                Every Day
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduleItem(schedulingQueue.id, sched.id, {
                                    days: [1, 2, 3, 4, 5],
                                  })
                                }
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  isWeekdays
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                                }`}
                              >
                                Weekdays
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateScheduleItem(schedulingQueue.id, sched.id, {
                                    days: [0, 6],
                                  })
                                }
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${
                                  isWeekends
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                                }`}
                              >
                                Weekends
                              </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                              {DAY_LABELS.map((label, dIdx) => {
                                const daySelected = !isEveryDay && selectedDays.includes(dIdx);
                                return (
                                  <button
                                    key={`${sched.id}-day-${dIdx}`}
                                    type="button"
                                    onClick={() =>
                                      handleToggleScheduleDay(schedulingQueue.id, sched.id, dIdx)
                                    }
                                    className={`py-1.5 rounded-lg text-[10px] font-bold transition ${
                                      daySelected
                                        ? 'bg-emerald-500 text-black shadow-sm'
                                        : 'bg-white/5 text-white/60 hover:bg-white/15'
                                    }`}
                                    title={DAY_SHORT[dIdx]}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAddSchedule(schedulingQueue.id)}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Schedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback();
                      setSchedulingQueueId(null);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              /* Queue List Selector */
              <>
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
                    const schedSummary = formatScheduleSummary(q.schedules);

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
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs sm:text-sm font-bold truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                                  {q.name}
                                </span>
                                {q.isDefault && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-white/50">{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</span>
                                {schedSummary && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-300/90 font-sans font-semibold">
                                    <Clock className="w-2.5 h-2.5" />
                                    {schedSummary}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => toggleDefaultQueue(q.id)}
                              className={`p-1.5 rounded-lg transition ${
                                q.isDefault
                                  ? 'text-amber-400 bg-amber-400/15 hover:bg-amber-400/25'
                                  : 'opacity-45 hover:opacity-100 hover:bg-white/10 text-white'
                              }`}
                              title={q.isDefault ? 'Default queue (tap to unset)' : 'Set as default queue outside schedules'}
                            >
                              <Star className={`w-3.5 h-3.5 ${q.isDefault ? 'fill-amber-400' : ''}`} />
                            </button>

                            <button
                              onClick={() => {
                                hapticFeedback();
                                setSchedulingQueueId(q.id);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                schedSummary
                                  ? 'text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25'
                                  : 'opacity-50 hover:opacity-100 hover:bg-white/10 text-white'
                              }`}
                              title="Timing schedules"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>

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
              </>
            )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

