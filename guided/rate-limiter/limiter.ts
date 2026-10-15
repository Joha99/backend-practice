// Guided rate limiter. You grow this file one step at a time.
// See README.md in this folder for the step list.

import { StoreUnavailableError, type SharedStore } from "./sharedStore.ts";

type ApiKey = string;
type DocumentNumber = string;
type Timestamp = number;

interface TokenBucketValue {
  /**
   * Time of last update for some API key.
   */
  updatedAt: number;
  /**
   * Tokens left in the bucket for some API key.
   */
  tokens: number;
}

// ---------------------------------------------------------------------------
// Step 1: allow the first `limit` requests for each key, reject the rest.
// ---------------------------------------------------------------------------
export function createCounterLimiter(limit: number) {
  const tokenBucket = new Map<ApiKey, number>();

  function allowRequest(key: string): boolean {
    let newTokenCount = 0;
    const tokensLeft = tokenBucket.get(key);

    if (!tokensLeft) {
      newTokenCount = 1;
    } else {
      newTokenCount = tokensLeft + 1;
    }

    if (newTokenCount <= limit) {
      tokenBucket.set(key, newTokenCount);
      return true;
    }

    return false;
  }

  return { allowRequest };
}

// ---------------------------------------------------------------------------
// Step 2: fixed window. At most `limit` requests per key in each window of
// `windowMs` milliseconds (e.g. 5 per 60,000 ms = 5 per minute).
// The caller passes in the current time (`now`, in ms) instead of the
// function calling Date.now(), so tests can control time.
// ---------------------------------------------------------------------------
export function createFixedWindowLimiter(limit: number, windowMs: number) {
  let tokenBucket = new Map<ApiKey, number>();
  let currentWindow = 0;

  function allowRequest(key: string, now: number): boolean {
    if (limit === 0) return false;

    const newWindow = Math.floor(now / windowMs);

    // Disgard the old tokenBucket when we enter a new window
    if (newWindow > currentWindow) {
      tokenBucket = new Map<ApiKey, number>();
      currentWindow = newWindow;
    }

    const previousTokenCount = tokenBucket?.get(key) ?? 0;

    if (previousTokenCount < limit) {
      tokenBucket.set(key, previousTokenCount + 1);
      return true;
    }

    return false;
  }

  // How many tokenBucket are stored right now (used by a test to check that old
  // windows don't pile up forever).
  function size(): number {
    return tokenBucket.size;
  }

  return { allowRequest, size };
}

// ---------------------------------------------------------------------------
// Step 4: token bucket. Each key has a bucket holding up to `capacity`
// tokens. A request takes 1 token; with no token it's rejected. Tokens come
// back at `refillPerSecond` (fractions are fine, e.g. 0.5 tokens).
// A key that has never been seen starts with a FULL bucket.
// ---------------------------------------------------------------------------
export function createTokenBucketLimiter(
  capacity: number,
  refillPerSecond: number,
) {
  const tokenBucket = new Map<ApiKey, TokenBucketValue>();

  function allowRequest(key: string, now: number): boolean {
    return check(key, now).allowed;
  }

  function check(
    key: string,
    now: number,
  ): {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfterSeconds: number;
  } {
    if (capacity === 0) {
      return {
        allowed: false,
        limit: capacity,
        remaining: 0,
        retryAfterSeconds: 0,
      };
    }

    const customerBucket = tokenBucket.get(key);

    // First request made by customer
    if (!customerBucket) {
      const newBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: capacity - 1,
      };

      tokenBucket.set(key, newBucket);

      return {
        allowed: true,
        limit: capacity,
        remaining: capacity - 1,
        retryAfterSeconds: 0,
      };
    }

    const secSinceLastRequest = (now - customerBucket.updatedAt) / 1000;
    const currTokenCount = customerBucket.tokens;
    const refilledTokenCount = secSinceLastRequest * refillPerSecond;

    const newTokenCount = Math.min(
      capacity,
      currTokenCount + refilledTokenCount,
    );

    if (newTokenCount >= 1) {
      const updatedBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: newTokenCount - 1,
      };

      tokenBucket.set(key, updatedBucket);

      return {
        allowed: true,
        limit: capacity,
        remaining: Math.floor(newTokenCount - 1),
        retryAfterSeconds: 0,
      };
    }

    const retryAfterSeconds = (1 - newTokenCount) / refillPerSecond;

    return {
      allowed: false,
      limit: capacity,
      remaining: Math.floor(newTokenCount),
      retryAfterSeconds: Math.ceil(retryAfterSeconds),
    };
  }

  return { allowRequest, check };
}

// ---------------------------------------------------------------------------
// Step 6: sliding window LOG. Used for the per-document fraud limit:
// at most `limit` ALLOWED requests per key in ANY window of `windowMs`
// (e.g. 3 per 10 minutes), counting back from `now`. A request exactly
// `windowMs` old has left the window.
// Rejected requests are not recorded.
// ---------------------------------------------------------------------------
export function createSlidingWindowLogLimiter(limit: number, windowMs: number) {
  const timestampsByDocument: Map<DocumentNumber, Timestamp[]> = new Map();

  function check(
    key: string,
    now: number,
  ): {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfterSeconds: number;
  } {
    if (!timestampsByDocument.has(key)) {
      timestampsByDocument.set(key, [now]);

      return {
        allowed: true,
        limit: limit,
        remaining: limit - 1,
        retryAfterSeconds: 0,
      };
    }

    const lowerLimit = now - windowMs;
    const prunedTimestamps = timestampsByDocument
      .get(key)!
      .filter((stamp) => stamp > lowerLimit);

    if (prunedTimestamps.length >= limit) {
      const oldestRequest = prunedTimestamps[0];
      const timeLeftMs = oldestRequest + windowMs - now;

      return {
        allowed: false,
        limit: limit,
        remaining: 0,
        retryAfterSeconds: Math.ceil(timeLeftMs / 1000),
      };
    }

    const updatedTimestamps = [...prunedTimestamps, now];
    timestampsByDocument.set(key, updatedTimestamps);

    return {
      allowed: true,
      limit: limit,
      remaining: limit - updatedTimestamps.length,
      retryAfterSeconds: 0,
    };
  }

  // Total number of timestamps stored across all keys (used by a test to
  // check that old ones are thrown away).
  function size(): number {
    let count = 0;

    for (const item of timestampsByDocument) {
      count += item[1].length;
    }

    return count;
  }

  return { check, size };
}

// ---------------------------------------------------------------------------
// Step 7: two limits on one request.
//
// A verification request is checked against BOTH:
//   - the CUSTOMER limit (token bucket, Step 4): keyed by apiKey. Protects
//     cost + fairness between businesses.
//   - the DOCUMENT limit (sliding log, Step 6): keyed by documentNumber,
//     ACROSS all API keys. Protects against fraud (someone testing stolen IDs
//     through several different businesses).
//
// Rules:
//   1. Check the customer limit FIRST. If it rejects, return right away and
//      DON'T touch the document limit: a request we refused because the
//      customer was too busy must not use up one of the document's 3 attempts.
//   2. If the customer limit allows it but the document limit rejects, the
//      customer's token stays spent. (They did send us a request.)
//   3. Return which limit rejected it (or null), and that limit's
//      retryAfterSeconds (0 when allowed).
//
// Reuse your Step 4 and Step 6 factories inside this one.
// ---------------------------------------------------------------------------
export function createVerificationLimits(options: {
  customer: { capacity: number; refillPerSecond: number };
  document: { limit: number; windowMs: number };
}) {
  const { check: checkApiKey, allowRequest } = createTokenBucketLimiter(
    options.customer.capacity,
    options.customer.refillPerSecond,
  );

  const { check: checkDocumentId, size } = createSlidingWindowLogLimiter(
    options.document.limit,
    options.document.windowMs,
  );

  function checkLimits(request: {
    apiKey: string;
    documentNumber: string;
    now: number;
  }): {
    allowed: boolean;
    rejectedBy: "customer" | "document" | null;
    retryAfterSeconds: number;
  } {
    const customerCheckResult = checkApiKey(request.apiKey, request.now);

    if (!customerCheckResult.allowed) {
      return {
        allowed: false,
        rejectedBy: "customer",
        retryAfterSeconds: customerCheckResult.retryAfterSeconds,
      };
    }

    const documentCheckResult = checkDocumentId(
      request.documentNumber,
      request.now,
    );

    if (!documentCheckResult.allowed) {
      return {
        allowed: false,
        rejectedBy: "document",
        retryAfterSeconds: documentCheckResult.retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      rejectedBy: null,
      retryAfterSeconds: 0,
    };
  }

  return { checkLimits };
}

// ---------------------------------------------------------------------------
// Step 8 is skipped: it's the HTTP route (200 vs 429 + headers), which you
// already know from the frontend side.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step 9: move the count into a SHARED store.
//
// Why: the API runs on many servers. If each keeps its own Map, a customer
// spread over 20 servers gets 20x the limit (like every browser tab keeping
// its own counter in useState). So the counts move into one store that every
// server talks to: `SharedStore` in sharedStore.ts (a fake Redis). Every
// call to it is async, like a fetch.
//
// We use a FIXED window here (Step 2's idea) because it's one number per key,
// which keeps the store part simple. Store key: `${key}:${windowId}` where
// windowId = Math.floor(now / windowMs). Give stored values a ttlMs of
// windowMs so old windows clean themselves up.
//
// Part A: createNaiveSharedLimiter. Read the count with get(), check it,
//   then write count + 1 with set(). It works for one request at a time.
//   The step09 test then runs several requests AT THE SAME TIME from two
//   "servers", and shows more than `limit` get through. Make that test pass
//   by implementing the naive version honestly: get, then set.
//   Why it breaks: between your `await store.get()` and `await store.set()`,
//   other requests run their get() too and all see the same old count. Same
//   bug as two async click handlers both reading stale state, then both
//   calling setState.
//
// Part B: createAtomicSharedLimiter. Fix it with ONE store.incr() call:
//   the store adds 1 and returns the new count in a single step that nothing
//   can interrupt ("atomic"). Allowed if the new count <= limit.
//   (This counts rejected requests too. That's the usual Redis pattern and
//   it's fine for a fixed window.)
// ---------------------------------------------------------------------------
export function createNaiveSharedLimiter(
  store: SharedStore,
  limit: number,
  windowMs: number,
) {
  async function allowRequest(key: string, now: number): Promise<boolean> {
    if (limit === 0) {
      return false;
    }

    const newWindow = Math.floor(now / windowMs);
    const storeKey = `${key}:${newWindow}`;
    const requestCount = await store.get(storeKey);
    const ttlMs = (newWindow + 1) * windowMs - now;

    // either first request or new window
    if (requestCount === null) {
      await store.set(storeKey, 1, ttlMs);
      return true;
    }

    if (requestCount < limit) {
      await store.set(storeKey, requestCount + 1, ttlMs);
      return true;
    }

    return false;
  }

  return { allowRequest };
}

export function createAtomicSharedLimiter(
  store: SharedStore,
  limit: number,
  windowMs: number,
) {
  async function allowRequest(key: string, now: number): Promise<boolean> {
    if (limit === 0) {
      return false;
    }

    const newWindow = Math.floor(now / windowMs);
    const storeKey = `${key}:${newWindow}`;
    const ttlMs = (newWindow + 1) * windowMs - now;

    // count if the current request is processed
    const newCount = await store.incr(storeKey, ttlMs);
    return newCount <= limit;
  }

  return { allowRequest };
}

// ---------------------------------------------------------------------------
// Step 10: when the store is DOWN.
//
// The store throws StoreUnavailableError (imported at the top of this file).
// The limiter can't count, so it has to pick a behavior:
//   - failMode "closed": reject every request. Safe, but your API is down
//     for everyone while the store is down.
//   - failMode "open": allow every request. Your API stays up, but nothing
//     is limited.
// Frontend analogy: your feature-flag service is down. Do you show the
// feature to everyone (open) or hide it from everyone (closed)?
//
// Middle ground, `localFallbackLimit`: with failMode "open", instead of
// allowing EVERYTHING, each server keeps its own in-memory fixed-window count
// per key and allows up to localFallbackLimit per window. Not exact (each
// server counts separately) but not blind either.
//
// Rules:
//   1. Store up: behave like createAtomicSharedLimiter. degraded: false.
//   2. Store throws StoreUnavailableError: use failMode / localFallbackLimit.
//      degraded: true.
//   3. Any OTHER error is a bug: let it throw out of check().
//   4. The store coming back up needs no special code: the next check just
//      works again.
// ---------------------------------------------------------------------------

export function createResilientLimiter(options: {
  store: SharedStore;
  limit: number;
  windowMs: number;
  failMode: "open" | "closed";
  localFallbackLimit?: number;
}) {
  async function check(
    key: string,
    now: number,
  ): Promise<{ allowed: boolean; degraded: boolean }> {
    // TODO
    void options;
    void key;
    void now;
    void StoreUnavailableError;
    throw new Error("not implemented");
  }

  return { check };
}

// ---------------------------------------------------------------------------
// Steps 11 + 12: MULTIPLE REGIONS.
//
// The API runs in several regions (us-east, eu-west, ...), each with its own
// store. To keep ONE count per key, every key has a HOME region
// (homeRegionOf(key)) and is always counted in that region's store, whichever
// server handled the request. Frontend analogy: one source of truth, not a
// copy per tab.
//
// Step 11: failover.
//   1. Count with incr() in the home region's store. Return
//      { allowed, servedBy: <that region>, degraded: false }.
//   2. Home store throws StoreUnavailableError: count in
//      failoverOf[homeRegion]'s store instead (its count starts from 0, which
//      is the price of failover). degraded: true, servedBy: the failover region.
//   3. Both unavailable: use failMode. servedBy: null, degraded: true.
//   4. Any other error: throw it.
//
// Step 12: circuit breaker (`probeAfterMs` option; when it's undefined there's
// no breaker, which is how Step 11's tests run).
//   Without it, every request while a region is down first waits for the dead
//   store to fail, then fails over: slow, and it hammers a store that's
//   trying to recover. Frontend analogy: don't retry a failing fetch in a
//   tight loop.
//   1. When a store throws StoreUnavailableError, mark that region OPEN
//      (= skip it) until now + probeAfterMs. While open, don't call it at all.
//   2. Once that time has passed, the next request tries it once
//      ("half-open"). Success: the region is healthy again. Failure: open for
//      another probeAfterMs.
//   3. The breaker applies to every region's store, failover ones included.
// ---------------------------------------------------------------------------

export function createMultiRegionLimiter(options: {
  stores: Record<string, SharedStore>;
  homeRegionOf: (key: string) => string;
  failoverOf: Record<string, string>;
  limit: number;
  windowMs: number;
  failMode: "open" | "closed";
  probeAfterMs?: number;
}) {
  async function check(
    key: string,
    now: number,
  ): Promise<{ allowed: boolean; servedBy: string | null; degraded: boolean }> {
    // TODO
    void options;
    void key;
    void now;
    throw new Error("not implemented");
  }

  return { check };
}
