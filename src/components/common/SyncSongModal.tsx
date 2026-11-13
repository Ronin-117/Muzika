import React, { useEffect, useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { Song } from '../../types/music';
import { OnlineMusicService } from '../../services/onlineMusicService';
import {
  X,
  Search,
  Play,
  Square,
  Check,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Volume2,
} from 'lucide-react';

export const SyncSongModal: React.FC = () => {
  const {
    syncTargetSong,
    setSyncTargetSong,
    previewingSongId,
    previewSongCandidate,
    stopPreviewCandidate,
    applySongSync,
    themeColors,
    hapticFeedback,
  } = useMusic();

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Song[]>([]);
  const [resolvedMeta, setResolvedMeta] = useState<{ title: string; artist: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);

  const runSearch = async (customQuery?: string, useSongMeta = false) => {
    if (!syncTargetSong) return;
    setIsLoading(true);
    try {
      const vidId =
        syncTargetSong.youtubeId ||
        (syncTargetSong.id.startsWith('yt-') ? syncTargetSong.id.replace('yt-', '') : '');
      const result = await OnlineMusicService.fetchSyncCandidates({
        query: customQuery !== undefined ? customQuery : useSongMeta ? '' : query,
        title: syncTargetSong.title,
        artist: syncTargetSong.artist,
        vidId,
        limit: 18,
      });
      setCandidates(result.candidates);
      if (result.resolvedMeta) {
        setResolvedMeta({ title: result.resolvedMeta.title, artist: result.resolvedMeta.artist });
      }
      if (useSongMeta && result.queryUsed) {
        setQuery(result.queryUsed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!syncTargetSong) {
      setCandidates([]);
      setResolvedMeta(null);
      return;
    }

    const hasKnownArtist =
      syncTargetSong.artist &&
      syncTargetSong.artist.toLowerCase() !== 'unknown artist' &&
      syncTargetSong.artist.toLowerCase() !== 'unknown';

    const initialQ = hasKnownArtist
      ? `${syncTargetSong.title} ${syncTargetSong.artist}`.trim()
      : syncTargetSong.title;

    setQuery(initialQ);
    runSearch(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTargetSong?.id]);

  if (!syncTargetSong) return null;

  const handleClose = () => {
    hapticFeedback();
    stopPreviewCandidate();
    setSyncTargetSong(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback();
    stopPreviewCandidate();
    runSearch(query, false);
  };

  const handleQuickFilter = (qText: string) => {
    hapticFeedback();
    stopPreviewCandidate();
    setQuery(qText);
    runSearch(qText, false);
  };

  const handleSelectCandidate = async (candidate: Song) => {
    setIsApplyingId(candidate.id);
    try {
      await applySongSync(syncTargetSong, candidate, true);
      setSyncTargetSong(null);
    } finally {
      setIsApplyingId(null);
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isUnknownArtist =
    !syncTargetSong.artist ||
    syncTargetSong.artist.toLowerCase() === 'unknown artist' ||
    syncTargetSong.artist.toLowerCase() === 'unknown';

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] border border-white/15 animate-in slide-in-from-bottom-6 duration-200 my-auto"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="p-2 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ backgroundColor: themeColors.accent }}
            >
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold truncate text-white leading-tight">
                Sync Track Manually
              </h2>
              <p className="text-[11px] opacity-60 truncate">
                Test candidates & select the exact match to rewrite this song
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white shrink-0"
            aria-label="Close manual sync"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Mismatched / Original Song Summary */}
        <div className="mt-3 p-3 rounded-2xl bg-black/30 border border-white/10 flex items-center gap-3 shrink-0">
          <img
            src={syncTargetSong.thumbnailUrl}
            alt={syncTargetSong.title}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{syncTargetSong.title}</div>
            <div className="text-[11px] flex items-center gap-1.5 mt-0.5 truncate">
              {isUnknownArtist ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  Unknown Artist
                  {resolvedMeta?.artist && resolvedMeta.artist !== 'Unknown Artist'
                    ? ` (Detected: ${resolvedMeta.artist})`
                    : ''}
                </span>
              ) : (
                <span className="opacity-70 truncate">Current artist: {syncTargetSong.artist}</span>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar + Quick Filters */}
        <form onSubmit={handleSearchSubmit} className="mt-3 space-y-2 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search song name, artist, or cover..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50 shrink-0"
              style={{ backgroundColor: themeColors.accent }}
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => handleQuickFilter(syncTargetSong.title)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-medium whitespace-nowrap transition"
            >
              Title Only
            </button>
            {!isUnknownArtist && (
              <button
                type="button"
                onClick={() =>
                  handleQuickFilter(`${syncTargetSong.title} ${syncTargetSong.artist}`.trim())
                }
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-medium whitespace-nowrap transition"
              >
                Title + Artist
              </button>
            )}
            <button
              type="button"
              onClick={() => handleQuickFilter(`${syncTargetSong.title} cover`)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-medium whitespace-nowrap transition"
            >
              Cover Version
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter(`${syncTargetSong.title} official audio`)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-[11px] font-medium whitespace-nowrap transition"
            >
              Official Audio
            </button>
          </div>
        </form>

        {/* Candidate Results List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
              <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: themeColors.accent }} />
              <div className="text-xs font-medium">Searching matching tracks...</div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
              <Search className="w-7 h-7 mb-2 opacity-50" />
              <div className="text-xs font-medium">No candidates found</div>
              <div className="text-[11px] opacity-70 mt-1">
                Try editing the search box above (e.g. include artist or cover name)
              </div>
            </div>
          ) : (
            candidates.map((cand) => {
              const isPreviewing = previewingSongId === cand.id;
              const isApplying = isApplyingId === cand.id;
              return (
                <div
                  key={cand.id}
                  className={`flex items-center justify-between gap-2.5 p-2.5 rounded-2xl border transition ${
                    isPreviewing
                      ? 'bg-white/15 border-emerald-400/50'
                      : 'bg-black/30 hover:bg-white/10 border-white/10'
                  }`}
                >
                  {/* Candidate Thumbnail & Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-black/50">
                      <img
                        src={cand.thumbnailUrl}
                        alt={cand.title}
                        className="w-full h-full object-cover"
                      />
                      {isPreviewing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate leading-tight">
                        {cand.title}
                      </div>
                      <div className="text-[11px] opacity-75 truncate mt-0.5">
                        {cand.artist}
                        {cand.album ? ` · ${cand.album}` : ''}
                      </div>
                      <div className="text-[10px] opacity-50 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{formatDuration(cand.duration)}</span>
                        <span>·</span>
                        <span>{cand.source === 'stream' ? '320kbps Direct' : 'YouTube Track'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Test Play & Select Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => previewSongCandidate(cand)}
                      className={`h-9 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
                        isPreviewing
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                      title={isPreviewing ? 'Stop preview' : 'Test play this track'}
                    >
                      {isPreviewing ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Test</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() => handleSelectCandidate(cand)}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold text-white flex items-center gap-1 shadow-md transition active:scale-95 disabled:opacity-50"
                      style={{ backgroundColor: themeColors.accent }}
                      title="Select & rewrite song with this match"
                    >
                      {isApplying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
