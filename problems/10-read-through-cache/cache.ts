/**
 * Read-Through Cache: TTLs, LRU eviction, stampede protection
 *
 * Put a cache in front of a slow "origin" (a database or another service).
 * Context: looking up a verified identity profile is slow (~200ms) and the
 * same profiles are read thousands of times a minute.
 *
 *   const cache = new ReadThroughCache({ loader, ttlMs, negativeTtlMs, maxEntries, now })
 *   await cache.get("user-1")   // value, or null if the origin has nothing
 *   cache.invalidate("user-1")  // after a write, drop the cached copy
 *
 * loader(key) => Promise<V | null> is the origin. null means "not found".
 * Time is injected via now() (ms) and only affects expiry.
 *
 * Requirements:
 * 1. Read-through: get() returns the cached value if present and fresh;
 *    otherwise calls loader, caches the result, and returns it.
 * 2. TTL: a value is fresh for ttlMs after it was loaded. Expired values
 *    are reloaded on the next get().
 * 3. Negative caching: a null result is cached too, but only for
 *    negativeTtlMs (usually shorter), so lookups for missing keys don't
 *    hit the origin every time.
 * 4. LRU: at most maxEntries keys are cached. Inserting beyond that evicts
 *    the LEAST RECENTLY USED key. A get() that hits counts as a use.
 * 5. Stampede protection ("single-flight"): if many get(key) calls arrive
 *    while that key is loading, the loader runs ONCE and they all receive
 *    the same result.
 * 6. Errors: if loader rejects, every caller waiting on that load gets the
 *    rejection, nothing is cached, and the next get() tries again.
 * 7. invalidate(key) removes the cached value. If a load for that key is
 *    IN FLIGHT when invalidate() is called, its result must NOT be cached
 *    when it finishes (it may contain data from before the write). Callers
 *    already waiting on it still receive it.
 * 8. size() -> number of cached keys (in-flight loads don't count).
 *
 * Questions to answer in a comment once you're done:
 * - Requirement 7 is a race. Draw the timeline: load starts, a write
 *   happens + invalidate, load finishes. What would be cached without the
 *   fix, and for how long?
 * - With 20 app servers, each has its own in-memory cache. What goes wrong
 *   after invalidate() runs on just one server? Options: shared cache
 *   (Redis), pub/sub invalidation, short TTLs. Trade-offs?
 * - Cache-aside vs read-through vs write-through: who is responsible for
 *   filling the cache in each?
 * - Hot key expires and 10,000 requests arrive in the same 200ms: single
 *   flight handles one server. What about 20 servers sharing Redis?
 *
 * Run tests: node --test problems/10-read-through-cache/*.test.ts
 * Time target: 50 minutes.
 */

export type Clock = () => number;

export type CacheOptions<V> = {
  loader: (key: string) => Promise<V | null>;
  ttlMs: number;
  negativeTtlMs: number;
  maxEntries: number;
  now?: Clock;
};

export class ReadThroughCache<V> {
  readonly opts: CacheOptions<V>;
  readonly now: Clock;

  constructor(opts: CacheOptions<V>) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  async get(key: string): Promise<V | null> {
    // TODO: implement
    void key;
    throw new Error("not implemented");
  }

  invalidate(key: string): void {
    // TODO: implement
    void key;
    throw new Error("not implemented");
  }

  size(): number {
    // TODO: implement
    throw new Error("not implemented");
  }
}
