
# use-super-query

A robust, production-ready custom React hooks mini-library for large-scale apps.

**Highlights**

- ⚡ **SWR cache** with stale/fresh timestamps, GC, and structural sharing
- 🔁 **Retries** with exponential backoff + jitter and **abortable** fetches
- 🧵 **Request deduplication** per key + in-flight coalescing
- 👀 **Refetch on window focus** and 🌐 **on reconnect** (configurable)
- 🧭 **Background revalidation**, `staleTime`, `cacheTime`, `refetchOnMount`
- 🧰 **Query Client API** (`prefetch`, `invalidate`, `setQueryData`, `getQueryData`)
- 🧩 **Plugin & devtools events** (`superquery:*`)
- 🧪 **TypeScript-first** with strong generics and selectors
- 🧯 **Optimistic updates** & rollback via `useSuperMutation`
- 🧊 **SSR hydration** with `initialData`/`initialDataUpdatedAt`

> Think of it as a small, readable, dependency-light alternative inspired by React Query/SWR—designed for learning and customization.

## Quick Start

```bash
pnpm add use-super-query # or npm i / yarn add
```

```tsx
import React from 'react';
import { createQueryClient, useSuperQuery } from 'use-super-query';

const client = createQueryClient();

function Users() {
  const { data, status, error, refetch } = useSuperQuery(
    client,
    ['users'],
    async ({ signal }) => {
      const res = await fetch('https://jsonplaceholder.typicode.com/users', { signal });
      if (!res.ok) throw new Error('Failed to load users');
      return res.json() as Promise<Array<{ id: number; name: string }>>;
    },
    {
      staleTime: 60_000,
      retry: 3,
      refetchOnWindowFocus: true,
    }
  );

  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'error') return <p>Error: {String(error)}</p>;

  return (
    <div>
      <button onClick={() => refetch()}>Refetch</button>
      <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>
    </div>
  );
}
```

### Mutation with optimistic update

```tsx
import { useSuperMutation } from 'use-super-query';

function AddUser() {
  const mutation = useSuperMutation(
    async ({ signal, variables: newUser }) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
        headers: { 'Content-Type': 'application/json' },
        signal,
      });
      if (!res.ok) throw new Error('Create failed');
      return res.json();
    },
    {
      onMutate: async (vars, { client }) => {
        const prev = client.getQueryData(['users']);
        client.setQueryData(['users'], (old: any[] = []) => [{ id: 'temp', ...vars }, ...old], { optimistic: true });
        return { prev };
      },
      onError: (err, vars, ctx, { client }) => {
        if (ctx?.prev) client.setQueryData(['users'], ctx.prev);
      },
      onSettled: (_d, _e, _v, { client }) => client.invalidate(['users']),
    }
  );

  // ... render mutation.status etc.
}
```

## API

- `createQueryClient(options?)` → `client`
  - `client.prefetch(key, fetcher, options?)`
  - `client.invalidate(key)`
  - `client.setQueryData(key, updater, opts?)`
  - `client.getQueryData(key)`
  - `client.subscribe(listener)` (devtools)
- `useSuperQuery(client, key, fetcher, options?)`
- `useSuperMutation(fetcher, options?)`

See `examples/App.tsx` for a live usage example.

## Concepts

- **Key** — an array (`readonly unknown[]`) that uniquely identifies a query.
- **Freshness** — `staleTime` controls when data is considered stale.
- **GC** — when no observers, entries are garbage-collected after `cacheTime`.
- **Dedup** — multiple components with the same key share a single in-flight request.

## License

MIT
