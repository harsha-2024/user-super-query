
import { QueryCache } from './cache';
import { defaultRetryDelay } from './backoff';
import { focusManager } from './focusManager';
import { onlineManager } from './onlineManager';
import { now, hashKey } from './utils';
import type { Fetcher, QueryClient, QueryClientOptions, QueryEntry, QueryKey, QueryOptions } from './types';

export function createQueryClient(options?: QueryClientOptions): QueryClient {
  const cache = new QueryCache();
  const listeners = new Set<(evt: any) => void>();
  const defaultOptions: Partial<QueryOptions> = {
    staleTime: 0,
    cacheTime: 5 * 60_000,
    retry: 3,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    structuralSharing: true,
    ...options?.defaultOptions,
  };

  function emit(type: string, payload?: unknown) {
    const evt = { type, payload, timestamp: Date.now() };
    for (const l of Array.from(listeners)) l(evt);
  }

  focusManager.subscribe(() => {
    if (!focusManager.isFocused()) return;
    // Refetch visible, stale queries that opted in
    for (const entry of cache.all()) {
      const refocus = entry.options.refetchOnWindowFocus ?? defaultOptions.refetchOnWindowFocus;
      if (!refocus) continue;
      if (refocus === 'always' || cache.isStale(entry)) {
        void _fetch(entry, undefined); // background
      }
    }
  });

  onlineManager.subscribe(() => {
    if (!onlineManager.isOnline()) return;
    for (const entry of cache.all()) {
      const recon = entry.options.refetchOnReconnect ?? defaultOptions.refetchOnReconnect;
      if (!recon) continue;
      if (recon === 'always' || cache.isStale(entry)) {
        void _fetch(entry, undefined);
      }
    }
  });

  async function _fetch<TData, TVariables>(entry: QueryEntry<TData>, variables: TVariables | undefined): Promise<TData> {
    // If there is an in-flight promise, return it (dedupe)
    if (entry.promise) return entry.promise;

    const fetcher = (entry.options as QueryOptions<TData, unknown, TData, TVariables>).fetcher as Fetcher<TData, TVariables> | undefined;
    if (!fetcher) throw new Error('No fetcher bound to entry');

    // Abort previous
    if (entry.ac) entry.ac.abort();
    const ac = new AbortController();
    entry.ac = ac;
    entry.status = entry.updatedAt ? 'loading' : 'loading';

    let failureCount = 0;

    const doFetch = async (): Promise<TData> => {
      try {
        const res = await fetcher({ signal: ac.signal, variables });
        entry.error = undefined;
        entry.status = 'success';
        const prev = entry.data as any;
        entry.data = (entry.options.structuralSharing && prev && typeof prev === 'object' && res && typeof res === 'object')
          ? Object.is(prev, res) ? prev : { ...(prev as any), ...(res as any) }
          : res;
        entry.updatedAt = now();
        emit('superquery:success', { key: entry.key, data: entry.data });
        return entry.data as TData;
      } catch (err) {
        if (ac.signal.aborted) {
          emit('superquery:aborted', { key: entry.key });
          throw err;
        }
        failureCount += 1;
        const retry = entry.options.retry ?? defaultOptions.retry ?? 0;
        const shouldRetry = typeof retry === 'number' ? failureCount <= retry : retry(failureCount, err);
        if (shouldRetry) {
          const rd = entry.options.retryDelay ?? defaultRetryDelay;
          const delay = typeof rd === 'number' ? rd : rd(failureCount);
          await new Promise(r => setTimeout(r, delay));
          return doFetch();
        }
        entry.error = err;
        entry.status = 'error';
        emit('superquery:error', { key: entry.key, error: err });
        throw err;
      }
    };

    entry.promise = doFetch().finally(() => {
      entry.promise = undefined;
      entry.ac = undefined;
    });
    emit('superquery:fetch', { key: entry.key });
    return entry.promise;
  }

  const client: QueryClient = {
    async prefetch<TData, TVariables = unknown>(key: QueryKey, fetcher: Fetcher<TData, TVariables>, options?: QueryOptions<TData, unknown, TData, TVariables>): Promise<TData> {
      const entry = cache.ensure<TData>(key, { ...defaultOptions, ...options });
      (entry.options as any).fetcher = fetcher;
      return _fetch<TData, TVariables>(entry, options?.variables as any);
    },
    invalidate(key: QueryKey): void {
      const entry = cache.get(key);
      if (!entry) return;
      entry.updatedAt = 0; // mark stale
      emit('superquery:invalidate', { key });
    },
    setQueryData<TData>(key: QueryKey, updater: ((old: TData | undefined) => TData) | TData, opts?: { optimistic?: boolean }): void {
      const entry = cache.ensure<TData>(key, defaultOptions);
      const prev = entry.data as TData | undefined;
      const next = (typeof updater === 'function' ? (updater as any)(prev) : updater) as TData;
      entry.data = next;
      entry.updatedAt = now();
      emit(opts?.optimistic ? 'superquery:optimistic' : 'superquery:setData', { key, prev, next });
    },
    getQueryData<TData>(key: QueryKey): TData | undefined {
      const entry = cache.get<TData>(key);
      return entry?.data as TData | undefined;
    },
    subscribe(listener: (evt: any) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    _internal: {
      ensureEntry: (key: QueryKey) => cache.ensure(key, defaultOptions),
      getEntry: (key: QueryKey) => cache.get(key),
      focusManager,
      onlineManager,
    }
  };

  return client;
}
