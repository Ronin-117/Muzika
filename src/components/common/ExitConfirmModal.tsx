import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { LogOut, Music } from 'lucide-react';

export const ExitConfirmModal: React.FC = () => {
  const {
    isExitConfirmOpen,
    setIsExitConfirmOpen,
    confirmExitApp,
    themeColors,
    hapticFeedback,
  } = useMusic();

  if (!isExitConfirmOpen) return null;

  const handleConfirmExit = () => {
    hapticFeedback();
    confirmExitApp();
  };

  const handleCancel = () => {
    hapticFeedback();
    setIsExitConfirmOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-white/10 space-y-4 text-center transform animate-in zoom-in-95 duration-150"
        style={{ backgroundColor: themeColors.background1, color: themeColors.text }}
      >
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg"
          style={{ backgroundColor: themeColors.accent }}
        >
          <Music className="w-7 h-7 fill-white" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Exit Muzika?</h3>
          <p className="text-xs opacity-60 leading-relaxed">
            Are you sure you want to leave the application?
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95"
            style={{ backgroundColor: themeColors.accent }}
          >
            Stay
          </button>

          <button
            type="button"
            onClick={handleConfirmExit}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white/10 hover:bg-red-500/20 hover:text-red-400 text-white/80 transition active:scale-95 border border-white/5 flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
