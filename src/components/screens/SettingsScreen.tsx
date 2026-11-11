import React, { useState, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { THEMES } from '../../styles/themes';
import { ThemeName } from '../../types/music';
import {
  Palette,
  Sliders,
  Moon,
  Smartphone,
  Download,
  Upload,
  Info,
  Check,
  Radio,
  FileCode,
  Database,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  HardDrive,
  FileDown,
  ListMusic,
} from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { RetentionDuration, offlineCacheService } from '../../services/offlineCacheService';
import { pwaUpdater } from '../../utils/pwaUpdater';
import { APP_VERSION, APP_BUILD, APP_RELEASE_NAME } from '../../version';

export const SettingsScreen: React.FC = () => {
  const {
    theme,
    setTheme,
    themeColors,
    setIsEqualizerOpen,
    setIsSleepTimerOpen,
    setIsPWAInstallModalOpen,
    setIsRiplayImportOpen,
    lastImportSummary,
    hapticFeedback,
    cacheConfig,
    updateCacheConfig,
    storageEstimate,
    clearOfflineCache,
    enableMultipleQueues,
    setEnableMultipleQueues,
  } = useMusic();
  const { isInstalled } = usePWAInstall();

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'up_to_date' | 'update_available'>('idle');
  const [isPersisted, setIsPersisted] = useState(false);
  const [exportingSongs, setExportingSongs] = useState(false);

  React.useEffect(() => {
    offlineCacheService.isStoragePersisted().then((val) => setIsPersisted(val));
  }, []);

  const handleRequestPersistence = async () => {
    hapticFeedback();
    const granted = await offlineCacheService.requestPersistence();
    setIsPersisted(granted);
    if (granted) {
      alert('Permanent Storage Activated!\nAndroid OS and Chrome will never automatically evict or clear your offline cached music.');
    } else {
      alert('Persistent storage requested. Installing Muzika as a PWA on your Android home screen guarantees permanent storage protection.');
    }
  };

  const handleExportAllOfflineMp3s = async () => {
    hapticFeedback();
    setExportingSongs(true);
    try {
      const records = await offlineCacheService.getAllCachedSongs();
      const withAudio = records.filter((r) => r.audioBlob && r.audioBlob.size > 1000);
      if (withAudio.length === 0) {
        alert('No downloaded audio files ready for export yet. Tap the download icon next to any song while online to download its audio.');
        return;
      }
      for (const record of withAudio) {
        const url = URL.createObjectURL(record.audioBlob!);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = `${record.song.artist} - ${record.song.title}`.replace(/[/\\?%*:|"<>]/g, '_');
        a.download = `${cleanName}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 450));
      }
      alert(`Exported ${withAudio.length} MP3 track(s) directly to your device Downloads folder! You can now move them to your SD card.`);
    } finally {
      setExportingSongs(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCheckUpdate = async () => {
    hapticFeedback();
    setCheckingUpdate(true);
    try {
      const hasUpdate = await pwaUpdater.checkForUpdates();
      if (hasUpdate) {
        setUpdateStatus('update_available');
      } else {
        setUpdateStatus('up_to_date');
      }
    } catch {
      setUpdateStatus('up_to_date');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleExportBackup = () => {
    hapticFeedback();
    const json = StorageService.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muzika_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = StorageService.importBackup(content);
        if (ok) {
          alert('Backup restored successfully! Reloading...');
          window.location.reload();
        } else {
          alert('Failed to parse backup JSON file.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="w-5 h-5" style={{ color: themeColors.accent }} />
        <h1 className="text-xl font-black">Settings & Customization</h1>
      </div>

      {/* Theme Selection */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">Color Palettes (RiPlay Themes)</h2>
        <div className="grid grid-cols-1 gap-2">
          {(Object.keys(THEMES) as ThemeName[]).map((tKey) => {
            const item = THEMES[tKey];
            const isSelected = theme === tKey;
            return (
              <div
                key={tKey}
                onClick={() => {
                  hapticFeedback();
                  setTheme(tKey);
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition border ${
                  isSelected ? 'border-white/40 shadow-lg' : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}
                style={{
                  backgroundColor: isSelected ? item.background1 : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white/20 shadow-sm"
                    style={{ backgroundColor: item.accent }}
                  />
                  <div>
                    <div className="text-sm font-bold text-white">{item.label}</div>
                    <div className="text-[11px] opacity-50">OLED / Dark Palette</div>
                  </div>
                </div>
                {isSelected && <Check className="w-5 h-5" style={{ color: item.accent }} />}
              </div>
            );
          })}
        </div>
      </section>

      {/* Audio & Playback Options */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">Audio Engine</h2>
        <div className="rounded-2xl bg-white/5 border border-white/5 divide-y divide-white/5 overflow-hidden">
          <div
            onClick={() => {
              hapticFeedback();
              setIsEqualizerOpen(true);
            }}
            className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 opacity-70" />
              <div>
                <div className="text-sm font-semibold">Equalizer & Bass Boost</div>
                <div className="text-xs opacity-50">5-band graphic EQ and sound profiles</div>
              </div>
            </div>
            <span className="text-xs opacity-60 font-medium">Configure</span>
          </div>

          <div
            onClick={() => {
              hapticFeedback();
              setIsSleepTimerOpen(true);
            }}
            className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition"
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 opacity-70" />
              <div>
                <div className="text-sm font-semibold">Sleep Timer</div>
                <div className="text-xs opacity-50">Schedule playback shutdown</div>
              </div>
            </div>
            <span className="text-xs opacity-60 font-medium">Set</span>
          </div>

          <div className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 opacity-70" />
              <div>
                <div className="text-sm font-semibold">Stream Quality</div>
                <div className="text-xs opacity-50">YouTube Opus 160 kbps High</div>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400">
              High Fidelity
            </span>
          </div>
        </div>
      </section>

      {/* Multiple Queues Feature */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">Advanced Queue Management</h2>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListMusic className="w-5 h-5" style={{ color: themeColors.accent }} />
              <div>
                <div className="text-sm font-bold text-white">Multiple Listening Queues</div>
                <div className="text-xs opacity-50">Maintain separate queues (e.g. Workout, Focus)</div>
              </div>
            </div>
            <button
              onClick={() => {
                setEnableMultipleQueues(!enableMultipleQueues);
              }}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer ${
                enableMultipleQueues ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  enableMultipleQueues ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] opacity-60 leading-relaxed">
            When enabled, an interactive queue manager pill appears inside the player queue view, allowing you to create custom named queues, switch active listening states seamlessly, and rename or delete queues.
          </p>
        </div>
      </section>

      {/* Android Mobile PWA Installation */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">Android App Status</h2>
        <div
          onClick={() => {
            hapticFeedback();
            setIsPWAInstallModalOpen(true);
          }}
          className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5" style={{ color: themeColors.accent }} />
            <div>
              <div className="text-sm font-bold">
                {isInstalled ? 'Installed as Android App' : 'Install on Android Phone'}
              </div>
              <div className="text-xs opacity-50">
                {isInstalled
                  ? 'Running in full standalone mode'
                  : 'Install WebAPK with offline support'}
              </div>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-xl bg-white/10 font-semibold">
            {isInstalled ? 'Active' : 'Install'}
          </span>
        </div>
      </section>

      {/* RiPlay Backup & SQLite Database Import */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">RiPlay Database & Backups</h2>

        {/* SQLite .db / .backup Importer Hero Card */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-white/5 to-transparent border border-emerald-500/30 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white flex items-center gap-1.5">
                  RiPlay SQLite Database
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
                    Room DB
                  </span>
                </div>
                <div className="text-[11px] opacity-60">Upload .db, .backup, or .sqlite files</div>
              </div>
            </div>
          </div>

          <p className="text-xs opacity-75 leading-relaxed">
            Directly upload SQLite database backups exported from the <strong>RiPlay</strong> or <strong>RiMusic</strong> Android apps. Extracts all songs, playlists with original ordering, lyrics, listening history, and blacklists.
          </p>

          {lastImportSummary && (
            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-[11px] space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Database Active: {lastImportSummary.songsCount} songs, {lastImportSummary.playlistsCount} playlists
              </div>
              <div className="opacity-60">
                {lastImportSummary.likedSongsCount} liked • {lastImportSummary.historyCount} history plays • {lastImportSummary.artistsCount} artists
              </div>
            </div>
          )}

          <button
            onClick={() => {
              hapticFeedback();
              setIsRiplayImportOpen(true);
            }}
            className="w-full py-3 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            style={{ backgroundColor: themeColors.accent }}
          >
            <Database className="w-4 h-4" />
            <span>Upload RiPlay Database (.db / .backup)</span>
          </button>
        </div>

        {/* JSON Backup Tools */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleExportBackup}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 text-xs font-bold"
          >
            <Download className="w-5 h-5" style={{ color: themeColors.accent }} />
            <span>Export Backup (JSON)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 text-xs font-bold"
          >
            <Upload className="w-5 h-5" style={{ color: themeColors.accent }} />
            <span>Import Backup (JSON)</span>
          </button>
        </div>
      </section>

      {/* Offline Storage & Retention Settings (RiPlay Cache Management) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">Offline Storage & Cache Guard</h2>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5" style={{ color: themeColors.accent }} />
              <div>
                <div className="text-sm font-bold text-white">Device Offline Storage</div>
                <div className="text-xs opacity-60">
                  {(storageEstimate.totalBytes / (1024 * 1024)).toFixed(1)} MB used • {storageEstimate.count} songs saved
                </div>
              </div>
            </div>
            {storageEstimate.count > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all offline cached music from your device storage?')) {
                    clearOfflineCache();
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Android Eviction Protection Guard (Never Delete) */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{isPersisted ? 'Storage Eviction Guard: Active' : 'Storage Protection'}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                {isPersisted ? 'NEVER DELETED' : 'STANDARD'}
              </span>
            </div>
            <p className="text-[11px] opacity-75 leading-relaxed">
              {isPersisted
                ? 'Your offline songs are protected by the Android Persistent Storage API. Android OS and Chrome will NEVER automatically evict or clear your cached music, even if phone storage runs low.'
                : 'Android currently manages cache under Chrome site data. Tap below to activate permanent eviction protection so songs are never deleted automatically.'}
            </p>
            {!isPersisted && (
              <button
                onClick={handleRequestPersistence}
                className="px-3.5 py-2 rounded-xl text-black font-bold text-xs bg-emerald-400 hover:bg-emerald-300 transition active:scale-95 shadow-md flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Enable Permanent Eviction Guard</span>
              </button>
            )}
          </div>

          {/* Storage Sandbox & SD Card Explanation */}
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 space-y-2.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-xs font-bold text-white">Storage Location & SD Card Support</div>
            </div>
            <p className="text-[11px] opacity-70 leading-relaxed">
              Because Muzika runs as a high-speed Android PWA, Android security stores cached audio in Chrome's high-speed persistent sandbox (shown under <strong>Chrome &gt; Storage &gt; Site Data</strong>). Web apps cannot write background audio directly to arbitrary raw SD card folder paths due to Android sandbox security.
            </p>
            <p className="text-[11px] opacity-70 leading-relaxed">
              💡 <strong>Want to store on SD Card?</strong> You can set Chrome or Muzika's app storage location to your SD Card in your phone's <strong>Android Settings &gt; Apps &gt; Chrome (or Muzika) &gt; Storage &gt; Change Storage to SD Card</strong>.
            </p>
            <div className="pt-1">
              <button
                onClick={handleExportAllOfflineMp3s}
                disabled={exportingSongs || storageEstimate.count === 0}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 border border-white/10 disabled:opacity-40"
              >
                <FileDown className="w-4 h-4 text-emerald-400" />
                <span>{exportingSongs ? 'Exporting MP3s to Device...' : 'Export Offline Songs to Phone / SD (MP3 Files)'}</span>
              </button>
            </div>
          </div>

          {/* Retention Options */}
          <div>
            <label className="text-xs font-semibold block mb-2 opacity-80">
              Auto-Cleanup Retention:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'forever', label: 'Forever (Never delete)' },
                { id: '30d', label: '30 Days' },
                { id: '14d', label: '14 Days' },
                { id: '7d', label: '7 Days' },
              ].map(({ id, label }) => {
                const isSelected = cacheConfig.retention === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      hapticFeedback();
                      updateCacheConfig({
                        ...cacheConfig,
                        retention: id as RetentionDuration,
                      });
                    }}
                    className={`p-2.5 rounded-xl text-xs font-medium text-left transition flex items-center justify-between border ${
                      isSelected
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-bold'
                        : 'border-white/5 bg-black/20 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span>{label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto Cache Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div>
              <div className="text-xs font-semibold text-white">Auto-cache songs on playback</div>
              <div className="text-[11px] opacity-50">Automatically save songs you listen to for offline use</div>
            </div>
            <button
              onClick={() => {
                hapticFeedback();
                updateCacheConfig({
                  ...cacheConfig,
                  autoCacheOnPlay: !cacheConfig.autoCacheOnPlay,
                });
              }}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                cacheConfig.autoCacheOnPlay ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  cacheConfig.autoCacheOnPlay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 24/7 Permanent Hosting Guide & Zip Download */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">24/7 Permanent Free Hosting</h2>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Deploy to Netlify (Free & 24/7)</div>
              <div className="text-[11px] opacity-60">Never sleeps, 100% uptime on your own URL</div>
            </div>
          </div>

          <p className="text-xs opacity-75 leading-relaxed">
            AI Studio development environments automatically sleep when inactive. To keep Muzika available on your phone 24/7 forever, download the pre-built files below and drop them into Netlify:
          </p>

          <a
            href="/muzika-dist.zip"
            download="muzika-dist.zip"
            className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95"
            style={{ backgroundColor: themeColors.accent }}
          >
            <Download className="w-4 h-4" />
            Download Pre-Built App (muzika-dist.zip)
          </a>

          <div className="pt-2 text-[11px] opacity-70 space-y-1">
            <div>1. Unzip <code>muzika-dist.zip</code> to get the <code>dist</code> folder.</div>
            <div>2. Go to <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-cyan-400 underline">app.netlify.com/drop</a> in your browser.</div>
            <div>3. Drag & drop the <code>dist</code> folder. You get an instant permanent link like <code>muzika-app.netlify.app</code>!</div>
          </div>
        </div>
      </section>

      {/* App Updates & Version Badge */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider opacity-60">PWA Updates & Version</h2>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Version {APP_VERSION}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    ACTIVE
                  </span>
                </div>
                <div className="text-[11px] opacity-60">Build ID: {APP_BUILD}</div>
              </div>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {checkingUpdate ? 'Checking...' : 'Check Now'}
            </button>
          </div>

          {updateStatus === 'up_to_date' && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>You are running {APP_RELEASE_NAME} (latest build)</span>
            </div>
          )}

          {updateStatus === 'update_available' && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>New update ready!</span>
              </div>
              <button
                onClick={() => pwaUpdater.applyUpdate()}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] cursor-pointer shadow active:scale-95"
              >
                Apply
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-[11px] opacity-50">
            <span>Installed PWA: {isInstalled ? 'Yes (Home Screen)' : 'Browser Mode'}</span>
            <button
              onClick={() => {
                if (window.confirm('Clear PWA caches and reload latest files?')) {
                  const win = window as any;
                  if (win.caches) {
                    win.caches.keys().then((names: string[]) => {
                      names.forEach((name: string) => win.caches.delete(name));
                      window.location.reload();
                    });
                  } else {
                    window.location.reload();
                  }
                }
              }}
              className="underline hover:text-white transition cursor-pointer"
            >
              Force Cache Refresh
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Info className="w-4 h-4" style={{ color: themeColors.accent }} />
          <span>About Muzika</span>
        </div>
        <p className="opacity-70 leading-relaxed">
          Muzika is built on top of the open-source architecture of <strong>RiPlay</strong> by fast4x. It runs as a full-featured Android PWA with YouTube stream integration, LRCLIB synchronized lyrics, 5-band equalizer, and strict privacy (zero data collection).
        </p>
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] opacity-40">
          <span>{APP_RELEASE_NAME}</span>
          <span>GPL v3.0 Open Source</span>
        </div>
      </section>
    </div>
  );
};
