/**
 * Performance Instrumentation for Frost Guard
 *
 * Lightweight markers for measuring key paths:
 * - Supabase fetches
 * - React Query resolve times
 * - Component render times
 * - Realtime event latency
 */

const DEV = import.meta.env.DEV;

interface PerformanceMark {
  name: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

const activeMarks = new Map<string, PerformanceMark>();

/**
 * Start a performance measurement
 */
export function perfStart(name: string, metadata?: Record<string, unknown>): void {
  if (!DEV) return;

  activeMarks.set(name, {
    name,
    startTime: performance.now(),
    metadata,
  });
}

/**
 * End a performance measurement and log the result
 */
export function perfEnd(name: string, additionalMetadata?: Record<string, unknown>): number {
  if (!DEV) return 0;

  const mark = activeMarks.get(name);
  if (!mark) {
    return 0;
  }

  const elapsed = Math.round(performance.now() - mark.startTime);
  activeMarks.delete(name);

  return elapsed;
}

/**
 * Measure an async function's execution time
 */
export async function perfMeasure<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  perfStart(name, metadata);
  try {
    const result = await fn();
    perfEnd(name, { success: true });
    return result;
  } catch (error) {
    perfEnd(name, { success: false, error: String(error) });
    throw error;
  }
}

/**
 * Supabase query wrapper with timing
 */
export async function timedQuery<T>(
  queryName: string,
  queryFn: () => Promise<{ data: T; error: unknown }>
): Promise<{ data: T; error: unknown; durationMs: number }> {
  const startTime = performance.now();
  const result = await queryFn();
  const durationMs = Math.round(performance.now() - startTime);

  return { ...result, durationMs };
}

/**
 * Log realtime event latency (from recorded_at to now)
 */
export function logRealtimeLatency(eventName: string, recordedAt: string | Date): void {
  if (!DEV) return;
}

/**
 * Performance summary for debugging
 */
export function perfSummary(): void {
  if (!DEV) return;
}
