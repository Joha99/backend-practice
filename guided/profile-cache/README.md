# Guided: Build a Profile Cache, One Small Step at a Time

The coding companion to `design/02-caching-verified-profiles.md`. You grow one function, `createProfileCache`, in `cache.ts`. Each step has a short spec in the comment at the top of `cache.ts` and its own small test.

**If you know React Query or SWR, you already know most of this.** A server cache is the same idea: keep answers for a while, refetch when they're stale, don't fire the same request twice, and throw answers away when the data changes. The differences: it's on the server, and it's shared by every user of the API.

`profileDb.ts` is provided: a fake database you don't need to edit. Tests use its knobs (`calls`, `paused` + `release()`, `failNext`) to count reads and control when they finish.

Run a step's test:

```bash
node --test guided/profile-cache/step01.test.ts
```

All steps so far:

```bash
node --test 'guided/profile-cache/*.test.ts'
```

## Steps

| Step | You build | Concept | React Query equivalent |
| --- | --- | --- | --- |
| 1 | `get(id, now)`: read-through cache with a TTL | serve from memory while fresh; reload when expired | `staleTime` |
| 2 | `negativeTtlMs`: cache "not found" too | stop missing ids from hammering the database | (no direct equivalent) |
| 3 | `maxEntries` + LRU eviction, `size()` | memory is limited; drop what's least recently used | `gcTime` (by time, not count) |
| 4 | single-flight | 1,000 simultaneous misses → 1 database read ("stampede protection") | dedupes identical in-flight queries |
| 5 | `invalidate(id)` + the in-flight race | after a write, drop the cached copy, and don't let a read that started before the write store old data | `invalidateQueries` + ignoring stale responses |

Time target: ~75 min for all five. Step 5 is the one interviewers love.

## After each step: say it out loud

ID.me's caching questions (from `design/02`) map to these steps:

- **Step 1:** What's the trade-off a TTL makes? For a *verification status*, how long is too long? (The prompt says revocations must show up within 5 s, but profile names can be 5 min stale. Can one TTL serve both?)
- **Step 2:** Why cache "not found"? Why keep that TTL short? Is caching "not verified" dangerous for a verification API?
- **Step 3:** How do you decide `maxEntries`? (Use the numbers: 200 million profiles × 2 KB, and the top 1% get 60% of reads.) Why LRU for this traffic?
- **Step 4:** Single-flight protects one server. With 100 servers, the same expiry still causes 100 database reads. What would you do about that? (Ideas: a shared cache like Redis, slightly random TTLs so keys don't all expire together, refreshing hot keys before they expire.)
- **Step 5:** Draw the race on a timeline: read starts → revoke + invalidate → read finishes. What gets cached without the fix, and for how long? With 100 servers each holding their own cache, how does an invalidation reach all of them? (Ideas: a shared cache, a pub/sub message to every server, a short TTL as a backstop if a message is lost.)

## When you're done

`problems/10-read-through-cache/` is the same set of ideas as one un-guided problem (as a class, with all requirements at once). Try it timed later as a check.
