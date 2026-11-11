import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { CheckCircle2, Info } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { toastMessage, themeColors } = useMusic();

  if (!toastMessage) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[120] max-w-xs w-auto px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/15 flex items-center gap-2.5 text-white text-xs font-extrabold animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-md text-white"
        style={{ backgroundColor: themeColors.accent }}
      >
        <CheckCircle2 className="w-4 h-4" />
      </div>
      <span className="truncate">{toastMessage}</span>
    </div>
  );
};
