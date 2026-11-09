// Automatic PWA Update Service
// Solves the issue where users had to uninstall/reinstall the home screen PWA to see changes.

type UpdateListener = (hasUpdate: boolean) => void;

class PWAUpdaterService {
  private hasUpdate = false;
  private listeners: Set<UpdateListener> = new Set();
  private isChecking = false;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (!('serviceWorker' in navigator)) return;

    // Listen for incoming service worker controller replacement
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA Updater] New Service Worker active, reloading app...');
      window.location.reload();
    });

    // Obtain current registration
    navigator.serviceWorker.ready
      .then((reg) => {
        this.registration = reg;

        // Check if an update is already waiting
        if (reg.waiting) {
          this.setUpdateAvailable();
        }

        // Listen for new service worker installing
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.setUpdateAvailable();
              }
            });
          }
        });

        // Auto-check on app resume (when user brings app to foreground)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkForUpdates();
          }
        });

        // Periodic background check every 5 minutes
        setInterval(() => {
          this.checkForUpdates();
        }, 5 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[PWA Updater] Failed to get SW registration:', err);
      });
  }

  private setUpdateAvailable() {
    this.hasUpdate = true;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.hasUpdate));
  }

  subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.hasUpdate);
    return () => this.listeners.delete(listener);
  }

  async checkForUpdates(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || this.isChecking) return false;
    this.isChecking = true;

    try {
      const reg = this.registration || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        this.registration = reg;
        await reg.update();
        if (reg.waiting) {
          this.setUpdateAvailable();
          return true;
        }
      }
    } catch (err) {
      console.warn('[PWA Updater] Update check failed:', err);
    } finally {
      this.isChecking = false;
    }

    return this.hasUpdate;
  }

  applyUpdate() {
    if (this.registration && this.registration.waiting) {
      // Send skipWaiting message to the waiting worker
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Hard refresh to clear any cached assets
    window.location.reload();
  }
}

export const pwaUpdater = new PWAUpdaterService();
