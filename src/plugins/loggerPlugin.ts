
import type { QueryClient } from '../types';

export function attachLoggerPlugin(client: QueryClient): () => void {
  return client.subscribe(evt => {
    if (!String(evt.type).startsWith('superquery:')) return;
    // eslint-disable-next-line no-console
    console.debug(`[use-super-query]`, evt.type, evt.payload);
  });
}
