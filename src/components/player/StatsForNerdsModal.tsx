import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { X, Info, Activity, Radio, Cpu, BarChart2 } from 'lucide-react';

export const StatsForNerdsModal: React.FC = () => {
  const { isSongInfoOpen, setIsSongInfoOpen, currentSong, themeColors } = useMusic();

  if (!isSongInfoOpen || !currentSong) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col font-mono text-xs border border-white/10"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 font-sans">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5" style={{ color: themeColors.accent }} />
            <h2 className="text-base font-bold">Stats for Nerds</h2>
          </div>
          <button
            onClick={() => setIsSongInfoOpen(false)}
            className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5" /> Track ID:</span>
            <span className="font-semibold text-white truncate max-w-[180px]">{currentSong.id}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Source / Engine:</span>
            <span className="font-semibold uppercase text-emerald-400">{currentSong.source}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Audio Stream:</span>
            <span>Opus / 160 kbps (YouTube High)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60 flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> Sample Rate:</span>
            <span>48,000 Hz Stereo</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60">Loudness Target:</span>
            <span>-14.0 LUFS (Normalized)</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60">Genre & Year:</span>
            <span>{currentSong.genre || 'General'} • {currentSong.year || '2024'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 flex justify-between items-center">
            <span className="opacity-60">Play Count:</span>
            <span style={{ color: themeColors.accent }}>{currentSong.playCount || 1} plays</span>
          </div>
        </div>

        <div className="mt-5 text-[10px] text-center opacity-40 font-sans">
          Muzika Media Engine • RiPlay Architecture Port
        </div>
      </div>
    </div>
  );
};
