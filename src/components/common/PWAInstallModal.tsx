import React, { useEffect, useRef, useState } from 'react';
import { useMusic } from '../../context/MusicContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  X,
  Smartphone,
  Download,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  QrCode,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';

export const PWAInstallModal: React.FC = () => {
  const { isPWAInstallModalOpen, setIsPWAInstallModalOpen, themeColors, hapticFeedback } = useMusic();
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'install' | 'features'>('qr');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (isPWAInstallModalOpen && canvasRef.current && currentUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        currentUrl,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#16171d',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('QR Code error:', error);
        }
      );
    }
  }, [isPWAInstallModalOpen, currentUrl, activeTab]);

  if (!isPWAInstallModalOpen) return null;

  const handleInstallClick = async () => {
    hapticFeedback();
    const success = await install();
    if (success) {
      setIsPWAInstallModalOpen(false);
    }
  };

  const handleCopy = () => {
    hapticFeedback();
    navigator.clipboard?.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto border border-white/10"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: themeColors.accent }}
            >
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Open on Mobile / Install App</h2>
              <p className="text-xs opacity-60">Muzika on Android & Mobile</p>
            </div>
          </div>
          <button
            onClick={() => setIsPWAInstallModalOpen(false)}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 p-1 rounded-2xl bg-black/20 my-4">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'qr' ? 'bg-white/10 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Scan QR
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'install' ? 'bg-white/10 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" /> Android Steps
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'features' ? 'bg-white/10 text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Features
          </button>
        </div>

        {/* 1. QR Code Tab */}
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-white rounded-2xl shadow-xl">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            <div>
              <div className="text-sm font-bold">Scan with your phone&apos;s camera</div>
              <p className="text-xs opacity-60 max-w-xs mt-1">
                Open your Android or iPhone camera, point it at this QR code, and tap the link to load Muzika instantly on your mobile browser!
              </p>
            </div>

            {/* Direct URL Box */}
            <div className="w-full flex items-center gap-2 p-2 rounded-2xl bg-black/30 border border-white/10">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-transparent text-xs font-mono px-2 text-white/80 select-all focus:outline-none truncate"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 text-white shadow transition active:scale-95"
                style={{ backgroundColor: themeColors.accent }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* 2. Android Install Steps Tab */}
        {activeTab === 'install' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-white/5 space-y-3">
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                How to install on your Android Phone:
              </div>
              <ol className="list-decimal pl-5 space-y-2 opacity-80 leading-relaxed">
                <li>
                  Open Chrome on your Android phone and navigate to this URL:
                  <div className="mt-1 font-mono p-1.5 bg-black/40 rounded-lg text-[11px] text-amber-300 break-all select-all">
                    {currentUrl}
                  </div>
                </li>
                <li>
                  Tap Chrome&apos;s top-right <strong>three dots (⋮)</strong> menu.
                </li>
                <li>
                  Select <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                </li>
                <li>
                  Android creates a standalone <strong>WebAPK</strong> on your phone with the Muzika icon!
                </li>
              </ol>
            </div>

            {/* In-browser Install Prompt (if running inside Chrome/Android right now) */}
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="w-full py-3.5 px-4 rounded-2xl text-white font-bold flex items-center justify-center gap-2 shadow-lg text-sm transition transform active:scale-98"
                style={{ backgroundColor: themeColors.accent }}
              >
                <Download className="w-5 h-5" />
                Install Muzika App Directly
              </button>
            )}

            {isInstalled && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-xs font-semibold justify-center">
                <CheckCircle2 className="w-4 h-4" /> Muzika is already installed as an app!
              </div>
            )}
          </div>
        )}

        {/* 3. Features Tab */}
        {activeTab === 'features' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
              <Zap className="w-5 h-5 mt-0.5 shrink-0" style={{ color: themeColors.accent }} />
              <div>
                <h4 className="text-sm font-semibold">Standalone Android Window</h4>
                <p className="text-xs opacity-70 mt-0.5">
                  Runs full screen without browser URL bars, exactly like a native app.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
              <Layers className="w-5 h-5 mt-0.5 shrink-0" style={{ color: themeColors.accent }} />
              <div>
                <h4 className="text-sm font-semibold">Lock Screen & Notification Controls</h4>
                <p className="text-xs opacity-70 mt-0.5">
                  Supports Android MediaSession for lock screen album art and notification playback controls.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5">
              <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" style={{ color: themeColors.accent }} />
              <div>
                <h4 className="text-sm font-semibold">100% Free & Open Source</h4>
                <p className="text-xs opacity-70 mt-0.5">
                  Based on RiPlay by fast4x. No telemetry, offline cached playback, and local file import.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] opacity-50">
          <span>Google AI Studio Hosted</span>
          <button
            onClick={() => window.open(currentUrl, '_blank')}
            className="flex items-center gap-1 hover:underline text-white/80"
          >
            <span>Open in new tab</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
