import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { pwaUpdater } from '../../utils/pwaUpdater';

export const PWAUpdateToast: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = pwaUpdater.subscribe((updateAvailable) => {
      setHasUpdate(updateAvailable);
      if (updateAvailable) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  if (!hasUpdate || isDismissed) return null;

  const handleUpdate = () => {
    setIsUpdating(true);
    pwaUpdater.applyUpdate();
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92vw] max-w-md bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-2xl p-4 shadow-2xl border border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-yellow-300" />
          </div>
          <div>
            <h4 className="font-semibold text-sm leading-tight">App Update Available</h4>
            <p className="text-xs text-white/80 mt-0.5">
              New features & fixes ready. No reinstall needed!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-3.5 py-1.5 rounded-xl bg-white text-emerald-800 font-semibold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
