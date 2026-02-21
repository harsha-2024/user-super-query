
import * as React from 'react';
import { now } from './utils';
import type { Fetcher, QueryClient, QueryKey, QueryOptions, Status } from './types';

interface QueryState<TData, TError, TSelect> {
  data: TSelect | undefined;
  error: TError | null;
  status: Status;
  isFetching: boolean;
  isStale: boolean;
}

export function useSuperQuery<TData, TError = unknown, TSelect = TData, TVariables = unknown>(
  client: QueryClient,
  key: QueryKey,
  fetcher: Fetcher<TData, TVariables>,
  options?: QueryOptions<TData, TError, TSelect, TVariables>,
): QueryState<TData, TError, TSelect> & { refetch: () => Promise<TData> } {
  const optsRef = React.useRef(options);
  optsRef.current = options;

  const entry = React.useMemo(() => client._internal.ensureEntry(key), [client, JSON.stringify(key)]);

  // Bind fetcher
  React.useEffect(() => {
    (entry.options as any).fetcher = fetcher;
  }, [entry, fetcher]);

  // Observer count
  React.useEffect(() => {
    entry.observers += 1;
    return () => {
      entry.observers -= 1;
      client._internal.getEntry(key) && (client._internal.getEntry(key) as any) && (client._internal as any);
      // GC scheduling handled by cache
    };
  }, [entry, client, key]);

  const [state, setState] = React.useState<QueryState<TData, TError, TSelect>>(() => {
    const isStale = (entry.options.staleTime ?? 0) === 0 ? true : (now() - entry.updatedAt > (entry.options.staleTime ?? 0));
    const baseData = (entry.data ?? options?.initialData) as TData | undefined;
    const selected = (options?.select && baseData != null) ? options.select(baseData) as any : baseData as any;
    const status: Status = entry.status || (baseData ? 'success' : 'idle');
    return { data: selected, error: (entry.error ?? null) as any, status, isFetching: entry.promise != null, isStale };
  });

  // Refetch on mount depending on options
  React.useEffect(() => {
    const enabled = options?.enabled ?? true;
    const refetchOnMount = options?.refetchOnMount ?? true;
    const shouldFetch = enabled && (
      refetchOnMount === 'always' || !entry.updatedAt || (now() - entry.updatedAt > (options?.staleTime ?? entry.options.staleTime ?? 0))
    );
    if (shouldFetch) void doRefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.keyHash, JSON.stringify(options?.variables)]);

  // Focus/Online side effects are handled by client; we only need to re-render on entry changes
  React.useEffect(() => {
    const unsub = client.subscribe((evt) => {
      if (!evt?.type?.startsWith('superquery:')) return;
      if (evt?.payload?.key && JSON.stringify(evt.payload.key) !== JSON.stringify(key)) return;
      // Update render state
      const baseData = entry.data as TData | undefined;
      const selected = (optsRef.current?.select && baseData != null) ? (optsRef.current!.select as any)(baseData) : baseData as any;
      const isStale = (entry.options.staleTime ?? 0) === 0 ? true : (now() - entry.updatedAt > (entry.options.staleTime ?? 0));
      setState({
        data: selected,
        error: (entry.error ?? null) as any,
        status: entry.status,
        isFetching: !!entry.promise,
        isStale,
      });
    });
    return unsub;
  }, [client, entry, key]);

  const doRefetch = React.useCallback(async (): Promise<TData> => {
    const e = client._internal.getEntry(key) as any;
    if (!e) throw new Error('Missing cache entry');
    // attach options variables for this refetch
    e.options = { ...e.options, ...(optsRef.current || {}), variables: optsRef.current?.variables, fetcher: e.options.fetcher };
    const data = await (client as any).prefetch(key, e.options.fetcher, e.options);
    // State will be updated by subscription
    return data as TData;
  }, [client, key]);

  return { ...state, refetch: doRefetch } as const;
}
