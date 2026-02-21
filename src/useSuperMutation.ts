
import * as React from 'react';
import { defaultRetryDelay } from './backoff';
import type { Fetcher, MutationOptions, QueryClient, Status } from './types';

interface MutationState<TData, TError, TVariables> {
  status: Status;
  error: TError | null;
  data: TData | undefined;
  variables: TVariables | undefined;
}

export function useSuperMutation<TData, TError = unknown, TVariables = unknown, TContext = unknown>(
  fetcher: Fetcher<TData, TVariables>,
  options?: MutationOptions<TData, TError, TVariables, TContext>,
) {
  const clientRef = React.useRef<QueryClient | null>(null);
  // consumer sets client via context in their app if desired; for simplicity, accept an imperative setter
  const setClient = React.useCallback((client: QueryClient) => { clientRef.current = client; }, []);

  const [state, setState] = React.useState<MutationState<TData, TError, TVariables>>({
    status: 'idle',
    error: null,
    data: undefined,
    variables: undefined,
  });

  const mutateAsync = React.useCallback(async (variables: TVariables): Promise<TData> => {
    setState(s => ({ ...s, status: 'loading', error: null, variables }));
    const client = clientRef.current!;

    let ctx: TContext | undefined = undefined;
    try {
      if (options?.onMutate) ctx = await options.onMutate(variables, { client });

      let failureCount = 0;
      const ac = new AbortController();

      const doFetch = async (): Promise<TData> => {
        try {
          const data = await fetcher({ signal: ac.signal, variables });
          setState(s => ({ ...s, status: 'success', data }));
          options?.onSuccess?.(data, variables, ctx, { client });
          options?.onSettled?.(data, null as any, variables, { client });
          return data;
        } catch (err) {
          failureCount += 1;
          const retry = options?.retry ?? 0;
          const shouldRetry = typeof retry === 'number' ? failureCount <= retry : retry(failureCount, err);
          if (shouldRetry) {
            const rd = options?.retryDelay ?? defaultRetryDelay;
            const delay = typeof rd === 'number' ? rd : rd(failureCount);
            await new Promise(r => setTimeout(r, delay));
            return doFetch();
          }
          setState(s => ({ ...s, status: 'error', error: err as any }));
          options?.onError?.(err as any, variables, ctx, { client });
          options?.onSettled?.(undefined, err as any, variables, { client });
          throw err;
        }
      };

      return await doFetch();
    } catch (e) {
      throw e;
    }
  }, [fetcher, options]);

  return {
    ...state,
    mutate: (v: TVariables, client: QueryClient) => { clientRef.current = client; return mutateAsync(v); },
    mutateAsync: (v: TVariables, client: QueryClient) => { clientRef.current = client; return mutateAsync(v); },
    setClient,
  } as const;
}
