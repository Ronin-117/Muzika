import { ThemeColors } from '../types/music';

/**
 * Extracts the primary vibrant/dominant color from an album cover artwork image URL
 * and generates a dynamic ThemeColors palette (with default black background base).
 */
export async function extractDynamicPalette(imageUrl?: string): Promise<ThemeColors> {
  const defaultPalette: ThemeColors = {
    name: 'dynamic',
    label: 'Dynamic Art (Artwork Adaptive)',
    accent: '#DE6433',
    accentHover: '#ff773d',
    background0: '#08080a',
    background1: '#141419',
    background2: '#20202a',
    text: '#ffffff',
    textSecondary: '#a0a0aa',
  };

  if (!imageUrl || typeof window === 'undefined') {
    return defaultPalette;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    // Fallback timeout in case image loading stalls
    const timer = setTimeout(() => {
      resolve(defaultPalette);
    }, 1500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(defaultPalette);

        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imgData = ctx.getImageData(0, 0, 40, 40).data;
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        let maxSat = 0;
        let dominantR = 222, dominantG = 100, dominantB = 51;

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 200) continue; // Skip semi-transparent pixels

          // Calculate saturation and brightness
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const brightness = (r + g + b) / 3;
          const saturation = max === 0 ? 0 : (max - min) / max;

          // Prefer vibrant colors over washed out grey/white/black
          if (brightness > 30 && brightness < 235 && saturation > maxSat) {
            maxSat = saturation;
            dominantR = r;
            dominantG = g;
            dominantB = b;
          }

          rSum += r;
          gSum += g;
          bSum += b;
          count++;
        }

        if (count > 0 && maxSat === 0) {
          dominantR = Math.round(rSum / count);
          dominantG = Math.round(gSum / count);
          dominantB = Math.round(bSum / count);
        }

        // Ensure accent color is sufficiently bright for readability
        const accentR = Math.min(255, Math.max(100, dominantR));
        const accentG = Math.min(255, Math.max(100, dominantG));
        const accentB = Math.min(255, Math.max(100, dominantB));
        const accentHex = `#${((1 << 24) + (accentR << 16) + (accentG << 8) + accentB).toString(16).slice(1)}`;
        const accentHoverHex = `#${((1 << 24) + (Math.min(255, accentR + 25) << 16) + (Math.min(255, accentG + 25) << 8) + Math.min(255, accentB + 25)).toString(16).slice(1)}`;

        // Deep dark background derived from dominant hue, blending into pitch black
        const bgR0 = Math.round(dominantR * 0.08);
        const bgG0 = Math.round(dominantG * 0.08);
        const bgB0 = Math.round(dominantB * 0.08);

        const bgR1 = Math.round(dominantR * 0.14 + 10);
        const bgG1 = Math.round(dominantG * 0.14 + 10);
        const bgB1 = Math.round(dominantB * 0.14 + 12);

        const bgR2 = Math.round(dominantR * 0.20 + 20);
        const bgG2 = Math.round(dominantG * 0.20 + 20);
        const bgB2 = Math.round(dominantB * 0.20 + 24);

        const bg0 = `#${((1 << 24) + (bgR0 << 16) + (bgG0 << 8) + bgB0).toString(16).slice(1)}`;
        const bg1 = `#${((1 << 24) + (bgR1 << 16) + (bgG1 << 8) + bgB1).toString(16).slice(1)}`;
        const bg2 = `#${((1 << 24) + (bgR2 << 16) + (bgG2 << 8) + bgB2).toString(16).slice(1)}`;

        resolve({
          name: 'dynamic',
          label: 'Dynamic Art (Artwork Adaptive)',
          accent: accentHex,
          accentHover: accentHoverHex,
          background0: bg0,
          background1: bg1,
          background2: bg2,
          text: '#ffffff',
          textSecondary: '#a0a0aa',
        });
      } catch {
        resolve(defaultPalette);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(defaultPalette);
    };

    img.src = imageUrl;
  });
}
