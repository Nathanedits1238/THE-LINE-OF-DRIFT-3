export type ConnectivityListener = (isOnline: boolean) => void;

class NetworkConnectivityService {
  private _browserOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private _serverReachable: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<ConnectivityListener> = new Set();
  private pollTimer: number | null = null;
  private checking: boolean = false;
  public lastCheckAt: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this._browserOnline = true;
        void this.recheckNow();
      });

      window.addEventListener('offline', () => {
        const wasOnline = this.isOnline;
        this._browserOnline = false;
        this._serverReachable = false;
        if (wasOnline !== this.isOnline) {
          this.notify();
        }
      });

      const navWithConn = navigator as Navigator & {
        connection?: { addEventListener?: (t: string, cb: () => void) => void; type?: string };
      };
      navWithConn.connection?.addEventListener?.('change', () => {
        this._browserOnline = navigator.onLine;
        if (!this._browserOnline) {
          const wasOnline = this.isOnline;
          this._serverReachable = false;
          if (wasOnline !== this.isOnline) this.notify();
        } else {
          void this.recheckNow();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          void this.recheckNow();
        }
      });

      // Immediate startup verification + periodic health check every 8s
      void this.recheckNow();
      this.pollTimer = window.setInterval(() => {
        if (!document.hidden) {
          void this.recheckNow();
        }
      }, 8000);
    }
  }

  public get isOnline(): boolean {
    return this._browserOnline && this._serverReachable;
  }

  public get hasWifiOrMobileData(): boolean {
    return this._browserOnline;
  }

  public subscribe(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async recheckNow(): Promise<boolean> {
    if (this.checking) return this.isOnline;
    const prevOnline = this.isOnline;

    this._browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!this._browserOnline) {
      this._serverReachable = false;
      if (prevOnline !== this.isOnline) this.notify();
      return false;
    }

    this.checking = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2200);

    try {
      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      this._serverReachable = res.ok;
    } catch {
      this._serverReachable = false;
    } finally {
      window.clearTimeout(timeoutId);
      this.checking = false;
      this.lastCheckAt = Date.now();
      if (prevOnline !== this.isOnline) {
        this.notify();
      }
    }

    return this.isOnline;
  }

  private notify() {
    const state = this.isOnline;
    for (const cb of this.listeners) {
      try {
        cb(state);
      } catch (err) {
        console.warn('Connectivity listener error:', err);
      }
    }
  }

  public dispose() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.listeners.clear();
  }
}

export const networkStatus = new NetworkConnectivityService();
