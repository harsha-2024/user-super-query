
import { now, hashKey } from './utils';
import type { QueryEntry, QueryKey, QueryOptions } from './types';

export class QueryCache {
  private map = new Map<string, QueryEntry<any>>();

  ensure<TData>(key: QueryKey, options?: Partial<QueryOptions<TData>>): QueryEntry<TData> {
    const keyHash = hashKey(key);
    let entry = this.map.get(keyHash) as QueryEntry<TData> | undefined;
    if (!entry) {
      entry = {
        keyHash,
        key,
        data: undefined,
        error: undefined,
        status: 'idle',
        updatedAt: 0,
        observers: 0,
        promise: undefined,
        ac: undefined,
        options: {
          staleTime: 0,
          cacheTime: 5 * 60_000,
          retry: 3,
          refetchOnMount: true,
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
          structuralSharing: true,
          ...options,
        },
      };
      this.map.set(keyHash, entry);
    } else {
      entry.options = { ...entry.options, ...options } as any;
    }
    return entry;
  }

  get<TData>(key: QueryKey): QueryEntry<TData> | undefined {
    return this.map.get(hashKey(key)) as QueryEntry<TData> | undefined;
  }

  delete(key: QueryKey): void {
    this.map.delete(hashKey(key));
  }

  all(): Array<QueryEntry<any>> {
    return Array.from(this.map.values());
  }

  isStale(entry: QueryEntry<any>): boolean {
    const st = entry.options.staleTime ?? 0;
    if (!entry.updatedAt) return true;
    return now() - entry.updatedAt > st;
  }

  maybeGC(entry: QueryEntry<any>): void {
    const cacheTime = entry.options.cacheTime ?? 5 * 60_000;
    if (entry.observers === 0 && cacheTime >= 0) {
      const toDeleteAt = now() + cacheTime;
      // Schedule GC
      setTimeout(() => {
        const current = this.map.get(entry.keyHash);
        if (current && current.observers === 0 && (now() - current.updatedAt >= cacheTime)) {
          this.map.delete(entry.keyHash);
        }
      }, cacheTime + 50);
    }
  }
}
