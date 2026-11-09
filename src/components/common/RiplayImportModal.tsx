import React, { useState, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';
import { RiplayImportSummary } from '../../services/riplaySqliteImporter';
import {
  Database,
  Upload,
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
} from 'lucide-react';

interface RiplayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RiplayImportModal: React.FC<RiplayImportModalProps> = ({ isOpen, onClose }) => {
  const { importRiplaySqliteBackup, themeColors, hapticFeedback, setActiveTab } = useMusic();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<RiplayImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSummary(null);

    try {
      const result = await importRiplaySqliteBackup(file);
      setSummary(result);
    } catch (err: any) {
      console.error('Failed to import SQLite DB:', err);
      setErrorMsg(
        err.message ||
          'Failed to parse SQLite database. Ensure this is a valid RiPlay / RiMusic backup (.db, .backup, or .sqlite file).'
      );
    } finally {
      setIsProcessing(false);
      // Reset input value so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFinish = () => {
    hapticFeedback();
    onClose();
    setActiveTab('library');
  };

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
            hapticFeedback();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: `${themeColors.accent}25`, color: themeColors.accent }}
          >
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Import RiPlay SQLite
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                .db / .backup
              </span>
            </h2>
            <p className="text-xs opacity-60">Full Room DB restoration with zero data loss</p>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!summary ? (
            <>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2.5 text-xs">
                <div className="font-bold flex items-center gap-2 text-white">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  What gets imported from your RiPlay backup:
                </div>
                <ul className="space-y-1.5 opacity-80 pl-2">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Playlists:</strong> All playlists with original song ordering</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Liked Songs:</strong> Your complete favorites catalog</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Lyrics:</strong> Pre-synced and cached lyrics for offline use</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Listening History:</strong> Play counts, events, and stats</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Artists & Albums:</strong> Full discography & cross-references</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Blacklist:</strong> Blocked artists or tracks</span>
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
                    ? 'border-white/10 opacity-70 cursor-wait'
                    : 'border-white/20 hover:border-white/40 hover:bg-white/5 active:scale-[0.99]'
                }`}
              >
                {isProcessing ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    <div className="text-sm font-bold">Reading SQLite Tables...</div>
                    <div className="text-xs opacity-60">Parsing Room schema via WebAssembly</div>
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
            </>
          ) : (
            /* Success Summary View */
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-400" />
                <div>
                  <div className="font-bold text-sm text-white">RiPlay Backup Imported!</div>
                  <div className="text-xs opacity-90">All songs, playlists, and records mapped successfully.</div>
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
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
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
          ) : (
            <button
              onClick={() => {
                hapticFeedback();
                onClose();
              }}
              className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-semibold transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
