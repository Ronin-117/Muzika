import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { X, Sliders, RotateCcw, Volume2, Check } from 'lucide-react';
import { EqualizerBands } from '../../types/music';

const PRESETS: Record<string, EqualizerBands> = {
  Flat: { band60: 0, band230: 0, band910: 0, band3600: 0, band14000: 0 },
  'Bass Boost': { band60: 8, band230: 5, band910: 1, band3600: 0, band14000: -2 },
  Pop: { band60: -1, band230: 2, band910: 5, band3600: 4, band14000: 1 },
  Rock: { band60: 5, band230: 3, band910: -1, band3600: 3, band14000: 6 },
  Electronic: { band60: 6, band230: 4, band910: 0, band3600: 2, band14000: 5 },
  Vocal: { band60: -3, band230: 0, band910: 6, band3600: 5, band14000: 1 },
  Acoustic: { band60: 3, band230: 2, band910: 2, band3600: 4, band14000: 4 },
};

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
    const bands = PRESETS[presetName] || PRESETS.Flat;
    setEqualizerSettings({
      ...equalizerSettings,
      preset: presetName,
      bands,
      bassBoost: presetName === 'Bass Boost' ? 60 : equalizerSettings.bassBoost,
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

  const resetFlat = () => {
    hapticFeedback();
    handleApplyPreset('Flat');
  };

  const bandsList: { key: keyof EqualizerBands; label: string }[] = [
    { key: 'band60', label: '60 Hz' },
    { key: 'band230', label: '230 Hz' },
    { key: 'band910', label: '910 Hz' },
    { key: 'band3600', label: '3.6 kHz' },
    { key: 'band14000', label: '14 kHz' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5" style={{ color: themeColors.accent }} />
            <h2 className="text-lg font-bold">Audio Equalizer & Sound FX</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${
                equalizerSettings.enabled ? 'text-white' : 'bg-white/10 text-white/50'
              }`}
              style={{
                backgroundColor: equalizerSettings.enabled ? themeColors.accent : undefined,
              }}
            >
              {equalizerSettings.enabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setIsEqualizerOpen(false)}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Presets Chips */}
        <div className="mt-4">
          <span className="text-xs uppercase tracking-wider font-semibold opacity-60">Sound Presets</span>
          <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
            {Object.keys(PRESETS).map((pName) => {
              const active = equalizerSettings.preset === pName;
              return (
                <button
                  key={pName}
                  onClick={() => handleApplyPreset(pName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    active ? 'text-white shadow-md' : 'bg-white/5 text-white/70 hover:bg-white/10'
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

        {/* Graphic EQ Slider Bars */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider font-semibold opacity-60">5-Band Frequencies</span>
            <button
              onClick={resetFlat}
              className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div
            className={`flex items-end justify-between gap-3 h-48 py-4 px-3 rounded-2xl bg-black/20 ${
              !equalizerSettings.enabled ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {bandsList.map(({ key, label }) => {
              const value = equalizerSettings.bands[key];
              return (
                <div key={key} className="flex-1 flex flex-col items-center h-full justify-between">
                  <span className="text-[10px] font-mono opacity-70">
                    {value > 0 ? `+${value}` : value} dB
                  </span>
                  <div className="relative flex-1 flex items-center justify-center my-1 w-full">
                    {/* Vertical slider wrapper */}
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={value}
                      onChange={(e) => handleBandChange(key, parseInt(e.target.value, 10))}
                      className="accent-slider -rotate-90 w-28 h-2 cursor-pointer"
                      style={{ accentColor: themeColors.accent }}
                    />
                  </div>
                  <span className="text-[11px] font-medium opacity-80 mt-1">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bass Boost Dial */}
        <div className="mt-6 p-4 rounded-2xl bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl bg-white/5"
              style={{ color: themeColors.accent }}
            >
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">RiPlay Bass Boost</div>
              <div className="text-xs opacity-60">Deep dynamic sub-bass enhancement</div>
            </div>
          </div>
          <div className="flex items-center gap-3 w-40">
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
            <span className="text-xs font-mono font-bold w-9 text-right">
              {equalizerSettings.bassBoost}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
