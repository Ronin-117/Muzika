import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { RiplayImportSummary, RiplayExportResult } from '../../services/riplaySqliteImporter';
import { APP_VERSION, APP_BUILD } from '../../version';
import {
  Database,
  Upload,
  Download,
  CheckCircle2,
  X,
  FileCheck,
  Disc,
  ListMusic,
  Heart,
  Clock,
  Ban,
  User,
  AlertCircle,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Terminal,
  ArrowLeftRight,
} from 'lucide-react';

interface RiplayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RiplayImportModal: React.FC<RiplayImportModalProps> = ({ isOpen, onClose }) => {
  const {
    importRiplaySqliteBackup,
    exportRiplaySqliteBackup,
    riplayModalMode,
    setRiplayModalMode,
    themeColors,
    hapticFeedback,
    setActiveTab,
    playlists,
    likedSongs,
    importedArtists,
    savedArtists,
    importedAlbums,
    savedAlbums,
    history,
    blacklist,
  } = useMusic();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<RiplayImportSummary | null>(null);
  const [exportResult, setExportResult] = useState<RiplayExportResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLog, setCopiedLog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isOpen && !isProcessing) {
      setErrorMsg(null);
      setCopiedLog(false);
    }
  }, [isOpen, riplayModalMode]);

  if (!isOpen) return null;

  const appendLog = (line: string) => {
    setLogs((prev) => {
      const next = prev.length > 400 ? prev.slice(-300) : prev;
      return [...next, line];
    });
  };

  const handleCopyLog = async () => {
    hapticFeedback();
    if (logs.length === 0) return;
    const header = [
      `Muzika Diagnostic Log | v${APP_VERSION} (Build ${APP_BUILD})`,
      `Mode: ${riplayModalMode.toUpperCase()} | ${new Date().toISOString()}`,
      `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
      '----------------------------------------',
    ].join('\n');
    const text = `${header}\n${logs.join('\n')}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      // Legacy fallback for mobile WebViews
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(textarea);
    }
    setCopiedLog(true);
    window.setTimeout(() => setCopiedLog(false), 2000);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSummary(null);
    setExportResult(null);
    setLogs([`[+0.00s] Preparing import for "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`]);

    try {
      const result = await importRiplaySqliteBackup(file, appendLog);
      setSummary(result);
    } catch (err: any) {
      console.error('Failed to import SQLite DB:', err);
      const errText =
        err?.message ||
        'Failed to parse SQLite database. Ensure this is a valid RiPlay / RiMusic backup (.db, .backup, or .sqlite file).';
      appendLog(`[ERROR] ${errText}`);
      setErrorMsg(errText);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportDatabase = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setExportResult(null);
    setSummary(null);
    setLogs(['[+0.00s] Preparing Muzika -> RiPlay SQLite export...']);

    try {
      const result = await exportRiplaySqliteBackup(appendLog);
      setExportResult(result);
    } catch (err: any) {
      console.error('Failed to export SQLite DB:', err);
      const errText = err?.message || 'Failed to generate RiPlay SQLite database file.';
      appendLog(`[ERROR] ${errText}`);
      setErrorMsg(errText);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwitchMode = (mode: 'import' | 'export') => {
    if (isProcessing) return;
    hapticFeedback();
    setRiplayModalMode(mode);
    setErrorMsg(null);
    setSummary(null);
    setExportResult(null);
    setLogs([]);
  };

  const handleFinish = () => {
    hapticFeedback();
    onClose();
    setActiveTab('library');
  };

  // Deduplicated counts preview for Export mode
  const totalUniqueArtists = new Set([
    ...importedArtists.map((a) => a.id),
    ...savedArtists.map((a) => a.id),
  ]).size;
  const totalUniqueAlbums = new Set([
    ...importedAlbums.map((a) => a.id),
    ...savedAlbums.map((a) => a.id),
  ]).size;

  const latestLogLine = logs.length > 0 ? logs[logs.length - 1] : '';

  const DiagnosticLogBox = logs.length > 0 && (
    <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sync Log ({logs.length})</span>
        </div>
        <button
          onClick={handleCopyLog}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 text-white"
        >
          {copiedLog ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Log</span>
            </>
          )}
        </button>
      </div>
      <div
        ref={logContainerRef}
        className="max-h-36 overflow-y-auto font-mono text-[10px] leading-relaxed text-white/75 space-y-0.5 pr-1 select-text"
      >
        {logs.map((line, i) => (
          <div
            key={i}
            className={`break-words ${
              line.includes('[ERROR]') || line.includes('Warning')
                ? 'text-red-300'
                : line.includes('complete') || line.includes('finished') || line.includes('packaged')
                ? 'text-emerald-300'
                : ''
            }`}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl p-6 border shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: themeColors.background1,
          borderColor: 'rgba(255,255,255,0.1)',
          color: themeColors.text,
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            if (isProcessing) return;
            hapticFeedback();
            onClose();
          }}
          disabled={isProcessing}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
            style={{ backgroundColor: `${themeColors.accent}25`, color: themeColors.accent }}
          >
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div className="pr-8">
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              RiPlay SQLite Sync
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                .db / .backup
              </span>
            </h2>
            <p className="text-xs opacity-60">2-way Room DB import & export</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/30 border border-white/5 mb-4">
          <button
            onClick={() => handleSwitchMode('import')}
            disabled={isProcessing}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              riplayModalMode === 'import'
                ? 'bg-white/15 text-white shadow'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import from RiPlay</span>
          </button>
          <button
            onClick={() => handleSwitchMode('export')}
            disabled={isProcessing}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              riplayModalMode === 'export'
                ? 'bg-white/15 text-white shadow'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to RiPlay</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {riplayModalMode === 'import' ? (
            !summary ? (
              <>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5 text-xs">
                  <div className="font-bold flex items-center gap-2 text-white">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Smart incremental merge on re-import:
                  </div>
                  <ul className="space-y-1.5 opacity-80 pl-2">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Playlists & Songs:</strong> Preserves ordering & enriches missing metadata</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Liked Songs & Lyrics:</strong> Synced LRC & fixed lyrics preserved</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>Artists & Albums:</strong> Discography & bookmarks without duplicates</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span><strong>History & Blacklist:</strong> Merged cleanly without double-counting plays</span>
                    </li>
                  </ul>
                </div>

                {/* Upload Dropzone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite,.backup"
                  onChange={handleFileSelected}
                  className="hidden"
                />

                <div
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition ${
                    isProcessing
                      ? 'border-white/10 opacity-90 cursor-wait bg-white/[0.02]'
                      : 'border-white/20 hover:border-white/40 hover:bg-white/5 active:scale-[0.99]'
                  }`}
                >
                  {isProcessing ? (
                    <div className="space-y-2.5 flex flex-col items-center w-full">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                      <div className="text-sm font-bold text-white">Processing SQLite Database...</div>
                      <div className="text-[11px] font-mono text-emerald-300/90 truncate max-w-full px-2">
                        {latestLogLine || 'Initializing WebAssembly...'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 flex flex-col items-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5"
                        style={{ color: themeColors.accent }}
                      >
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Select RiPlay SQLite Backup</div>
                        <div className="text-xs opacity-60 mt-1">
                          Tap here to pick <code>riplay-backup-*.db</code>
                        </div>
                      </div>
                      <div className="text-[11px] px-3 py-1 rounded-full bg-white/5 opacity-70">
                        Supported: .db, .backup, .sqlite
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Import Error</div>
                      <div className="opacity-90 mt-0.5">{errorMsg}</div>
                    </div>
                  </div>
                )}

                {DiagnosticLogBox}
              </>
            ) : (
              /* Import Success Summary View */
              <div className="space-y-4 animate-in zoom-in-95 duration-200">
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-bold text-sm text-white">RiPlay Backup Imported!</div>
                    <div className="text-xs opacity-90">All songs, playlists, and records merged cleanly.</div>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <ListMusic className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.playlistsCount}</div>
                      <div className="text-[11px] opacity-60">Playlists</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <Disc className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.songsCount}</div>
                      <div className="text-[11px] opacity-60">Total Songs</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <Heart className="w-5 h-5 text-rose-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.likedSongsCount}</div>
                      <div className="text-[11px] opacity-60">Liked Songs</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.historyCount}</div>
                      <div className="text-[11px] opacity-60">History Plays</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <User className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.artistsCount}</div>
                      <div className="text-[11px] opacity-60">Artists</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                    <Ban className="w-5 h-5 text-red-400" />
                    <div>
                      <div className="text-base font-black text-white">{summary.blacklistCount}</div>
                      <div className="text-[11px] opacity-60">Blacklisted</div>
                    </div>
                  </div>
                </div>

                {/* Discovered Tables Badge */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold opacity-60 uppercase tracking-wider">
                    Discovered SQLite Tables ({summary.tablesFound.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.tablesFound.map((table) => (
                      <span
                        key={table}
                        className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-mono text-white/80"
                      >
                        {table}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sample of Imported Playlists */}
                {summary.importedPlaylists.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold opacity-60 uppercase tracking-wider">
                      Imported Playlists ({summary.importedPlaylists.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {summary.importedPlaylists.slice(0, 8).map((pl) => (
                        <div
                          key={pl.id}
                          className="p-2 rounded-xl bg-white/5 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold truncate max-w-[200px]">{pl.title}</span>
                          <span className="text-[11px] opacity-60">{pl.songs.length} tracks</span>
                        </div>
                      ))}
                      {summary.importedPlaylists.length > 8 && (
                        <div className="text-center text-[11px] opacity-50 py-1">
                          + {summary.importedPlaylists.length - 8} more playlists
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {DiagnosticLogBox}
              </div>
            )
          ) : !exportResult ? (
            /* Export Setup View */
            <>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5 text-xs">
                <div className="font-bold flex items-center gap-2 text-white">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Export Muzika Library to RiPlay (.db)
                </div>
                <p className="opacity-75 leading-relaxed">
                  Packages your playlists, liked songs, synced lyrics, listening history, play counts, artists, albums, and blacklist into a genuine Room SQLite database ready to restore in <strong>RiPlay</strong> or <strong>RiMusic</strong>.
                </p>
              </div>

              {/* Current Muzika Data Preview Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{playlists.length}</div>
                  <div className="text-[10px] opacity-60">Playlists</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{likedSongs.length}</div>
                  <div className="text-[10px] opacity-60">Liked Songs</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{totalUniqueArtists}</div>
                  <div className="text-[10px] opacity-60">Artists</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{totalUniqueAlbums}</div>
                  <div className="text-[10px] opacity-60">Albums</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{history.length}</div>
                  <div className="text-[10px] opacity-60">History</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-base font-black text-white">{blacklist.length}</div>
                  <div className="text-[10px] opacity-60">Blacklist</div>
                </div>
              </div>

              <button
                onClick={handleExportDatabase}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: themeColors.accent }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Building SQLite Database...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Generate & Download RiPlay .db</span>
                  </>
                )}
              </button>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Export Error</div>
                    <div className="opacity-90 mt-0.5">{errorMsg}</div>
                  </div>
                </div>
              )}

              {DiagnosticLogBox}
            </>
          ) : (
            /* Export Success Summary View */
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-400" />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white">RiPlay Database Exported!</div>
                  <div className="text-xs opacity-90 truncate font-mono">{exportResult.fileName}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                  <Disc className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-base font-black text-white">{exportResult.songsCount}</div>
                    <div className="text-[11px] opacity-60">Songs Written</div>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                  <ListMusic className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-base font-black text-white">{exportResult.playlistsCount}</div>
                    <div className="text-[11px] opacity-60">Playlists</div>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                  <User className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-base font-black text-white">{exportResult.artistsCount}</div>
                    <div className="text-[11px] opacity-60">Artists</div>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-base font-black text-white">{exportResult.eventsCount}</div>
                    <div className="text-[11px] opacity-60">History Events</div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] flex items-center justify-between">
                <span className="opacity-60">Schema Mode</span>
                <span className="font-bold text-emerald-300">
                  {exportResult.usedBlueprint ? 'Captured RiPlay Room Schema' : 'Standard Room Schema'}
                </span>
              </div>

              {DiagnosticLogBox}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/5 mt-2 flex items-center gap-2">
          {summary ? (
            <button
              onClick={handleFinish}
              className="w-full py-3 px-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
              style={{ backgroundColor: themeColors.accent }}
            >
              <FileCheck className="w-4 h-4" />
              <span>Go to My Library</span>
            </button>
          ) : exportResult ? (
            <>
              <button
                onClick={handleExportDatabase}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold transition"
              >
                Download Again
              </button>
              <button
                onClick={() => {
                  hapticFeedback();
                  onClose();
                }}
                className="flex-1 py-2.5 px-3 rounded-2xl text-white text-xs font-bold transition"
                style={{ backgroundColor: themeColors.accent }}
              >
                Done
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (isProcessing) return;
                hapticFeedback();
                onClose();
              }}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-semibold transition disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
