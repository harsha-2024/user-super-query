
import type { FocusManager } from './types';

class DefaultFocusManager implements FocusManager {
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const handler = () => {
        if (document.visibilityState === 'visible') this.emit();
      };
      window.addEventListener('visibilitychange', handler);
      window.addEventListener('focus', handler);
    }
  }

  isFocused(): boolean {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of Array.from(this.listeners)) l();
  }
}

export const focusManager: FocusManager = new DefaultFocusManager();
