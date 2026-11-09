import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { Sliders, Moon, Smartphone, Search, Music } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const Header: React.FC = () => {
  const {
    themeColors,
    setIsEqualizerOpen,
    sleepTimerSeconds,
    setIsSleepTimerOpen,
    setIsPWAInstallModalOpen,
    setActiveTab,
    hapticFeedback,
  } = useMusic();
  const { isInstalled } = usePWAInstall();

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <header
      className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-md transition-colors"
      style={{ backgroundColor: `${themeColors.background0}dd`, color: themeColors.text }}
    >
      {/* Brand */}
      <div
        onClick={() => {
          hapticFeedback();
          setActiveTab('home');
        }}
        className="flex items-center gap-2.5 cursor-pointer select-none group"
      >
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md transition transform group-hover:scale-105"
          style={{ backgroundColor: themeColors.accent }}
        >
          <Music className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-xl tracking-tight text-white">Muzika</span>
          </div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search icon shortcut */}
        <button
          onClick={() => {
            hapticFeedback();
            setActiveTab('search');
          }}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
          title="Search Songs & Artists"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Android PWA Install button */}
        {!isInstalled && (
          <button
            onClick={() => {
              hapticFeedback();
              setIsPWAInstallModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/90 transition border border-white/10"
            title="Install as Android App"
          >
            <Smartphone className="w-3.5 h-3.5" style={{ color: themeColors.accent }} />
            <span className="hidden xs:inline">App</span>
          </button>
        )}

        {/* Sleep Timer Indicator */}
        {sleepTimerSeconds !== null && (
          <button
            onClick={() => {
              hapticFeedback();
              setIsSleepTimerOpen(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/10 text-xs font-mono font-bold text-amber-400 animate-pulse"
          >
            <Moon className="w-3 h-3" />
            <span>{formatCountdown(sleepTimerSeconds)}</span>
          </button>
        )}

        {/* Equalizer */}
        <button
          onClick={() => {
            hapticFeedback();
            setIsEqualizerOpen(true);
          }}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
          title="Audio Equalizer"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
