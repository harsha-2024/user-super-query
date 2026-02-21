
export function defaultRetryDelay(failureCount: number): number {
  // Exponential backoff with jitter (base 500ms)
  const base = 500 * Math.pow(2, failureCount);
  const jitter = Math.random() * 0.3 * base;
  return Math.min(30_000, base + jitter);
}
