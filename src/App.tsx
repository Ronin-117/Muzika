import React, { useEffect, useState } from 'react';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { MiniPlayer } from './components/player/MiniPlayer';
import { FullScreenPlayer } from './components/player/FullScreenPlayer';
import { EqualizerSheet } from './components/player/EqualizerSheet';
import { SleepTimerSheet } from './components/player/SleepTimerSheet';
import { StatsForNerdsModal } from './components/player/StatsForNerdsModal';
import { PWAInstallModal } from './components/common/PWAInstallModal';
import { RiplayImportModal } from './components/common/RiplayImportModal';
import { HomeScreen } from './components/screens/HomeScreen';
import { ExploreScreen } from './components/screens/ExploreScreen';
import { SearchScreen } from './components/screens/SearchScreen';
import { LibraryScreen } from './components/screens/LibraryScreen';
import { RewindScreen } from './components/screens/RewindScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { PlaylistDetailModal } from './components/screens/PlaylistDetailModal';
import { ArtistDetailModal } from './components/screens/ArtistDetailModal';
import { AlbumDetailModal } from './components/screens/AlbumDetailModal';
import { ExitConfirmModal } from './components/common/ExitConfirmModal';
import { PWAUpdateToast } from './components/common/PWAUpdateToast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AddToPlaylistModal } from './components/common/AddToPlaylistModal';
import { SongOptionsMenuModal } from './components/common/SongOptionsMenuModal';
import { SyncSongModal } from './components/common/SyncSongModal';
import { ToastNotification } from './components/common/ToastNotification';
import { WifiOff } from 'lucide-react';

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-300 py-2 px-4 text-xs font-medium flex items-center justify-center gap-2 shrink-0 z-30">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Cached & local tracks are playable</span>
    </div>
  );
}

function MuzikaApp() {
  const { activeTab, themeColors, isPlayerOpen, playerMode, isRiplayImportOpen, setIsRiplayImportOpen } = useMusic();

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300 relative selection:bg-orange-500 selection:text-white"
      style={{ backgroundColor: themeColors.background0, color: themeColors.text }}
    >
      <PWAUpdateToast />

      {/* Main Mobile App Shell */}
      <Header />
      <OfflineBanner />

      <main className="flex-1 overflow-x-hidden">
        <ErrorBoundary>
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'explore' && <ExploreScreen />}
          {activeTab === 'search' && <SearchScreen />}
          {activeTab === 'library' && <LibraryScreen />}
          {activeTab === 'rewind' && <RewindScreen />}
          {activeTab === 'settings' && <SettingsScreen />}
        </ErrorBoundary>
      </main>

      {/* Detail Overlays */}
      <PlaylistDetailModal />
      <ArtistDetailModal />
      <AlbumDetailModal />

      {/* Persistent Mini Player above Navigation */}
      <MiniPlayer />

      {/* Full Player Modal */}
      <FullScreenPlayer />

      {/* Audio & Tool Sheets */}
      <EqualizerSheet />
      <SleepTimerSheet />
      <StatsForNerdsModal />
      <PWAInstallModal />
      <RiplayImportModal isOpen={isRiplayImportOpen} onClose={() => setIsRiplayImportOpen(false)} />
      <ExitConfirmModal />

      {/* Global Quick Action Modals & Toasts */}
      <AddToPlaylistModal />
      <SongOptionsMenuModal />
      <SyncSongModal />
      <ToastNotification />

      {/* Persistent YouTube Iframe Embed Container */}
      <div
        className={`transition-all duration-300 ${
          isPlayerOpen && playerMode === 'video'
            ? 'fixed top-16 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm h-56 rounded-2xl shadow-2xl z-50 border border-white/20 bg-black overflow-hidden'
            : 'fixed bottom-0 right-0 w-2 h-2 pointer-events-none opacity-[0.01] overflow-hidden z-0'
        }`}
      >
        <div id="muzika-yt-embed" className="w-full h-full" />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <MusicProvider>
      <MuzikaApp />
    </MusicProvider>
  );
}
