import { EqualizerSettings } from '../types/music';

class WebAudioEqualizerEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private preampGain: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private band60: BiquadFilterNode | null = null;
  private band230: BiquadFilterNode | null = null;
  private band910: BiquadFilterNode | null = null;
  private band3600: BiquadFilterNode | null = null;
  private band14000: BiquadFilterNode | null = null;
  private surroundGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isInitialized = false;
  private lastSettings: EqualizerSettings | null = null;

  public init(audioElement: HTMLAudioElement) {
    if (!audioElement.crossOrigin) {
      try {
        audioElement.crossOrigin = 'anonymous';
      } catch (e) {
        // Ignore if already playing
      }
    }
    if (this.isInitialized) {
      this.resume();
      if (this.lastSettings) {
        this.applyGains(this.lastSettings, true);
      }
      return;
    }
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();

      // Re-apply gains cleanly the instant the browser transitions AudioContext from suspended -> running
      this.audioCtx.onstatechange = () => {
        if (this.audioCtx && this.audioCtx.state === 'running' && this.lastSettings) {
          this.applyGains(this.lastSettings, true);
        }
      };

      // Create DSP nodes
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);

      this.preampGain = this.audioCtx.createGain();

      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 80;

      this.band60 = this.audioCtx.createBiquadFilter();
      this.band60.type = 'peaking';
      this.band60.frequency.value = 60;
      this.band60.Q.value = 1.1;

      this.band230 = this.audioCtx.createBiquadFilter();
      this.band230.type = 'peaking';
      this.band230.frequency.value = 230;
      this.band230.Q.value = 1.1;

      this.band910 = this.audioCtx.createBiquadFilter();
      this.band910.type = 'peaking';
      this.band910.frequency.value = 910;
      this.band910.Q.value = 1.1;

      this.band3600 = this.audioCtx.createBiquadFilter();
      this.band3600.type = 'peaking';
      this.band3600.frequency.value = 3600;
      this.band3600.Q.value = 1.1;

      this.band14000 = this.audioCtx.createBiquadFilter();
      this.band14000.type = 'highshelf';
      this.band14000.frequency.value = 14000;
      this.band14000.Q.value = 1.1;

      this.surroundGain = this.audioCtx.createGain();

      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.value = -6;
      this.compressor.knee.value = 15;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Connect DSP chain
      this.sourceNode
        .connect(this.preampGain)
        .connect(this.bassFilter)
        .connect(this.band60)
        .connect(this.band230)
        .connect(this.band910)
        .connect(this.band3600)
        .connect(this.band14000)
        .connect(this.compressor)
        .connect(this.audioCtx.destination);

      this.isInitialized = true;
      if (this.lastSettings) {
        this.applyGains(this.lastSettings, true);
      }
      this.resume();
    } catch (err) {
      console.warn('Web Audio API Equalizer initialization note:', err);
    }
  }

  public ensureActive(audioElement: HTMLAudioElement, settings?: EqualizerSettings) {
    if (settings) {
      this.lastSettings = settings;
    }
    if (!this.isInitialized) {
      this.init(audioElement);
    } else {
      this.resume();
      if (this.lastSettings) {
        this.applyGains(this.lastSettings, false);
      }
    }
  }

  public resume() {
    if (this.audioCtx && (this.audioCtx.state === 'suspended' || (this.audioCtx.state as string) === 'interrupted')) {
      this.audioCtx
        .resume()
        .then(() => {
          if (this.lastSettings) {
            this.applyGains(this.lastSettings, true);
          }
        })
        .catch(() => {});
    }
  }

  public applySettings(settings: EqualizerSettings) {
    this.lastSettings = settings;
    this.resume();
    if (!this.isInitialized || !this.audioCtx) return;
    this.applyGains(settings, false);
  }

  private applyGains(settings: EqualizerSettings, immediate: boolean) {
    if (!this.isInitialized || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const setParam = (param: AudioParam, value: number) => {
      if (immediate || this.audioCtx?.state !== 'running') {
        param.setValueAtTime(value, now);
      } else {
        param.setTargetAtTime(value, now, 0.03);
      }
    };

    if (!settings.enabled) {
      // Flat bypass
      if (this.preampGain) setParam(this.preampGain.gain, 1.0);
      if (this.bassFilter) setParam(this.bassFilter.gain, 0);
      if (this.band60) setParam(this.band60.gain, 0);
      if (this.band230) setParam(this.band230.gain, 0);
      if (this.band910) setParam(this.band910.gain, 0);
      if (this.band3600) setParam(this.band3600.gain, 0);
      if (this.band14000) setParam(this.band14000.gain, 0);
      return;
    }

    // 1. Preamp Gain (-12 dB to +12 dB)
    const preampDb = typeof settings.preamp === 'number' ? settings.preamp : 0;
    const preampLinear = Math.pow(10, preampDb / 20);
    if (this.preampGain) {
      setParam(this.preampGain.gain, preampLinear);
    }

    // 2. Bass Boost (0 to 100 -> 0 to +15 dB low shelf filter at 80Hz)
    const bassDb = (Math.max(0, Math.min(100, settings.bassBoost)) / 100) * 15;
    if (this.bassFilter) {
      setParam(this.bassFilter.gain, bassDb);
    }

    // 3. 5-Band Equalizer Frequency Channels (-12 to +12 dB)
    if (this.band60) setParam(this.band60.gain, settings.bands.band60 || 0);
    if (this.band230) setParam(this.band230.gain, settings.bands.band230 || 0);
    if (this.band910) setParam(this.band910.gain, settings.bands.band910 || 0);
    if (this.band3600) setParam(this.band3600.gain, settings.bands.band3600 || 0);
    if (this.band14000) setParam(this.band14000.gain, settings.bands.band14000 || 0);
  }
}

export const webAudioEqualizer = new WebAudioEqualizerEngine();
