# Dual-Engine Background Audio Retention & Full-Length Offline Caching

Fix mobile background/screen-off playback throttling by binding MediaSession and hardware AudioFocus to a continuous native HTML5 carrier engine, and ensure offline song downloads store full-length audio tracks instead of truncated preview clips.

## User Review & Critical Decisions

> [!IMPORTANT]
> Architectural strategy for background audio and device storage:
> - **Background Audio Retention**: Use a dual-engine carrier bridge. The native HTML5 audio element retains Android & iOS hardware `AUDIOFOCUS_GAIN` and MediaSession notifications. When the YouTube iframe element pauses due to mobile OS screen-off throttling, the native HTML5 audio bridge maintains active background audio thread processing, preventing tab suspension.
> - **Full-Length Caching**: Overhaul offline song storage to fetch full-length high-fidelity audio blobs matching exact track durations (e.g. 3–6 minutes / 3–12 MB per song) into IndexedDB, removing 30-second preview clip fallbacks.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Uninterrupted Background Playback**: Allows music to keep playing seamlessly when turning off the screen, locking the mobile device, or switching to other apps.
  2. **True Full-Length Offline Library**: Downloads complete songs into IndexedDB so cached tracks play from 0:00 to the end even with zero network connection.
- **Target Audience / Persona**: Users who rely on Muzika as their daily mobile music app while walking, working out, or driving with the phone screen locked.
- **Key Value**: Zero audio dropouts on mobile screen-off and genuine full-length offline playback.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Screen-Off Background Playback**:
   - User starts playing any song from Search, Playlists, or Library.
   - User locks the phone screen or presses the power button.
   - Audio continues playing smoothly without pausing after 1–2 seconds.
   - Lock screen displays complete track metadata (Song Title, Artist, Cover Art) with functional Play/Pause, Next Track, Previous Track, and Progress Scrubbing controls.
2. **Offline Download & Playback**:
   - User taps the Download icon next to any song in Search or Playlist details.
   - The app fetches the full-length audio stream and saves the complete audio blob in IndexedDB.
   - Settings > Offline Storage displays real file size usage (e.g. `14.8 MB used • 3 songs saved`).
   - In Airplane Mode, cached songs play completely from 0:00 to the end.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Native HTML5 Audio Carrier Bridge for Screen-Off Playback**
  - *Chosen Approach*: Bind `navigator.mediaSession` directly to the native HTML5 audio element (`htmlAudioRef` / `silentKeepAliveRef`) and feed an active sub-audible carrier signal during YouTube iframe playback.
  - *Why*: Mobile OS kernels (Android & iOS) freeze JS execution inside `<iframe>` elements when the screen locks. However, native `<audio>` elements with registered MediaSession handlers are assigned high-priority foreground media process status, keeping the audio pipeline open.
- **Decision 2: Strict Full-Length Storage Validation**
  - *Chosen Approach*: Validate downloaded audio blobs in `offlineCacheService` to ensure blob size > 1MB and duration matches track metadata before marking as cached.
  - *Why*: Prevents short 30-second preview files from being saved as cached tracks.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Muzika Player Context                         │
│                                                                        │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ YouTube Iframe Engine         │   │ Native HTML5 Audio Bridge    │  │
│  │ (Active when app is visible)  │   │ (Active background carrier)  │  │
│  └───────────────┬───────────────┘   └──────────────┬───────────────┘  │
│                  │                                  │                  │
│                  ▼                                  ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Hardware AudioFocus & MediaSession API                           │  │
│  │ - Lockscreen Album Art, Title, Artist, Progress Bar              │  │
│  │ - Prev/Next/Play/Pause Hardware Media Keys                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 IndexedDB Full-Length Offline Storage                  │
│  - Track Record: Song Metadata + Synced Lyrics                         │
│  - Full Audio Blob (3-12 MB per full track)                            │
│  - High-Res Album Art Blob                                             │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Implementation Steps

1. **`src/utils/audioWakeLock.ts`**:
   - Enhance `AudioFocusManager` to maintain active WebAudio oscillator buffer during screen lock.
2. **`src/context/MusicContext.tsx`**:
   - Update `onStateChange` for YouTube player: when `state === 2` occurs on screen hide, do not pause `mediaSession` or cancel audio focus; keep the HTML5 carrier engine playing.
   - Sync MediaSession position state continuously with currentTime.
3. **`src/services/offlineCacheService.ts`**:
   - Overhaul `cacheSong` to download full-length audio stream blobs and verify blob size > 1 MB.
   - Update storage calculation to reflect exact bytes saved.
4. **Verification**:
   - Build and lint via `compile_applet` and `lint_applet`.
   - Verify server health and test background audio retention and caching.
