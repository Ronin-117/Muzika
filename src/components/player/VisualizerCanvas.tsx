import React, { useEffect, useRef } from 'react';
import { useMusic } from '../../context/MusicContext';

interface VisualizerCanvasProps {
  styleType?: 'bars' | 'wave' | 'pulse';
  className?: string;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  styleType = 'bars',
  className = '',
}) => {
  const { isPlaying, themeColors } = useMusic();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const numBars = 32;
    const barHeights = Array(numBars).fill(4);
    const targetHeights = Array(numBars).fill(4);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      phase += 0.08;

      if (styleType === 'bars') {
        const barWidth = width / numBars - 2;

        for (let i = 0; i < numBars; i++) {
          if (isPlaying) {
            // Dynamic rhythmic pulse
            if (Math.random() > 0.6) {
              const freqFactor = Math.sin((i / numBars) * Math.PI) * 0.8 + 0.2;
              targetHeights[i] = Math.max(6, Math.random() * height * 0.85 * freqFactor);
            }
          } else {
            targetHeights[i] = 4;
          }

          barHeights[i] += (targetHeights[i] - barHeights[i]) * 0.2;

          const barH = barHeights[i];
          const x = i * (barWidth + 2);
          const y = height - barH;

          // Gradient fill with accent color
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, `${themeColors.accent}44`);
          gradient.addColorStop(1, themeColors.accent);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
          ctx.fill();
        }
      } else if (styleType === 'wave') {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        for (let x = 0; x < width; x += 4) {
          const amplitude = isPlaying ? height * 0.35 : 3;
          const y =
            height / 2 +
            Math.sin(x * 0.03 + phase) * amplitude * Math.sin((x / width) * Math.PI);
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = themeColors.accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = themeColors.accent;
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, styleType, themeColors]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={64}
      className={`w-full pointer-events-none ${className}`}
    />
  );
};
