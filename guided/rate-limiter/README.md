# Guided: Build a Rate Limiter, One Small Step at a Time

You build the rate limiter for the identity-verification API piece by piece, in one file: `limiter.ts`. Each step adds a little code and has its own small test.

Run a step's test:

```bash
node --test guided/rate-limiter/step01.test.ts
```

Earlier steps' tests should keep passing as you go. Run them all with:

```bash
node --test guided/rate-limiter/*.test.ts
```

## Steps

| Step | You build | Concept |
| --- | --- | --- |
| ✅ 1 | `allowRequest(key)`: allow the first N requests per key, reject the rest | a server remembers things between requests; counting per key with a `Map` |
| ✅ 2 | …only count requests inside a time window | fixed windows; passing in the time (`now`) so tests can control it |
| ✅ 3 | prove the fixed window's weak spot | the 2× burst at a window boundary |
| ✅ 4 | a token bucket (per-customer limit) | allowing bursts while limiting the average; lazy refill |
| ✅ 5 | `check()` returns `limit`, `remaining`, `retryAfterSeconds` | turning limiter state into the response headers |
| ✅ 6 | a sliding window log (per-document fraud limit) | an EXACT limit over any rolling window |
| 7 | `createVerificationLimits()`: customer + document limits together | combining two limits, and which order to check them |
| ~~8~~ | ~~the HTTP route: 200 vs 429 + headers~~ | skipped: you know this from the frontend side |
| 9 | naive vs atomic limiter on a shared store (`sharedStore.ts`) | why 20 servers can't each keep their own `Map`; the read-then-write race; atomic increments (Redis `INCR`) |
| 10 | `createResilientLimiter()`: when the store is down | fail open vs fail closed; a local fallback count |
| 11 | `createMultiRegionLimiter()`: home region + failover | one count per key across regions; what failover costs |
| 12 | …add a circuit breaker (`probeAfterMs`) | stop calling a dead store, then probe it ("half-open") |

Steps 9–12 are `async` because the store is a network call. `sharedStore.ts` is provided: a fake Redis you don't need to edit. Read its comments first.

## After each step: say it out loud

These are the questions ID.me is likely to ask. Answer each in 2–3 sentences, out loud.

- **Step 7:** Why check the customer limit before the document limit? What goes wrong the other way round?
- **Step 9:** Why can't each server keep its own `Map`? What exactly goes wrong with "read, check, write" when two servers run at once? Why does one `incr` fix it?
- **Step 10:** For an *identity-verification* API, which limit should fail closed and which should fail open? (Hint: one protects against fraud, one protects cost and fairness.)
- **Step 11:** During failover the count restarts in the backup region. What's the most a key can get through in one window? How would you shrink that?
- **Step 12:** What does a circuit breaker save you, for your users and for the store that's trying to recover?
