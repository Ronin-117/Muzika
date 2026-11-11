import { Song, Artist, Album, Playlist } from '../types/music';

// Zero hardcoded placeholders: All music, artists, albums, and playlists are fetched live or loaded from user library storage.
export const INITIAL_SONGS: Song[] = [];
export const INITIAL_ARTISTS: Artist[] = [];
export const INITIAL_PLAYLISTS: Playlist[] = [];
export const INITIAL_ALBUMS: Album[] = [];

export const MOOD_CATEGORIES = [
  { id: 'chill', label: 'Chill & Relax', icon: 'Coffee', color: 'from-amber-600 to-orange-500' },
  { id: 'workout', label: 'Workout Energy', icon: 'Dumbbell', color: 'from-red-600 to-rose-500' },
  { id: 'focus', label: 'Deep Focus', icon: 'Brain', color: 'from-blue-600 to-cyan-500' },
  { id: 'commute', label: 'Commute & Travel', icon: 'Car', color: 'from-teal-600 to-emerald-500' },
  { id: 'party', label: 'Party & Upbeat', icon: 'Sparkles', color: 'from-purple-600 to-pink-500' },
  { id: 'gaming', label: 'Gaming & Cyber', icon: 'Gamepad2', color: 'from-violet-600 to-indigo-500' },
  { id: 'sleep', label: 'Sleep & Night', icon: 'Moon', color: 'from-indigo-900 to-slate-800' },
  { id: 'romance', label: 'Romance & Love', icon: 'Heart', color: 'from-rose-600 to-pink-600' },
];
