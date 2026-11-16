import React, { useState } from 'react';
import { useMusic, usePlaybackTime } from '../../context/MusicContext';
import { Moon, X, Clock, PlayCircle } from 'lucide-react';

export const SleepTimerSheet: React.FC = () => {
  const {
    isSleepTimerOpen,
    setIsSleepTimerOpen,
    sleepTimerSeconds,
    setSleepTimer,
    cancelSleepTimer,
    themeColors,
    hapticFeedback,
  } = useMusic();
  const { duration, currentTime } = usePlaybackTime();

  const [customMinutes, setCustomMinutes] = useState(25);

  if (!isSleepTimerOpen) return null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSetTimer = (mins: number) => {
    hapticFeedback();
    setSleepTimer(mins);
    setIsSleepTimerOpen(false);
  };

  const handleEndOfTrack = () => {
    hapticFeedback();
    const remaining = Math.max(1, Math.ceil((duration - currentTime) / 60));
    setSleepTimer(remaining);
    setIsSleepTimerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Moon className="w-5 h-5" style={{ color: themeColors.accent }} />
            <h2 className="text-lg font-bold">Sleep Timer</h2>
          </div>
          <button
            onClick={() => setIsSleepTimerOpen(false)}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Countdown */}
        {sleepTimerSeconds !== null && (
          <div className="mt-4 p-4 rounded-2xl bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 animate-pulse" style={{ color: themeColors.accent }} />
              <div>
                <div className="text-xs opacity-60">Music stops in</div>
                <div className="text-xl font-mono font-bold">{formatCountdown(sleepTimerSeconds)}</div>
              </div>
            </div>
            <button
              onClick={cancelSleepTimer}
              className="text-xs px-3 py-1.5 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Options */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              onClick={() => handleSetTimer(mins)}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 transition flex items-center justify-between font-medium text-sm"
            >
              <span>{mins} minutes</span>
              <Clock className="w-4 h-4 opacity-40" />
            </button>
          ))}
        </div>

        {/* End of Track option */}
        <button
          onClick={handleEndOfTrack}
          className="mt-2.5 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 transition flex items-center justify-between font-medium text-sm"
        >
          <span className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4" style={{ color: themeColors.accent }} />
            End of this track
          </span>
          <span className="text-xs opacity-50">~{Math.max(1, Math.ceil((duration - currentTime) / 60))} min</span>
        </button>

        {/* Custom Input */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="300"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-20 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center font-mono text-sm"
          />
          <span className="text-xs opacity-60">min</span>
          <button
            onClick={() => handleSetTimer(customMinutes)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition shadow-md"
            style={{ backgroundColor: themeColors.accent }}
          >
            Set Custom Timer
          </button>
        </div>
      </div>
    </div>
  );
};
