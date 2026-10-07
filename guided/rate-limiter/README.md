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

New steps are added as you finish the previous one.

| Step | You build | Concept |
| --- | --- | --- |
| 1 | `allowRequest(key)`: allow the first N requests per key, reject the rest | a server remembers things between requests; counting per key with a `Map` |
| 2 | …only count requests inside a time window | fixed windows; passing in the time (`now`) so tests can control it |
| 3 | prove the fixed window's weak spot | the 2× burst at a window boundary |
| 4 | a token bucket | allowing bursts while limiting the average |
| 5 | return `remaining` and `resetSeconds` | turning limiter state into the response headers |
| 6 | `checkLimits({ apiKey, documentNumber })` | combining two limits, and which order to check them |
| 7 | the HTTP route: 200 vs 429 + headers | servers, routes, middleware |
| 8 | move counters into a shared store | why 20 servers can't each keep their own `Map`; Redis; atomic increments |
| 9 | when the store is down | fail open vs fail closed; a backup local count |
| 10 | multiple regions | home regions, failover, circuit breakers |
