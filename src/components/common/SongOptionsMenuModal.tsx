import React from 'react';
import { useMusic } from '../../context/MusicContext';
import {
  X,
  CornerDownRight,
  ListPlus,
  Plus,
  Heart,
  DownloadCloud,
  CheckCircle2,
  User,
  Disc,
  Share2,
  Ban,
} from 'lucide-react';

export const SongOptionsMenuModal: React.FC = () => {
  const {
    songOptionsMenuTarget,
    setSongOptionsMenuTarget,
    setAddToPlaylistTargetSong,
    playNextInQueue,
    addToQueue,
    toggleLike,
    isLiked,
    isSongCached,
    cacheSong,
    removeCachedSong,
    setSelectedArtistId,
    setSelectedAlbum,
    addToBlacklist,
    themeColors,
    hapticFeedback,
    showToast,
  } = useMusic();

  if (!songOptionsMenuTarget) return null;

  const song = songOptionsMenuTarget.song;
  const liked = isLiked(song.id);
  const cached = isSongCached(song.id);

  const handleClose = () => {
    hapticFeedback();
    setSongOptionsMenuTarget(null);
  };

  const handlePlayNext = () => {
    hapticFeedback();
    playNextInQueue(song);
    showToast(`Playing Next: "${song.title}"`);
    handleClose();
  };

  const handleAddToQueue = () => {
    hapticFeedback();
    addToQueue(song);
    showToast(`Added "${song.title}" to Queue`);
    handleClose();
  };

  const handleOpenAddToPlaylist = () => {
    hapticFeedback();
    handleClose();
    setTimeout(() => {
      setAddToPlaylistTargetSong(song);
    }, 50);
  };

  const handleToggleLike = () => {
    hapticFeedback();
    toggleLike(song);
    showToast(liked ? `Removed from Liked Songs` : `Saved to Liked Songs`);
    handleClose();
  };

  const handleToggleCache = async () => {
    hapticFeedback();
    if (cached) {
      await removeCachedSong(song.id);
      showToast(`Removed "${song.title}" from offline storage`);
    } else {
      showToast(`Downloading "${song.title}" for offline playback...`);
      await cacheSong(song);
      showToast(`Cached "${song.title}" offline`);
    }
    handleClose();
  };

  const handleGoToArtist = () => {
    hapticFeedback();
    setSelectedArtistId(song.artistId || song.artist);
    handleClose();
  };

  const handleGoToAlbum = () => {
    hapticFeedback();
    if (song.album) {
      setSelectedAlbum({
        id: song.albumId || `album-${song.album}`,
        title: song.album,
        artist: song.artist,
        year: song.year || new Date().getFullYear(),
        coverUrl: song.thumbnailUrl,
        songs: [song],
      });
    }
    handleClose();
  };

  const handleShare = () => {
    hapticFeedback();
    const shareUrl = song.youtubeId
      ? `https://music.youtube.com/watch?v=${song.youtubeId}`
      : window.location.href;
    if (navigator.share) {
      navigator.share({ title: song.title, text: `Check out ${song.title} by ${song.artist}`, url: shareUrl }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showToast('Track link copied to clipboard!');
    }
    handleClose();
  };

  const handleBlacklist = () => {
    hapticFeedback();
    addToBlacklist(song.id, song.title, 'song');
    showToast(`Blacklisted "${song.title}"`);
    handleClose();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border border-white/10 animate-in slide-in-from-bottom-6 duration-200"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        {/* Header with Song Thumbnail */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 shadow-md">
              <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold truncate leading-tight text-white">{song.title}</div>
              <div className="text-xs opacity-60 truncate mt-0.5">{song.artist}</div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-1 text-xs font-medium max-h-80 overflow-y-auto pr-1">
          <button
            onClick={handlePlayNext}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <CornerDownRight className="w-4 h-4 text-blue-400" />
            <span>Play Next in Queue</span>
          </button>

          <button
            onClick={handleAddToQueue}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <ListPlus className="w-4 h-4 text-emerald-400" />
            <span>Add to Queue</span>
          </button>

          <button
            onClick={handleOpenAddToPlaylist}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add to Playlist</span>
          </button>

          <button
            onClick={handleToggleLike}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500' : 'text-white/60'}`} />
            <span>{liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
          </button>

          <button
            onClick={handleToggleCache}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            {cached ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Remove Offline Storage</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4 text-cyan-400" />
                <span>Download for Offline Listening</span>
              </>
            )}
          </button>

          <button
            onClick={handleGoToArtist}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <User className="w-4 h-4 text-purple-400" />
            <span>Go to Artist ({song.artist})</span>
          </button>

          {song.album && (
            <button
              onClick={handleGoToAlbum}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
            >
              <Disc className="w-4 h-4 text-cyan-400" />
              <span>Go to Album ({song.album})</span>
            </button>
          )}

          <button
            onClick={handleShare}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition"
          >
            <Share2 className="w-4 h-4 text-orange-400" />
            <span>Share Track Link</span>
          </button>

          <button
            onClick={handleBlacklist}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition text-red-400"
          >
            <Ban className="w-4 h-4" />
            <span>Blacklist Track</span>
          </button>
        </div>
      </div>
    </div>
  );
};
