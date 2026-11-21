<div align="center">

<img src="public/pwa-192x192.png" alt="Muzika Logo" width="110" height="110" />

# Muzika

**A fast, mobile-first Progressive Web App (PWA) music player inspired by the [RiPlay](https://github.com/fast4x/RiPlay) architecture.**  
Ad-free YouTube Music streaming, IndexedDB offline caching, synchronized lyrics, a real-time 5-band Web Audio DSP equalizer, multi-queue workspaces, and direct `.db` / `.backup` migration — running natively on Android, iOS, and Desktop browsers.

[![Version](https://img.shields.io/badge/Version-v2.8.9-DE6433?style=for-the-badge)](src/version.ts)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-Installable-1DB954?style=for-the-badge&logo=googlechrome&logoColor=white)](vite.config.ts)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)

[Quick Start](#-quick-start) • [Features](#-features) • [Offline & Audio Engine](#-audio-engine--offline-caching) • [RiPlay Database Import](#-riplay--rimusic-database-import) • [Docker Deployment](#-docker--self-hosting)

</div>

---

## ✨ Features

| Category | Highlights |
| :--- | :--- |
| **🎵 Dual-Engine Playback** | Resolves direct high-fidelity audio streams via YouTube Music (`youtubei.js` + `@distube/ytdl-core`) with automatic YouTube IFrame fallback and zero-gap track switching. |
| **📥 True Offline Caching** | Stores audio blobs **and** album cover artwork inside **IndexedDB** with configurable retention (`Forever`, `30d`, `14d`, `7d`), Persistent Storage Eviction Guard, batch playlist caching, and direct MP3 export. |
| **🔄 Auto & Manual Track Sync** | Fix mismatched tracks from searches or `.db` imports in one tap — **Auto-Sync** picks the highest-confidence match, or open **Manual Sync** to preview candidates live before rewriting across playlists, history, and queues. |
| **📞 Call & Focus Handling** | Keeps background & screen-off playback alive on mobile and automatically pauses during incoming calls or external audio interruptions, resuming once finished (toggleable in Settings). |
| **🎛️ 5-Band Web Audio DSP EQ** | Hardware-accelerated 5-band graphic equalizer (`60Hz` – `14kHz`), Bass Boost, Virtualizer, Loudness Enhancer, sound profiles, and real-time audio spectrum visualizer canvas. |
| **📑 Multi-Queue Workspaces** | Maintain independent named listening queues (e.g., *Main*, *Workout*, *Focus*) with swipe-right to queue, drag/reorder, play-next, and instant state switching. |
| **🎤 Synced Lyrics** | Time-synced scrolling lyrics powered by **LRCLIB** with tap-to-seek and built-in LRC fallback support. |
| **🗃️ RiPlay / RiMusic Importer** | In-browser **SQLite WASM (`sql.js`)** parser extracts songs, playlists with original track order, liked tracks, play history, artists, albums, and blacklists directly from `.db` / `.backup` files. |
| **🎨 6 OLED & Adaptive Themes** | **RiPlay Classic**, **AMOLED Pitch Black**, **Emerald Neon**, **Cyber Cyan**, **Violet Dream**, and **Dynamic Art** (extracts dominant colors from current track artwork). |
| **📊 Personal Rewind** | Listening stats, rank progression badges, top artists, most-played songs, and offline backup export/import (`.json`). |

---

## 🎧 Audio Engine & Offline Caching

- **Background & Screen-Off Playback**: Uses MediaSession API lock-screen controls, Screen Wake Lock, WebAudio focus carrier, and visibility guards to keep music playing smoothly when locked or minimized.
- **Auto-Pause & Resume on Calls**: Detects telecom/OS focus interruptions and WebAudio `'interrupted'` state transitions (default **ON** in *Settings → Audio Engine*) so music yields cleanly to calls and resumes automatically afterward.
- **Offline Cover & Stream Hydration**: Both audio streams and cover images (`artworkBlob`) are cached locally in IndexedDB, keeping full-screen player artwork and lock-screen controls sharp even in Airplane Mode.

---

## 🗃️ RiPlay / RiMusic Database Import

Already using **RiPlay** or **RiMusic** on Android? You can migrate your entire library without uploading your data to any external server:

1. Open **Settings → RiPlay SQLite Database** (or tap the import action in Library).
2. Select your exported `.db`, `.sqlite`, or `.backup` file.
3. **Muzika** parses the Room SQLite schema directly on-device via `sql.js` WebAssembly and imports your playlists, liked songs, listening history, artists, albums, and blacklists.
4. Use **Sync Song** (long-press or `⋮` menu on any track) if any imported track needs re-matching to a verified stream.

---

## 🎨 Built-in Themes

| Theme | Primary Accent | Base Surface |
| :--- | :--- | :--- |
| **RiPlay Classic (Coral)** | `#DE6433` | `#16171d` |
| **AMOLED Pitch Black** | `#DE6433` | `#000000` |
| **Emerald Neon** | `#1DB954` | `#121212` |
| **Cyber Cyan** | `#06B6D4` | `#0b1329` |
| **Violet Dream** | `#A855F7` | `#130d24` |
| **Dynamic Art (Adaptive)** | Artwork-driven | `#08080a` |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** `>= 20`
- **npm** (or **bun**)

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/muzika.git
cd muzika
npm install
```

### 2. Run in Development

Starts the Express backend and Vite middleware server on port **3000**:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 3. Production Build & Start

```bash
npm run build
npm start
```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts development server (`tsx server.ts`) with Vite HMR disabled for stable mobile testing |
| `npm run build` | Builds the Vite + PWA client bundle (`dist/`) and bundles `dist/server.js` |
| `npm start` | Runs the compiled production server (`node dist/server.js`) |
| `npm run lint` | Runs strict TypeScript type-checking (`tsc --noEmit`) |

---

## 🐳 Docker & Self-Hosting

Muzika ships with a production multi-stage [`Dockerfile`](Dockerfile) and healthcheck endpoint (`/api/health`):

```bash
docker build -t muzika:latest .
docker run -d -p 3000:80 --name muzika --restart unless-stopped muzika:latest
```

Verify the running instance:

```bash
curl http://localhost:3000/api/health
```

> **Note:** Check `.env.example` if configuring optional environment variables such as `APP_URL` or `PORT`. All streaming, search, and caching features work out of the box with zero API keys required.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion
- **Audio & Media**: Web Audio API (5-band DSP EQ & Canvas Visualizer), HTML5 Audio, MediaSession API, YouTube IFrame API
- **Offline & Storage**: IndexedDB (audio + artwork blobs), Service Worker (`vite-plugin-pwa`), `localStorage`, `sql.js` (SQLite WASM)
- **Backend**: Node.js, Express, `youtubei.js`, `@distube/ytdl-core`
- **Lyrics**: LRCLIB API

---

## 📂 Project Structure

```text
├── public/                 # PWA icons, manifest assets, sql-wasm.wasm
├── src/
│   ├── components/
│   │   ├── common/         # Modals, swipeable track rows, sync & action sheets
│   │   ├── player/         # Full-screen player, mini player, EQ, queue, lyrics
│   │   └── screens/        # Home, Explore, Search, Library, Rewind, Settings
│   ├── context/            # MusicContext & PlaybackTimeContext state architecture
│   ├── hooks/              # PWA install & custom hooks
│   ├── services/           # YouTube, OnlineMusic, Lyrics, OfflineCache, SQLite importer
│   ├── styles/             # Theme presets & Tailwind styling
│   ├── utils/              # WebAudio EQ, WakeLock/AudioFocus, palette extractor, PWA updater
│   ├── sw.ts               # Custom Service Worker
│   └── version.ts          # Release metadata
├── server.ts               # Express API & stream proxy + Vite/static server
├── Dockerfile              # Multi-stage production container build
└── vite.config.ts          # Vite + VitePWA configuration
```

---

## 🔒 Privacy & Credits

- **Zero Tracking**: Playlists, history, listening statistics, cached tracks, and SQLite imports remain strictly inside your browser's local storage and IndexedDB.
- **Credits**: Inspired by the design and architecture of **[RiPlay](https://github.com/fast4x/RiPlay)** by `fast4x`, with lyrics powered by **[LRCLIB](https://lrclib.net/)**.
- **License**: Released under the **GNU General Public License v3.0 (GPL-3.0)**.
