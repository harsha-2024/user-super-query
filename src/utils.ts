
import type { QueryKey } from './types';

export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(value, function replacer(key, val) {
    if (val && typeof val === 'object') {
      if (seen.has(val as object)) return;
      seen.add(val as object);
      if (!Array.isArray(val)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(val as Record<string, unknown>).sort()) {
          (sorted as any)[k] = (val as any)[k];
        }
        return sorted;
      }
    }
    return val;
  });
}

export function hashKey(key: QueryKey): string {
  return stableStringify(key);
}

export function now(): number { return Date.now(); }

export function shallowEqual<T extends Record<string, any>>(a?: T, b?: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}
