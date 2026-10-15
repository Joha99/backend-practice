// Guided: a cache for verified-identity profiles. You grow ONE function,
// createProfileCache, one step at a time. See README.md in this folder.
//
// The scenario (design/02-caching-verified-profiles.md): businesses ask "is
// this person still verified?" thousands of times a minute. The database
// answer takes ~200 ms and costs money. A cache keeps recent answers in
// memory so most requests never reach the database.
//
// Frontend analogy for the whole thing: this is React Query / SWR, but on the
// server and shared by every user of the API.
//
// Time is passed in as `now` (ms), like the rate limiter, so tests control it.
//
// ---------------------------------------------------------------------------
// Step 1: read-through + TTL ("time to live").
//   get(id, now):
//   - If the cache has a FRESH answer for id, return it. No database call.
//   - Otherwise call loadProfile(id), store the answer, return it.
//   - An answer is fresh for ttlMs after it was STORED. At exactly
//     storedAt + ttlMs it's expired (same boundary rule as your rate limiter).
//   - Step 1 only caches FOUND profiles. A null ("no such profile") is
//     returned but not stored (Step 2 changes that).
//   Analogy: React Query's `staleTime`.
//
// Step 2: negative caching (`negativeTtlMs`, optional, default 0).
//   A null answer is ALSO cached, for negativeTtlMs (usually much shorter than
//   ttlMs). Why: lookups for profiles that don't exist (typos, attackers
//   guessing ids) would otherwise hit the database every single time.
//   negativeTtlMs 0 (the default) means "don't cache nulls" (Step 1 behavior).
//
// Step 3: a size limit with LRU eviction (`maxEntries`, optional, default
//   Infinity) and size().
//   - At most maxEntries ids are cached. Storing one more evicts the LEAST
//     RECENTLY USED id. A get() that returns a cached answer counts as a use.
//     Replacing an id that's already cached doesn't evict anything.
//   - size() returns how many ids are cached (expired ones may still count
//     until they're touched; that's fine).
//   Hint: a Map remembers insertion order. Deleting a key and setting it
//   again moves it to the END.
//   Analogy: React Query's garbage collection, but by count instead of time.
//
// Step 4: single-flight (stampede protection).
//   A popular profile expires and 1,000 requests for it arrive in the same
//   instant. Without protection: 1,000 database reads ("stampede").
//   - If get(id) is called while a database read for that id is already in
//     flight, DON'T start another one: wait for the same read.
//     All callers get the same answer.
//   - If that read fails (rejects), every waiting caller gets the error,
//     nothing is cached, and the next get(id) tries the database again.
//   Analogy: React Query dedupes identical queries that are in flight.
//
// Step 5: invalidation, and the race that comes with it.
//   invalidate(id): a profile changed (e.g. verification REVOKED), so drop
//   the cached answer: the next get(id) reads the database.
//   The race: a read starts → the profile is revoked + invalidate(id) runs →
//   the read finishes with the OLD "verified" row. If you store it, you're
//   now serving "verified" for a revoked person for a whole ttlMs.
//   - If invalidate(id) is called while a read for id is in flight, that
//     read's answer must NOT be stored when it arrives. (Callers already
//     waiting on it still receive it: they asked before the change.)
//   - A get(id) that starts AFTER invalidate(id) must not join the old
//     in-flight read: it starts a fresh one.
//   Analogy: a stale fetch response landing after a newer one, the reason you
//   ignore out-of-date responses in a useEffect.
// ---------------------------------------------------------------------------

import type { Profile } from "./profileDb.ts";

export function createProfileCache(options: {
  loadProfile: (id: string) => Promise<Profile | null>;
  ttlMs: number;
  negativeTtlMs?: number;
  maxEntries?: number;
}) {
  async function get(id: string, now: number): Promise<Profile | null> {
    // TODO
    void options;
    void id;
    void now;
    throw new Error("not implemented");
  }

  function size(): number {
    // TODO (Step 3)
    throw new Error("not implemented");
  }

  function invalidate(id: string): void {
    // TODO (Step 5)
    void id;
    throw new Error("not implemented");
  }

  return { get, size, invalidate };
}
