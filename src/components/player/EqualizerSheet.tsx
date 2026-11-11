import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { X, Sliders, RotateCcw, Volume2, Check, Zap, Activity, ShieldCheck } from 'lucide-react';
import { EqualizerBands } from '../../types/music';

const PRESETS: Record<string, EqualizerBands & { bassBoost?: number; preamp?: number }> = {
  Flat: { band60: 0, band230: 0, band910: 0, band3600: 0, band14000: 0, bassBoost: 0, preamp: 0 },
  'Bass Boost': { band60: 9, band230: 6, band910: 1, band3600: 0, band14000: -2, bassBoost: 75, preamp: -2 },
  'Heavy Bass': { band60: 12, band230: 8, band910: 2, band3600: -1, band14000: -4, bassBoost: 100, preamp: -3 },
  Pop: { band60: -1, band230: 2, band910: 5, band3600: 4, band14000: 2, bassBoost: 20, preamp: 0 },
  Rock: { band60: 6, band230: 4, band910: -1, band3600: 4, band14000: 7, bassBoost: 40, preamp: -1 },
  Electronic: { band60: 7, band230: 5, band910: 0, band3600: 3, band14000: 6, bassBoost: 60, preamp: -1 },
  Vocal: { band60: -4, band230: -1, band910: 7, band3600: 6, band14000: 2, bassBoost: 10, preamp: 0 },
  Acoustic: { band60: 4, band230: 3, band910: 3, band3600: 5, band14000: 5, bassBoost: 25, preamp: 0 },
  Treble: { band60: -4, band230: -2, band910: 1, band3600: 6, band14000: 10, bassBoost: 0, preamp: 0 },
  Audiophile: { band60: 2, band230: 1, band910: 0, band3600: 2, band14000: 3, bassBoost: 15, preamp: 0 },
};

const BANDS_CONFIG: { key: keyof EqualizerBands; label: string; sub: string }[] = [
  { key: 'band60', label: '60 Hz', sub: 'Sub-Bass' },
  { key: 'band230', label: '230 Hz', sub: 'Bass/Mid' },
  { key: 'band910', label: '910 Hz', sub: 'Midrange' },
  { key: 'band3600', label: '3.6 kHz', sub: 'Presence' },
  { key: 'band14000', label: '14 kHz', sub: 'Treble' },
];

export const EqualizerSheet: React.FC = () => {
  const { isEqualizerOpen, setIsEqualizerOpen, equalizerSettings, setEqualizerSettings, themeColors, hapticFeedback } =
    useMusic();

  if (!isEqualizerOpen) return null;

  const handleBandChange = (bandKey: keyof EqualizerBands, value: number) => {
    setEqualizerSettings({
      ...equalizerSettings,
      preset: 'Custom',
      bands: {
        ...equalizerSettings.bands,
        [bandKey]: value,
      },
    });
  };

  const handleApplyPreset = (presetName: string) => {
    hapticFeedback();
    const presetObj = PRESETS[presetName] || PRESETS.Flat;
    setEqualizerSettings({
      ...equalizerSettings,
      preset: presetName,
      bands: {
        band60: presetObj.band60,
        band230: presetObj.band230,
        band910: presetObj.band910,
        band3600: presetObj.band3600,
        band14000: presetObj.band14000,
      },
      bassBoost: presetObj.bassBoost !== undefined ? presetObj.bassBoost : equalizerSettings.bassBoost,
      preamp: presetObj.preamp !== undefined ? presetObj.preamp : (equalizerSettings.preamp || 0),
    });
  };

  const handleToggle = () => {
    hapticFeedback();
    setEqualizerSettings({
      ...equalizerSettings,
      enabled: !equalizerSettings.enabled,
    });
  };

  const handleBassBoostChange = (val: number) => {
    setEqualizerSettings({
      ...equalizerSettings,
      bassBoost: val,
    });
  };

  const handlePreampChange = (val: number) => {
    setEqualizerSettings({
      ...equalizerSettings,
      preamp: val,
    });
  };

  const resetFlat = () => {
    hapticFeedback();
    handleApplyPreset('Flat');
  };

  // Generate SVG Frequency Curve Points
  const getSvgPathPoints = () => {
    const width = 320;
    const height = 60;
    const midY = height / 2;
    const bands = BANDS_CONFIG.map((b) => equalizerSettings.bands[b.key] || 0);

    // Map -12dB to +12dB -> Y coordinates
    const points = bands.map((db, i) => {
      const x = (i / (bands.length - 1)) * (width - 40) + 20;
      const y = midY - (db / 12) * (height / 2 - 8);
      return { x, y };
    });

    // Smooth Bezier Curve
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return { path, points };
  };

  const { path: curvePath, points: curvePoints } = getSvgPathPoints();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={() => setIsEqualizerOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto space-y-5 my-auto border border-white/10"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">Pro Audio Equalizer</h2>
              <span className="text-[10px] font-mono opacity-50 block">Web Audio DSP DSP Engine • 5-Band Parametric</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition flex items-center gap-1.5 shadow-md ${
                equalizerSettings.enabled ? 'text-white' : 'bg-white/10 text-white/50'
              }`}
              style={{
                backgroundColor: equalizerSettings.enabled ? themeColors.accent : undefined,
              }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{equalizerSettings.enabled ? 'EQ ACTIVE' : 'EQ BYPASS'}</span>
            </button>
            <button
              onClick={() => setIsEqualizerOpen(false)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-Time Frequency Response Visualizer Curve */}
        <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60 px-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" /> Live Response Curve
            </span>
            <span>{equalizerSettings.preset}</span>
          </div>

          <div className="relative h-16 w-full flex items-center justify-center">
            {/* Center 0dB dashed line */}
            <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-white/15" />

            <svg className="w-full h-full overflow-visible" viewBox="0 0 320 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eqGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={themeColors.accent} stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              <path
                d={curvePath}
                fill="none"
                stroke="url(#eqGlow)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Point Nodes */}
              {curvePoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#ffffff"
                  stroke={themeColors.accent}
                  strokeWidth="2"
                  className="transition-all duration-300"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Sound Presets Carousel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-bold opacity-60">Sound Profiles & Presets</span>
            <button
              onClick={resetFlat}
              className="text-xs flex items-center gap-1 text-white/70 hover:text-white font-semibold transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset Flat
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {Object.keys(PRESETS).map((pName) => {
              const active = equalizerSettings.preset === pName;
              return (
                <button
                  key={pName}
                  onClick={() => handleApplyPreset(pName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    active ? 'text-white shadow-lg scale-105' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                  }`}
                  style={{
                    backgroundColor: active ? themeColors.accent : undefined,
                  }}
                >
                  {active && <Check className="w-3.5 h-3.5" />}
                  {pName}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Band Channel Columns (All 5 channels clearly visible on mobile) */}
        <div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-60 mb-2 flex items-center justify-between">
            <span>5-Band Frequencies</span>
            <span className="text-[10px] font-mono opacity-50">60Hz - 14kHz</span>
          </div>

          <div
            className={`grid grid-cols-5 gap-1 sm:gap-3 p-2 sm:p-4 rounded-2xl bg-black/40 border border-white/5 transition-opacity min-w-0 w-full ${
              !equalizerSettings.enabled ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {BANDS_CONFIG.map(({ key, label, sub }) => {
              const value = equalizerSettings.bands[key] || 0;
              // Normalize value (-12 to +12 -> percentage 0 to 100)
              const percent = Math.round(((value + 12) / 24) * 100);

              return (
                <div key={key} className="flex flex-col items-center gap-1.5 select-none min-w-0">
                  {/* dB Badge */}
                  <span
                    className={`text-[9px] sm:text-[10px] font-mono font-bold px-1 sm:px-1.5 py-0.5 rounded-md text-center w-full truncate ${
                      value > 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : value < 0
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {value > 0 ? `+${value}` : value}dB
                  </span>

                  {/* Vertical Channel Column Track */}
                  <div className="relative w-full max-w-[40px] h-32 sm:h-36 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10 flex flex-col items-center justify-end p-1 overflow-hidden group">
                    {/* Fill Level Bar */}
                    <div
                      className="w-full rounded-lg sm:rounded-xl transition-all duration-150"
                      style={{
                        height: `${Math.max(8, percent)}%`,
                        backgroundColor: themeColors.accent,
                        boxShadow: `0 0 10px ${themeColors.accent}80`,
                      }}
                    />

                    {/* Native Vertical Slider Overlay */}
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={value}
                      onChange={(e) => handleBandChange(key, parseInt(e.target.value, 10))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                      }}
                    />
                  </div>

                  {/* Frequency Labels */}
                  <div className="text-center min-w-0 w-full">
                    <div className="text-[10px] sm:text-[11px] font-bold text-white leading-tight truncate">{label}</div>
                    <div className="text-[8px] sm:text-[9px] opacity-40 font-mono mt-0.5 truncate">{sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DSP Sound FX Sliders (Bass Boost & Master Preamp) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Bass Boost */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white">Dynamic Bass Boost</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {equalizerSettings.bassBoost}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={equalizerSettings.bassBoost}
              onChange={(e) => handleBassBoostChange(parseInt(e.target.value, 10))}
              disabled={!equalizerSettings.enabled}
              className="w-full h-2 rounded-lg cursor-pointer bg-white/10"
              style={{ accentColor: themeColors.accent }}
            />
          </div>

          {/* Master Preamp */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white">Master Preamp Gain</span>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {(equalizerSettings.preamp || 0) > 0 ? `+${equalizerSettings.preamp}` : equalizerSettings.preamp || 0} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={equalizerSettings.preamp || 0}
              onChange={(e) => handlePreampChange(parseInt(e.target.value, 10))}
              disabled={!equalizerSettings.enabled}
              className="w-full h-2 rounded-lg cursor-pointer bg-white/10"
              style={{ accentColor: themeColors.accent }}
            />
          </div>
        </div>

        {/* Compression / Soft Limiter Badge */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Soft Limiter & Clipping Protection Active</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
            PROTECTED
          </span>
        </div>
      </div>
    </div>
  );
};
