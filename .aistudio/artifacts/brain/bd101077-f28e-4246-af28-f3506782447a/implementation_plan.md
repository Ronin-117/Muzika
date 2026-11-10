# Music-Only Search Catalog & Non-Intrusive Offline Flow

Resolve non-music YouTube video clutter by routing queries through YouTube Music's dedicated song catalog (`yt.music.search`), and fix the offline banner positioning by converting it from a floating absolute overlay into an in-flow banner that naturally pushes content downward without obscuring navigation or library tabs.

## User Review & Critical Decisions

> [!IMPORTANT]
> Key design and architectural preferences confirmed during clarification:
> - **Search Scope**: Search will strictly query and return songs, official tracks, and verified music releases via YouTube Music (`yt.music.search(query, { type: 'song' })`), eliminating gaming vlogs, podcasts, and general YouTube video clutter.
> - **Offline Banner Flow**: The offline notification is converted from a fixed floating overlay (`fixed top-14`) to an in-flow component beneath the top navigation bar (`w-full`), pushing the `<main>` content container downward so all top tabs, buttons, and filters remain completely accessible and unblocked.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Strict Music Search**: Switches `/api/search` from standard YouTube to YouTube Music's dedicated song database. Queries return genuine musical tracks, artists, album releases, and clean durations, filtering out generic non-music video content.
  2. **In-Flow Offline Notification**: Converts the offline status banner into an organic header ribbon that smoothly expands when connection drops, preserving touch targets for Library tabs ("Playlists", "Songs", "Artists", "Albums", "Offline") and search controls.
- **Target Audience / Persona**: Music enthusiasts who want a clean, ad-free mobile music player experience matching dedicated apps like RiPlay or Spotify, free from YouTube creator vlog clutter.
- **Key Value**: Accurate music discovery without non-song distractions, and uninterrupted UI interaction during network transitions.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Searching for Artists & Tracks**:
   - User types a query into the Search input (e.g., `"PewDiePie"`, `"The Weeknd"`, or `"Spider-Man"`).
   - The backend queries YouTube Music's song catalog.
   - The user sees exclusively musical tracks (e.g., official singles, soundtracks, and songs with artist credits and cover art) rather than gaming playthroughs or commentary vlogs.
2. **Offline Experience**:
   - When the user turns on Airplane Mode or loses connection, the offline ribbon smoothly slides down right beneath `<Header />`.
   - The page content (Library tabs, Playlists, song lists) is pushed downward by 36px in the normal flex layout flow.
   - All interactive buttons (e.g. "Offline Available Songs", "Playlists" tab, "Play Offline" action button) remain 100% visible and responsive to taps without any overlay occlusion.

### Visual Styling & Accessibility

- **Offline Ribbon**:
  - `bg-amber-500/15 border-b border-amber-500/30 text-amber-300 py-2 px-4 text-xs font-medium`
  - Subtle WifiOff icon with descriptive text: `"Offline Mode — Playing cached songs and local files"`.
  - Conforms to WCAG AA contrast standards and preserves the 15% mobile sticky height budget.
- **Search Result Cards**:
  - Clean unboxed metadata with typographic separators (`Artist · Duration · YouTube Music`).
  - High-resolution album square thumbnails (`rounded-lg`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: YouTube Music (`yt.music.search`) vs. YouTube Regex Filtering**
  - *Chosen Approach*: Use `yt.music.search(query, { type: 'song' })` in `server.ts` with a secondary fallback to `yt.music.search(query)` for official music releases.
  - *Why*: YouTube Music's backend natively filters and categorizes millions of songs, albums, and artists, providing accurate music metadata, album artwork, and song durations. Attempting to filter general YouTube with keyword blacklists is fragile and misses obscure songs.
  - *Fallback*: If a specific query yields no results under `{ type: 'song' }`, query `yt.music.search(query)` (which includes music videos and official audio) before falling back to title searches.
- **Decision 2: Layout-Flow Banner vs Floating Sticky Pill**
  - *Chosen Approach*: In-flow ribbon inserted in the root DOM directly between `<Header />` and `<main className="flex-1">`.
  - *Why*: Floating elements (`fixed`) inevitably overlap content on varied mobile screen sizes and safe-area insets. Using flex layout flow (`flex flex-col`) guarantees that whenever the banner is rendered, `<main>` is pushed down naturally without layout shifts or covered buttons.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                          App.tsx                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Header (Top Bar: Brand + Quick Actions)                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ In-Flow OfflineBanner (Renders conditionally, pushes main) │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ <main> Content (Library tabs, Search, Home, etc.)       │  │
│  │   - LibraryScreen (Tabs completely unblocked!)          │  │
│  │   - SearchScreen                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ MiniPlayer & Bottom Navigation                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP GET /api/search?q=...
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    server.ts (Backend)                        │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Innertube Instance (`getInnertube()`)                  │  │
│  │  yt.music.search(query, { type: 'song' })               │  │
│  │  Maps: title, artists, duration, thumbnail, youtubeId   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### Component & File Strategy

1. **`server.ts`**:
   - Update `/api/search` to call `yt.music.search(query, { type: 'song' })`.
   - Parse `musicRes.songs?.contents` extracting `id`, `title`, `artists.map(a => a.name).join(', ')`, `duration.seconds`, and high-res thumbnail.
   - Maintain in-memory caching (`searchCache`) and error logging.
2. **`src/App.tsx`**:
   - Refactor `OfflineBadge` into an in-flow `OfflineBanner`.
   - Place between `<Header />` and `<main className="flex-1 overflow-x-hidden">`.
   - Remove `fixed top-14 left-4 right-4 z-50` and replace with `w-full border-b ...` so content naturally reflows below it.
3. **Verification**:
   - Run compilation and typecheck (`compile_applet` and `lint_applet`).
   - Test search with query `"pewdiepie"` and `"blinding lights"` to verify only music tracks are returned.
   - Verify library tabs are completely unobstructed when offline.
