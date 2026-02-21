
export type QueryKey = ReadonlyArray<unknown>;

export type Status = 'idle' | 'loading' | 'success' | 'error';

export type RetryOption = number | ((failureCount: number, error: unknown) => boolean);

export type RetryDelayOption = number | ((failureCount: number) => number);

export interface FetcherContext<TVariables = unknown> {
  signal: AbortSignal;
  variables?: TVariables;
}

export type Fetcher<TData, TVariables = unknown> = (ctx: FetcherContext<TVariables>) => Promise<TData>;

export interface QueryOptions<TData = unknown, TError = unknown, TSelect = TData, TVariables = unknown> {
  enabled?: boolean;
  staleTime?: number; // ms
  cacheTime?: number; // ms (GC)
  retry?: RetryOption; // default 3
  retryDelay?: RetryDelayOption; // default exponential + jitter
  refetchOnMount?: boolean | 'always';
  refetchOnWindowFocus?: boolean | 'always';
  refetchOnReconnect?: boolean | 'always';
  suspense?: boolean;
  initialData?: TData;
  initialDataUpdatedAt?: number; // epoch ms
  select?: (data: TData) => TSelect;
  structuralSharing?: boolean; // shallow compare and reuse object references
  keepPreviousData?: boolean;
  variables?: TVariables; // passed to fetcher
}

export interface MutationOptions<TData = unknown, TError = unknown, TVariables = unknown, TContext = unknown> {
  onMutate?: (variables: TVariables, helpers: { client: QueryClient }) => Promise<TContext> | TContext;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined, helpers: { client: QueryClient }) => void;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined, helpers: { client: QueryClient }) => void;
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, helpers: { client: QueryClient }) => void;
  retry?: RetryOption;
  retryDelay?: RetryDelayOption;
}

export interface QueryClientOptions {
  defaultOptions?: Partial<QueryOptions>;
}

export interface DevtoolsEvent {
  type: string;
  key?: string;
  payload?: unknown;
  timestamp: number;
}

export interface QueryClient {
  prefetch<TData, TVariables = unknown>(key: QueryKey, fetcher: Fetcher<TData, TVariables>, options?: QueryOptions<TData, unknown, TData, TVariables>): Promise<TData>;
  invalidate(key: QueryKey): void;
  setQueryData<TData>(key: QueryKey, updater: ((old: TData | undefined) => TData) | TData, opts?: { optimistic?: boolean }): void;
  getQueryData<TData>(key: QueryKey): TData | undefined;
  subscribe(listener: (evt: DevtoolsEvent) => void): () => void;
  _internal: {
    ensureEntry: (key: QueryKey) => QueryEntry<any>;
    getEntry: (key: QueryKey) => QueryEntry<any> | undefined;
    focusManager: FocusManager;
    onlineManager: OnlineManager;
  }
}

export interface QueryEntry<TData> {
  keyHash: string;
  key: QueryKey;
  data?: TData;
  error?: unknown;
  status: Status;
  updatedAt: number; // epoch ms
  observers: number;
  promise?: Promise<TData>;
  ac?: AbortController;
  options: QueryOptions<TData, unknown, TData, unknown>;
}

export interface FocusManager {
  isFocused(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface OnlineManager {
  isOnline(): boolean;
  subscribe(listener: () => void): () => void;
}
