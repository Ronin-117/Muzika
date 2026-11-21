import React from 'react';

export function normalizeSongKey(id?: string | null): string {
  if (!id) return '';
  return id.startsWith('yt-') ? id.slice(3) : id;
}

export function isSameSong(
  a?: { id?: string; youtubeId?: string } | null,
  b?: { id?: string; youtubeId?: string } | null
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  const keyA = normalizeSongKey(a.youtubeId || a.id);
  const keyB = normalizeSongKey(b.youtubeId || b.id);
  return Boolean(keyA && keyB && keyA === keyB);
}

interface PlayingBarsProps {
  accentColor: string;
  isPlaying: boolean;
  size?: 'sm' | 'md';
}

export const PlayingBars: React.FC<PlayingBarsProps> = ({
  accentColor,
  isPlaying,
  size = 'sm',
}) => {
  const heightCls = size === 'md' ? 'h-4' : 'h-3';
  const widthCls = size === 'md' ? 'w-[3px]' : 'w-[2.5px]';

  return (
    <span
      className={`inline-flex items-end gap-[2px] ${heightCls} shrink-0`}
      aria-label={isPlaying ? 'Currently playing' : 'Current track paused'}
    >
      <span
        className={`${widthCls} h-full rounded-full ${isPlaying ? 'muzika-eq-bar' : 'scale-y-50 origin-bottom'}`}
        style={{ backgroundColor: accentColor, animationDelay: '0ms' }}
      />
      <span
        className={`${widthCls} h-full rounded-full ${isPlaying ? 'muzika-eq-bar' : 'scale-y-75 origin-bottom'}`}
        style={{ backgroundColor: accentColor, animationDelay: '200ms' }}
      />
      <span
        className={`${widthCls} h-full rounded-full ${isPlaying ? 'muzika-eq-bar' : 'scale-y-40 origin-bottom'}`}
        style={{ backgroundColor: accentColor, animationDelay: '400ms' }}
      />
    </span>
  );
};
