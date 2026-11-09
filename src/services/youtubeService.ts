// Global YouTube Player singleton controller

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let ytPlayerInstance: any = null;
let isApiLoading = false;
let isApiReady = false;
const readyCallbacks: (() => void)[] = [];

export function loadYouTubeIFrameApi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();

    if (window.YT && window.YT.Player) {
      isApiReady = true;
      return resolve();
    }

    readyCallbacks.push(resolve);

    if (!isApiLoading) {
      isApiLoading = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        isApiReady = true;
        readyCallbacks.forEach((cb) => cb());
        readyCallbacks.length = 0;
      };
    }
  });
}

export interface YTPlayerCallbacks {
  onStateChange: (state: number) => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onError: (error: any) => void;
}

export class YouTubeController {
  private player: any = null;
  private timePoller: number | null = null;
  private callbacks: YTPlayerCallbacks;
  private elementId: string;

  constructor(elementId: string, callbacks: YTPlayerCallbacks) {
    this.elementId = elementId;
    this.callbacks = callbacks;
  }

  async init(initialVideoId = '4NRXx6U8ABQ') {
    await loadYouTubeIFrameApi();

    return new Promise<void>((resolve) => {
      const container = document.getElementById(this.elementId);
      if (!container) {
        console.warn('YouTube container not found:', this.elementId);
        return resolve();
      }

      this.player = new window.YT.Player(this.elementId, {
        height: '100%',
        width: '100%',
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1, // Crucial for mobile inline playback
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytPlayerInstance = this.player;
            this.startTimePoller();
            resolve();
          },
          onStateChange: (e: any) => {
            this.callbacks.onStateChange(e.data);
          },
          onError: (e: any) => {
            console.warn('YouTube Player Error:', e.data);
            this.callbacks.onError(e);
          },
        },
      });
    });
  }

  private startTimePoller() {
    if (this.timePoller) clearInterval(this.timePoller);
    this.timePoller = window.setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        try {
          const currentTime = this.player.getCurrentTime() || 0;
          const duration = this.player.getDuration() || 0;
          this.callbacks.onTimeUpdate(currentTime, duration);
        } catch {
          // ignore transient poll errors
        }
      }
    }, 500);
  }

  loadVideoById(videoId: string, startSeconds = 0) {
    if (!this.player || typeof this.player.loadVideoById !== 'function') {
      return;
    }
    try {
      this.player.loadVideoById({
        videoId,
        startSeconds,
      });
    } catch (e) {
      console.warn('Error loading video by ID:', e);
    }
  }

  cueVideoById(videoId: string) {
    if (!this.player || typeof this.player.cueVideoById !== 'function') return;
    try {
      this.player.cueVideoById(videoId);
    } catch (e) {
      console.warn('Error cuing video:', e);
    }
  }

  play() {
    if (this.player && typeof this.player.playVideo === 'function') {
      this.player.playVideo();
    }
  }

  pause() {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      this.player.pauseVideo();
    }
  }

  seekTo(seconds: number) {
    if (this.player && typeof this.player.seekTo === 'function') {
      this.player.seekTo(seconds, true);
    }
  }

  setVolume(volume: number) {
    // 0 to 100
    if (this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(Math.max(0, Math.min(100, volume)));
    }
  }

  setPlaybackRate(rate: number) {
    if (this.player && typeof this.player.setPlaybackRate === 'function') {
      this.player.setPlaybackRate(rate);
    }
  }

  destroy() {
    if (this.timePoller) {
      clearInterval(this.timePoller);
      this.timePoller = null;
    }
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
      this.player = null;
    }
  }
}
