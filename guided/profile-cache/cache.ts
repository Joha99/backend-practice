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

  const cache = new Map<
    Profile["id"],
    { expiresAt: number; profile: Profile | null }
  >();

  const inFlight = new Map<Profile["id"], Promise<Profile | null>>();

  async function get(id: string, now: number): Promise<Profile | null> {
    const cached = cache.get(id);

    // pull existing profile from cache if the data is fresh
    if (cached && now < cached.expiresAt) {
      // move the data to the end of the map so that it's not accidentally removed when cache size hits limit
      const cachedProfile = cached;
      cache.delete(id);
      cache.set(id, cachedProfile);
      return cachedProfile.profile;
    }

    // expired cached profile may still exist so delete it
    cache.delete(id);

    // if a database read for this id is already running, wait for that instead of reading from the database
    const inFlightRequest = inFlight.get(id);

    if (inFlightRequest) {
      return await inFlightRequest;
    }

    // retrieve profile from database
    const request = loadProfile(id)
      .then((profile) => {
        // if the profile doesn't exist and we want to save non-existent profiles to the cache,
        // we use negativeTtlMs to calculate expired timestamp
        const ttl = profile ? ttlMs : negativeTtlMs;

        // profile exists in database or we want to save non-existent profiles
        if (ttl) {
          // remove the LRU if we hit limit in cache
          if (maxEntries && cache.size >= maxEntries) {
            cache.delete(cache.keys().next().value!);
          }

          cache.set(id, { expiresAt: now + ttl, profile: profile });
        }

        return profile;
      })
      .finally(() => {
        inFlight.delete(id);
      });

    inFlight.set(id, request);
    return await request;
  }

  function size(): number {
    return cache.size;
  }

  function invalidate(id: string): void {
    // TODO (Step 5)
    void id;
    throw new Error("not implemented");
  }

  return { get, size, invalidate };
}
