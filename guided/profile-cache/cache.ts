// A cache in front of a slow database. Like React Query, but on the server.
// You build createProfileCache one step at a time. `now` is the time in ms.
//
// Step 1: get(id, now)
//   - Fresh answer cached? Return it (no database call).
//   - Otherwise: loadProfile(id), save it, return it.
//   - "Fresh" = less than ttlMs since it was saved.
//   - Don't save null (not found) yet.
//
// Step 2: also save null, but only for negativeTtlMs (default 0 = don't).
//
// Step 3: keep at most maxEntries. When full, drop the one used longest ago.
//   size() = how many are saved. (Hint: a Map keeps insertion order.)
//
// Step 4: if a database read for this id is already running, wait for that
//   one instead of starting another. If it fails, save nothing.
//
// Step 5: invalidate(id) drops the saved answer. A read that was already
//   running when invalidate() was called must not be saved when it finishes.

import type { Profile } from "./profileDb.ts";

export function createProfileCache(options: {
  loadProfile: (id: string) => Promise<Profile | null>;
  ttlMs: number;
  negativeTtlMs?: number;
  maxEntries?: number;
}) {
  const { loadProfile, ttlMs, negativeTtlMs, maxEntries } = options;

  // keep a local cache
  const cache = new Map<
    Profile["id"],
    { expiresAt: number; profile: Profile | null }
  >();

  async function get(id: string, now: number): Promise<Profile | null> {
    const cached = cache.get(id);

    // cached data is fresh
    if (cached && now < cached.expiresAt) {
      return cached.profile;
    }

    // retrieve profile from database if profile is not in cache or cache data is not fresh
    const profile = await loadProfile(id);

    if (profile) {
      cache.set(id, { expiresAt: now + ttlMs, profile });
      return profile;
    }

    // if profile is not in the database, save the non existent profile to the cache
    // so that we don't hit the server on another request for this missing data
    if (negativeTtlMs !== undefined) {
      cache.set(id, { expiresAt: now + negativeTtlMs, profile: null });
    }

    // no match in cache or database
    return null;
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
