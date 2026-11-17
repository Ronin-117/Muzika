// Utility for maintaining continuous hardware AudioFocus and background playback
// on mobile browsers (Android Chrome, iOS Safari) when the screen is locked or app minimized.

let cachedUri: string | null = null;

export function getSubAudibleAudioUri(): string {
  if (cachedUri) return cachedUri;

  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second loop
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(v: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Fill with soft 30Hz carrier tone that satisfies OS audio active mixer without audible distortion
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 30 * t) * 600;
    view.setInt16(44 + i * 2, sample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  cachedUri = 'data:audio/wav;base64,' + (typeof window !== 'undefined' ? btoa(binary) : '');
  return cachedUri;
}

// WebAudio AudioContext keep-alive manager
class AudioFocusManager {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isRunning = false;
  private interruptionListeners = new Set<(interrupted: boolean) => void>();

  onInterruptionChange(cb: (interrupted: boolean) => void): () => void {
    this.interruptionListeners.add(cb);
    return () => {
      this.interruptionListeners.delete(cb);
    };
  }

  private notifyInterruption(interrupted: boolean) {
    this.interruptionListeners.forEach((cb) => {
      try {
        cb(interrupted);
      } catch {}
    });
  }

  getState(): string {
    return this.ctx?.state || 'closed';
  }

  start() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.osc = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();

        // Sub-audible carrier
        this.osc.frequency.setValueAtTime(28, this.ctx.currentTime);
        this.gain.gain.setValueAtTime(0.005, this.ctx.currentTime);

        this.osc.connect(this.gain);
        this.gain.connect(this.ctx.destination);
        this.osc.start();
        this.isRunning = true;

        this.ctx.onstatechange = () => {
          const state = this.ctx?.state as string;
          if (state === 'interrupted') {
            this.notifyInterruption(true);
          } else if (state === 'running') {
            this.notifyInterruption(false);
          }
        };
      }

      if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  stop() {
    try {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

export const audioFocusManager = new AudioFocusManager();

