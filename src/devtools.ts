
import type { DevtoolsEvent } from './types';

export class DevtoolsBus {
  private listeners = new Set<(e: DevtoolsEvent) => void>();

  emit(type: string, payload?: unknown) {
    const evt: DevtoolsEvent = { type, payload, timestamp: Date.now() };
    for (const l of Array.from(this.listeners)) l(evt);
  }

  subscribe(listener: (e: DevtoolsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
