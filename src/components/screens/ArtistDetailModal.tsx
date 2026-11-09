import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { INITIAL_ARTISTS } from '../../data/mockCatalog';
import { ArrowLeft, Play, Users, Heart, UserPlus, Check } from 'lucide-react';

export const ArtistDetailModal: React.FC = () => {
  const {
    selectedArtistId,
    setSelectedArtistId,
    playSong,
    themeColors,
    toggleLike,
    isLiked,
    hapticFeedback,
    importedArtists,
    savedArtists,
    toggleFollowArtist,
    isArtistFollowed,
  } = useMusic();

  if (!selectedArtistId) return null;

  const artist =
    INITIAL_ARTISTS.find((a) => a.id === selectedArtistId) ||
    importedArtists.find((a) => a.id === selectedArtistId) ||
    savedArtists.find((a) => a.id === selectedArtistId);
  if (!artist) return null;

  const isFollowed = isArtistFollowed(artist.id);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200 pb-44"
      style={{ backgroundColor: themeColors.background0, color: themeColors.text }}
    >
      {/* Top Bar */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => {
              hapticFeedback();
              setSelectedArtistId(null);
            }}
            className="p-2 rounded-full hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold truncate">{artist.name}</span>
        </div>

        <button
          onClick={() => toggleFollowArtist(artist)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
            isFollowed
              ? 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
              : 'text-white shadow-md active:scale-95'
          }`}
          style={{ backgroundColor: !isFollowed ? themeColors.accent : undefined }}
        >
          {isFollowed ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Follow</span>
            </>
          )}
        </button>
      </div>

      <div className="px-4 max-w-md mx-auto w-full pt-2 space-y-5">
        {/* Banner & Avatar */}
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
          <div className="h-36 w-full overflow-hidden relative">
            <img
              src={artist.bannerUrl || artist.thumbnailUrl}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>

          <div className="p-4 pt-0 -mt-10 relative z-10 flex items-end gap-3">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 shadow-2xl shrink-0">
              <img src={artist.thumbnailUrl} alt={artist.name} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-xl font-black truncate">{artist.name}</h1>
              <div className="flex items-center gap-1.5 text-xs opacity-60">
                <Users className="w-3.5 h-3.5" />
                <span>{artist.subscribers || '1M'} Monthly Listeners</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {artist.bio && (
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs opacity-75 leading-relaxed">
            {artist.bio}
          </div>
        )}

        {/* Top Songs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Popular Songs</h2>
            <button
              onClick={() => {
                hapticFeedback();
                if (artist.topSongs.length > 0) playSong(artist.topSongs[0], artist.topSongs);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Play className="w-3.5 h-3.5 fill-white" /> Play All
            </button>
          </div>

          <div className="space-y-1.5">
            {artist.topSongs.map((song, idx) => {
              const liked = isLiked(song.id);
              return (
                <div
                  key={song.id}
                  onClick={() => {
                    hapticFeedback();
                    playSong(song, artist.topSongs);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono opacity-40 w-4 text-center">{idx + 1}</span>
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate leading-tight">{song.title}</div>
                      <div className="text-xs opacity-60 truncate">{song.album || artist.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleLike(song)}
                      className="p-2 rounded-full hover:bg-white/10 transition"
                    >
                      <Heart
                        className={`w-4 h-4 transition ${
                          liked ? 'fill-rose-500 text-rose-500' : 'text-white/40'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
