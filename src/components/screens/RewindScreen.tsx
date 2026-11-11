import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { Trophy, Clock, PlayCircle, Award, Sparkles, Flame, Play, Music } from 'lucide-react';
import confetti from 'canvas-confetti';

export const RewindScreen: React.FC = () => {
  const { userStats, themeColors, playSong, hapticFeedback, likedSongs, history } = useMusic();

  const handleCelebrate = () => {
    hapticFeedback();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [themeColors.accent, '#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
    });
  };

  // Sort top artists by play counts
  const topArtists = Object.entries(userStats.artistPlayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Use real user songs for Heavy Rotation (liked songs or history)
  const heavyRotationTracks = likedSongs.length > 0 ? likedSongs.slice(0, 4) : history.slice(0, 4);

  return (
    <div className="pb-36 pt-2 px-4 max-w-md mx-auto space-y-5">
      {/* Rewind Header & Badge */}
      <div
        className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-600/20 to-black/40 border border-amber-500/30 text-center relative overflow-hidden shadow-2xl"
      >
        <div className="relative z-10 flex flex-col items-center">
          <div
            onClick={handleCelebrate}
            className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl mb-3 cursor-pointer transition transform hover:scale-110 active:scale-95"
            style={{
              backgroundColor: themeColors.accent,
              boxShadow: `0 0 30px ${themeColors.accent}88`,
            }}
          >
            <Trophy className="w-10 h-10 animate-bounce" />
          </div>

          <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400">
            RiPlay Listener Rank
          </span>
          <h1 className="text-2xl font-black text-white mt-1">{userStats.rankBadge}</h1>
          <p className="text-xs opacity-70 mt-1 max-w-xs">
            Based on your listening duration and diversity milestones inside Muzika.
          </p>

          <button
            onClick={handleCelebrate}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition active:scale-95"
            style={{ backgroundColor: themeColors.accent }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Celebrate Milestone
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl bg-white/5"
            style={{ color: themeColors.accent }}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black font-mono">{userStats.totalMinutes}m</div>
            <div className="text-xs opacity-50">Total Time</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl bg-white/5"
            style={{ color: themeColors.accent }}
          >
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-black font-mono">{userStats.totalPlays}</div>
            <div className="text-xs opacity-50">Tracks Played</div>
          </div>
        </div>
      </div>

      {/* Top Artists Ranking */}
      {topArtists.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4" style={{ color: themeColors.accent }} />
            <h2 className="text-base font-bold">Your Top Artists</h2>
          </div>

          <div className="space-y-2">
            {topArtists.map(([artistName, count], idx) => (
              <div
                key={artistName}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: idx === 0 ? themeColors.accent : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-bold">{artistName}</span>
                </div>
                <span className="text-xs font-mono opacity-60">{count} plays</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Heavy Rotation Replay */}
      {heavyRotationTracks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4" style={{ color: themeColors.accent }} />
            <h2 className="text-base font-bold">Heavy Rotation Tracks</h2>
          </div>

          <div className="space-y-1.5">
            {heavyRotationTracks.map((song) => (
              <div
                key={song.id}
                onClick={() => {
                  hapticFeedback();
                  playSong(song, heavyRotationTracks);
                }}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate leading-tight">{song.title}</div>
                    <div className="text-[11px] opacity-60 truncate">{song.artist}</div>
                  </div>
                </div>
                <Play className="w-4 h-4 opacity-40 shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
