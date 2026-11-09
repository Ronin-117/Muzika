import { Song, Artist, Album, Playlist } from '../types/music';

export const INITIAL_SONGS: Song[] = [
  {
    id: 'yt-4NRXx6U8ABQ',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artistId: 'art-the-weeknd',
    album: 'After Hours',
    albumId: 'alb-after-hours',
    duration: 227,
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=4NRXx6U8ABQ',
    youtubeId: '4NRXx6U8ABQ',
    genre: 'Synthpop',
    year: 2020,
    playCount: 42,
    lyrics: `[00:00.00] Yeah
[00:14.20] I've been tryna call
[00:16.80] I've been on my own for long enough
[00:20.50] Maybe you can show me how to love, maybe
[00:28.10] I'm going through withdrawals
[00:30.80] You don't even have to do too much
[00:34.40] You can turn me on with just a touch, baby
[00:41.50] I look around and Sin City's cold and empty
[00:48.50] No one's around to judge me
[00:52.20] I can't see clearly when you're gone
[00:56.50] I said, ooh, I'm blinded by the lights
[01:03.40] No, I can't sleep until I feel your touch
[01:10.50] I said, ooh, I'm drowning in the night
[01:17.30] Oh, when I'm like this, you're the one I trust`,
  },
  {
    id: 'yt-kXYiU_JCYtU',
    title: 'Numb',
    artist: 'Linkin Park',
    artistId: 'art-linkin-park',
    album: 'Meteora',
    albumId: 'alb-meteora',
    duration: 218,
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=kXYiU_JCYtU',
    youtubeId: 'kXYiU_JCYtU',
    genre: 'Alternative Rock',
    year: 2003,
    playCount: 35,
    lyrics: `[00:00.00] (Music intro)
[00:21.00] I'm tired of being what you want me to be
[00:24.50] Feeling so faithless, lost under the surface
[00:29.80] Don't know what you're expecting of me
[00:33.20] Put under the pressure of walking in your shoes
[00:38.00] Caught in the undertow, just caught in the undertow
[00:41.80] Every step that I take is another mistake to you
[00:47.00] Caught in the undertow, just caught in the undertow
[00:51.00] I've become so numb, I can't feel you there
[00:56.20] Become so tired, so much more aware
[01:00.60] I'm becoming this, all I want to do
[01:05.10] Is be more like me and be less like you`,
  },
  {
    id: 'yt-OPf0YbXqDm0',
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    artistId: 'art-bruno-mars',
    album: 'Uptown Special',
    duration: 270,
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=OPf0YbXqDm0',
    youtubeId: 'OPf0YbXqDm0',
    genre: 'Funk Pop',
    year: 2014,
    playCount: 29,
    lyrics: `[00:00.00] Doh
[00:01.50] Doh doh doh, doh doh doh, doh doh
[00:08.00] This hit, that ice cold
[00:10.50] Michelle Pfeiffer, that white gold
[00:13.20] This one for them hood girls
[00:15.50] Them good girls, straight masterpieces
[00:18.00] Stylin', wilin', livin' it up in the city
[00:22.50] Got Chucks on with Saint Laurent
[00:25.00] Got kiss myself, I'm so pretty
[00:27.50] I'm too hot (hot damn)
[00:30.20] Call the police and the fireman
[00:32.40] I'm too hot (hot damn)
[00:35.00] Make a dragon wanna retire, man
[00:37.40] Cause Uptown Funk gon' give it to ya`,
  },
  {
    id: 'yt-jfKfPfyJRdk',
    title: 'Lofi Chill Beats - Study & Relax',
    artist: 'Lofi Girl',
    artistId: 'art-lofi-girl',
    album: 'Midnight Study Sessions',
    duration: 176,
    thumbnailUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=jfKfPfyJRdk',
    youtubeId: 'jfKfPfyJRdk',
    genre: 'Lofi Hip Hop',
    year: 2024,
    playCount: 56,
    lyrics: `[00:00.00] (Instrumental - Soft vinyl crackle)
[00:15.00] (Mellow electric piano melody)
[00:45.00] (Relaxing drum groove kicks in)
[01:20.00] (Rain sounds in background)
[02:00.00] (Peaceful guitar harmony)
[03:10.00] (Smooth fade out)`,
  },
  {
    id: 'yt-fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artistId: 'art-queen',
    album: 'A Night at the Opera',
    duration: 349,
    thumbnailUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=fJ9rUzIMcZQ',
    youtubeId: 'fJ9rUzIMcZQ',
    genre: 'Classic Rock',
    year: 1975,
    playCount: 18,
    lyrics: `[00:00.00] Is this the real life?
[00:04.20] Is this just fantasy?
[00:08.50] Caught in a landslide, no escape from reality
[00:16.80] Open your eyes, look up to the skies and see
[00:27.50] I'm just a poor boy, I need no sympathy
[00:34.00] Because I'm easy come, easy go, little high, little low
[00:43.00] Any way the wind blows doesn't really matter to me, to me
[00:55.20] Mama, just killed a man
[01:02.50] Put a gun against his head, pulled my trigger, now he's dead`,
  },
  {
    id: 'yt-09R8_2nJtjg',
    title: 'Sugar',
    artist: 'Maroon 5',
    artistId: 'art-maroon-5',
    album: 'V',
    duration: 185,
    thumbnailUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=09R8_2nJtjg',
    youtubeId: '09R8_2nJtjg',
    genre: 'Pop',
    year: 2015,
    playCount: 22,
    lyrics: `[00:00.00] I'm hurting, baby, I'm broken down
[00:07.50] I need your loving, loving, I need it now
[00:15.00] When I'm without you, I'm something weak
[00:22.00] You got me begging, begging, I'm on my knees
[00:30.00] I don't wanna be needing your love
[00:34.20] I just wanna be deep in your love
[00:38.00] And it's killing me when you're away, ooh baby
[00:45.00] Sugar, yes please
[00:48.50] Won't you come and put it down on me?`,
  },
  {
    id: 'yt-L_LUpnjgPso',
    title: 'Resonance & Midnight Drive',
    artist: 'Synthwave Collective',
    artistId: 'art-synthwave',
    album: 'Neon Horizon',
    duration: 211,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=L_LUpnjgPso',
    youtubeId: 'L_LUpnjgPso',
    genre: 'Synthwave',
    year: 2023,
    playCount: 31,
    lyrics: `[00:00.00] (Analog Synthesizer Arpeggiation)
[00:20.00] (Heavy 80s gated reverb snare)
[00:45.00] (Cruising down the coastal highway at night)
[01:15.00] (Neon city lights reflecting on chrome)
[01:50.00] (Climactic retro synth solo)`,
  },
  {
    id: 'yt-hT_nvWreIhg',
    title: 'Counting Stars',
    artist: 'OneRepublic',
    artistId: 'art-onerepublic',
    album: 'Native',
    duration: 234,
    thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80',
    source: 'stream',
    streamUrl: '/api/stream?id=hT_nvWreIhg',
    youtubeId: 'hT_nvWreIhg',
    genre: 'Pop Rock',
    year: 2013,
    playCount: 26,
    lyrics: `[00:00.00] Lately, I've been, I've been losing sleep
[00:04.20] Dreaming about the things that we could be
[00:08.50] But baby, I've been, I've been praying hard
[00:13.00] Said no more counting dollars, we'll be counting stars
[00:22.00] Yeah, we'll be counting stars
[00:30.00] I see this life, like a swinging vine
[00:34.50] Swing my heart across the line
[00:38.20] In my face is flashing signs
[00:42.50] Seek it out and ye shall find`,
  },
];

export const INITIAL_ARTISTS: Artist[] = [
  {
    id: 'art-the-weeknd',
    name: 'The Weeknd',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
    subscribers: '36.8M',
    bio: 'Abel Makkonen Tesfaye, known professionally as The Weeknd, is a Canadian singer and songwriter known for his sonic versatility and dark lyricism.',
    topSongs: [INITIAL_SONGS[0]],
  },
  {
    id: 'art-linkin-park',
    name: 'Linkin Park',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&auto=format&fit=crop&q=80',
    subscribers: '21.5M',
    bio: 'American rock band from Agoura Hills, California, pioneering nu metal and alternative rock worldwide.',
    topSongs: [INITIAL_SONGS[1]],
  },
  {
    id: 'art-lofi-girl',
    name: 'Lofi Girl',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
    subscribers: '14.2M',
    bio: 'The worldwide soundtrack for studying, chilling, coding, and peaceful relaxation.',
    topSongs: [INITIAL_SONGS[3]],
  },
  {
    id: 'art-queen',
    name: 'Queen',
    thumbnailUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&auto=format&fit=crop&q=80',
    subscribers: '17.9M',
    bio: 'Legendary British rock band formed in London in 1970 led by Freddie Mercury, Brian May, Roger Taylor, and John Deacon.',
    topSongs: [INITIAL_SONGS[4]],
  },
];

export const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-heavy-rotation',
    title: "RiPlay Daily Mix",
    description: "Your personalized heavy rotation stream inspired by RiPlay algorithms.",
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    color: '#DE6433',
    songs: [INITIAL_SONGS[0], INITIAL_SONGS[1], INITIAL_SONGS[2], INITIAL_SONGS[3]],
    createdAt: Date.now() - 1000000,
  },
  {
    id: 'pl-chill-beats',
    title: 'Late Night Chill & Focus',
    description: 'Calm lofi, acoustic guitars, and atmospheric ambient melodies.',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    color: '#06B6D4',
    songs: [INITIAL_SONGS[3], INITIAL_SONGS[6]],
    createdAt: Date.now() - 2000000,
  },
  {
    id: 'pl-workout-fuel',
    title: 'High-Octane Workout Energy',
    description: 'Electrifying beats and rock anthems to fuel your workout sets.',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    color: '#10B981',
    songs: [INITIAL_SONGS[1], INITIAL_SONGS[2], INITIAL_SONGS[0]],
    createdAt: Date.now() - 3000000,
  },
];

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

export const INITIAL_ALBUMS: Album[] = [
  {
    id: 'alb-after-hours',
    title: 'After Hours',
    artist: 'The Weeknd',
    year: 2020,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
    songs: [INITIAL_SONGS[0]],
  },
  {
    id: 'alb-hybrid-theory',
    title: 'Hybrid Theory',
    artist: 'Linkin Park',
    year: 2000,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
    songs: [INITIAL_SONGS[1]],
  },
  {
    id: 'alb-a-night-at-the-opera',
    title: 'A Night at the Opera',
    artist: 'Queen',
    year: 1975,
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&q=80',
    songs: [INITIAL_SONGS[4]],
  },
];
