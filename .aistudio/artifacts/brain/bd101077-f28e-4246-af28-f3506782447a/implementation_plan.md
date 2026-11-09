# Full-Length Background & Screen-Off Playback Architecture

Comprehensive plan to replace 30-second promotional samples with guaranteed full-length audio playback that remains active when the mobile screen is turned off, the app is backgrounded, or when running offline.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Why 30-Second Clips Happened**: The previous audio resolver used iTunes preview URLs, which are promotional 30-second song clips starting midway through the track. Meanwhile, YouTube iframe fallbacks provided full-length video but mobile Android/Chrome strictly kills background execution of iframes the second the screen is turned off.
>
> **The Solution**: Full-length songs require an HTML5 native `<audio>` element supplied by a full-length direct audio stream. We will mount a full-stack Express server proxy (`/api/stream`) and multi-source stream resolver that pipes complete, unclipped audio streams (from 0:00 to end) directly into the app's native audio engine.

- **Audio Engine Decision**: HTML5 `<audio>` supplied by a full-length server-side stream proxy (`/api/stream?id=...`) and direct full-audio resolvers.
- **Offline Storage**: Cache the full audio stream in IndexedDB so previously played tracks can play anywhere without internet.
- **Session Rewind**: Persist the exact second, track, and queue in local storage to resume effortlessly upon reopening the app.

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades Muzika from short 30-second previews and fragile iframes to full-length audio streaming (3 to 6+ minutes) that plays seamlessly with the mobile screen locked or turned off.
- **Target Audience / Mobile Context**: Mobile PWA users running Muzika from their home screen who want full uninterrupted music listening while walking, commuting, working out, or running other apps.
- **Key Value**: 100% full songs from start to finish, guaranteed mobile lockscreen controls, persistent notifications that do not vanish when paused, and real offline caching with accurate megabyte sizes.

---

## 2. User Experience & Visual Design

- **Audio Stream Loading & Indicators**:
  - Mini Player and Full Player show true song duration (e.g., `3:45`, `4:12`) from start `0:00` without clipping.
  - Active audio engine badge displays "Full Audio • Background Ready" with real bitrate indicator.
  - Seeking and scrubbing works across the entire duration of the track.
- **Lockscreen & Notification Bar Experience**:
  - Android MediaSession displays complete song title, artist, album art, and accurate progress bar.
  - Lockscreen controls (Play, Pause, Skip, Rewind 10s) stay persistent even when paused.
  - Notification tray never disappears on pause.
- **Offline Library & Cache Management**:
  - Cached tracks show actual file sizes (e.g., `4.8 MB`, `6.2 MB`).
  - One-tap download icon caches the complete track for offline mode.
  - Auto-caching saves played tracks in the background.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Express Server Proxy (`server.ts` + `/api/stream`)**:
  - *Chosen Approach*: Convert dev setup to full-stack Express running on port 3000 (`tsx server.ts`) with Vite middlewares in development. The Express server provides `/api/stream` and `/api/resolve` endpoints that extract and stream full audio streams without client-side CORS or mobile iframe limitations.
  - *Why*: Browsers block cross-origin scraping, and mobile OS freezes iframes. A server proxy streams clean chunks with proper `Content-Type: audio/webm` or `audio/mp4` directly into HTML5 `<audio>`.
  - *Alternatives Considered*: Third-party public scrapers (Piped/Invidious) were tested and found to be unreliable or shut down; client-only iframes cannot bypass mobile OS screen-off throttling.

- **Decision 2: Full-Length Catalog & Multi-Source Fallbacks**:
  - *Chosen Approach*: Equip catalog tracks and fallback collections with verified full-length audio URLs (archive, public CDN, and full streaming feeds) so initial songs play full-length out of the box with zero setup.
  - *Why*: Guarantees instant instant-play capability even if an external stream resolver experiences high latency.

- **Decision 3: Chunked Full-Song IndexedDB Caching**:
  - *Chosen Approach*: As the full song streams through HTML5 `<audio>`, cache the full audio blob into IndexedDB with its true byte count.
  - *Why*: Eliminates repeat network requests and allows full-length offline playback when the device has no internet connection.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Muzika Mobile PWA                             │
│                                                                        │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │   UI Components       │            │  Persistent Audio Engine    │  │
│  │ (MiniPlayer / Player) │ ─────────> │  <audio playsinline>        │  │
│  └───────────────────────┘            └──────────────┬──────────────┘  │
│             │                                        │                 │
│             ▼                                        ▼                 │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │ Storage & Rewind      │            │ Android MediaSession        │  │
│  │ (muzika_last_playback)│            │ (Persistent Lockscreen Tray)│  │
│  └───────────────────────┘            └─────────────────────────────┘  │
│             │                                        ▲                 │
│             ▼                                        │                 │
│  ┌───────────────────────┐                           │                 │
│  │ IndexedDB Cache (v2)  │ ──────────────────────────┘                 │
│  │ (Full Audio Blobs)    │ (Offline source)                            │
│  └───────────────────────┘                                             │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼ HTTP Stream Request
┌────────────────────────────────────────────────────────────────────────┐
│                Full-Stack Express Server (Port 3000)                   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ GET /api/stream?id=:id                                            │  │
│  │ Resolves & streams full-length audio chunks with range headers   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Full Audio Sources & Public Media CDNs (SoundCloud / Direct / YT)│  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Implementation Steps

1. **Full-Stack Express Server Setup (`server.ts`)**:
   - Create Express entry point with Vite middleware on port 3000 (`"dev": "tsx server.ts"`).
   - Implement `/api/stream` endpoint with HTTP Range header support for seeking and uninterrupted background audio.
   - Implement `/api/resolve` to return full-length audio stream metadata for any track.

2. **Catalog & Stream Upgrade**:
   - Update `INITIAL_SONGS` and mock playlists with full-length audio stream sources (3:00 - 5:00 minutes).
   - Wire `OnlineMusicService` to query `/api/stream` and full streaming sources instead of 30-second iTunes preview clips.

3. **Audio Engine Optimization in `MusicContext.tsx`**:
   - Route all playback through the persistent HTML5 `<audio>` engine.
   - Maintain AudioFocus and background playback wake lock with screen locked.
   - Keep MediaSession notification card alive in paused state.

4. **Full-Length Offline Cache (`offlineCacheService.ts`)**:
   - Download and store complete audio streams (3 - 7 MB per full track).
   - Ensure accurate megabyte counters in the Library screen.

5. **Verification**:
   - Verify full song playback length from 0:00 to 3:00+ minutes.
   - Verify Android lockscreen notification persistence and background screen-off playback.
