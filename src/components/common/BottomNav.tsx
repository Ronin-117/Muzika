import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { Home, Search, Library, FlaskConical, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, themeColors, hapticFeedback } = useMusic();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'test', label: 'Test Suite', icon: FlaskConical },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-2 py-2 border-t border-white/5 backdrop-blur-xl transition-colors safe-area-bottom"
      style={{ backgroundColor: `${themeColors.background0}fa`, color: themeColors.text }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => {
                hapticFeedback();
                setActiveTab(id);
              }}
              className="flex flex-col items-center justify-center flex-1 py-1 transition group"
            >
              <div
                className={`p-1 rounded-xl transition ${
                  isActive ? 'scale-110' : 'opacity-60 group-hover:opacity-90'
                }`}
                style={{
                  color: isActive ? themeColors.accent : undefined,
                }}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[10px] tracking-tight transition ${
                  isActive ? 'font-bold' : 'opacity-60 font-medium'
                }`}
                style={{
                  color: isActive ? themeColors.accent : undefined,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
