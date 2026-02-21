
import type { OnlineManager } from './types';

class DefaultOnlineManager implements OnlineManager {
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.emit());
      window.addEventListener('offline', () => this.emit());
    }
  }

  isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of Array.from(this.listeners)) l();
  }
}

export const onlineManager: OnlineManager = new DefaultOnlineManager();
