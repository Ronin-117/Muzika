import React, { useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { X, Plus, Check, ListMusic, Music } from 'lucide-react';

export const AddToPlaylistModal: React.FC = () => {
  const {
    addToPlaylistTargetSong,
    setAddToPlaylistTargetSong,
    playlists,
    addToPlaylist,
    createPlaylist,
    themeColors,
    hapticFeedback,
  } = useMusic();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!addToPlaylistTargetSong) return null;

  const handleClose = () => {
    hapticFeedback();
    setAddToPlaylistTargetSong(null);
    setShowCreateForm(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newPl = createPlaylist(newTitle.trim(), newDesc.trim());
    addToPlaylist(newPl.id, addToPlaylistTargetSong);
    handleClose();
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border border-white/10 animate-in slide-in-from-bottom-6 duration-200"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ListMusic className="w-5 h-5" style={{ color: themeColors.accent }} />
            <h2 className="text-base font-extrabold">Add to Playlist</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Song Info Card */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
            <img
              src={addToPlaylistTargetSong.thumbnailUrl}
              alt={addToPlaylistTargetSong.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate leading-tight">
              {addToPlaylistTargetSong.title}
            </div>
            <div className="text-xs opacity-60 truncate mt-0.5">
              {addToPlaylistTargetSong.artist}
            </div>
          </div>
        </div>

        {/* Action: Create New Playlist inline form */}
        {showCreateForm ? (
          <form onSubmit={handleCreateAndAdd} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
              New Playlist Title
            </div>
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Chill Beats 2026"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs focus:outline-none"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (Optional)"
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: themeColors.accent }}
              >
                Save & Add
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 flex items-center justify-between cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
                style={{ backgroundColor: themeColors.accent }}
              >
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Create New Playlist</span>
            </div>
          </button>
        )}

        {/* Existing Playlists List */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {playlists.length === 0 ? (
            <div className="p-4 text-center text-xs opacity-50 bg-white/5 rounded-2xl">
              No saved playlists yet. Create one above to get started!
            </div>
          ) : (
            playlists.map((pl) => {
              const containsSong = pl.songs.some((s) => s.id === addToPlaylistTargetSong.id);
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    addToPlaylist(pl.id, addToPlaylistTargetSong);
                    handleClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition border border-white/5 cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-md bg-white/5 flex items-center justify-center">
                      {pl.coverUrl ? (
                        <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-5 h-5 opacity-40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate text-white">{pl.title}</div>
                      <div className="text-[10px] opacity-50 truncate">
                        {pl.songs.length} tracks {pl.description ? `• ${pl.description}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {containsSong ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Added
                      </span>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white"
                        style={{ backgroundColor: themeColors.accent }}
                      >
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
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
