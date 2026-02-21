
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createQueryClient, useSuperQuery, useSuperMutation } from '../src';

const client = createQueryClient({ defaultOptions: { refetchOnWindowFocus: true, staleTime: 30_000 } });

function Users() {
  const { data, status, error, isFetching, refetch } = useSuperQuery(
    client,
    ['users'],
    async ({ signal }) => {
      const res = await fetch('https://jsonplaceholder.typicode.com/users', { signal });
      if (!res.ok) throw new Error('Failed to load users');
      return res.json() as Promise<Array<{ id: number; name: string }>>;
    },
    { staleTime: 60_000 }
  );

  return (
    <div>
      <h2>Users</h2>
      <button onClick={() => refetch()} disabled={isFetching}>Refetch</button>
      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p style={{color:'red'}}>Error: {String(error)}</p>}
      {status === 'success' && <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>}
    </div>
  );
}

function App() {
  return (
    <div>
      <h1>use-super-query demo</h1>
      <Users />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
