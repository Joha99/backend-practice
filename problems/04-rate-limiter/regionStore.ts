/**
 * PROVIDED for Part B (don't edit). A fake per-region counter store,
 * standing in for a Redis cluster that lives in one region.
 *
 * - incr(key, windowId) adds 1 to the counter for (key, windowId) and
 *   returns the new count. Counters for old windows are never read again.
 * - setDown(true) simulates a regional outage: every call throws
 *   StoreUnavailableError until setDown(false).
 * - `calls` counts every incr() attempt, including ones that threw, so tests
 *   can check you aren't hammering a store that is down.
 *
 * Each region's store is separate: counts are NOT replicated between them.
 */

export class StoreUnavailableError extends Error {
  readonly region: string;

  constructor(region: string) {
    super(`store in ${region} is unavailable`);
    this.name = "StoreUnavailableError";
    this.region = region;
  }
}

export class RegionStore {
  readonly region: string;
  calls = 0;
  private down = false;
  private readonly counts = new Map<string, number>();

  constructor(region: string) {
    this.region = region;
  }

  setDown(down: boolean) {
    this.down = down;
  }

  incr(key: string, windowId: number): number {
    this.calls++;
    if (this.down) throw new StoreUnavailableError(this.region);
    const id = `${key}:${windowId}`;
    const next = (this.counts.get(id) ?? 0) + 1;
    this.counts.set(id, next);
    return next;
  }
}
