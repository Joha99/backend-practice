// Guided rate limiter. You grow this file one step at a time.
// See README.md in this folder for the step list.

// ---------------------------------------------------------------------------
// Step 1: allow the first `limit` requests for each key, reject the rest.
// ---------------------------------------------------------------------------

export function createCounterLimiter(limit: number) {
  // Keeps a map tracking the count of requests associated with a unique identifier
  const counts = new Map<string, number>();

  // Checks to map to decide if a request has been made for a given identifier more times than the limit
  function allowRequest(key: string): boolean {
    let newCount = 0;

    const keyCount = counts.get(key);
    if (!keyCount) {
      newCount = 1;
    } else {
      newCount = keyCount + 1;
    }

    if (newCount <= limit) {
      counts.set(key, newCount);
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
  let counts = new Map<string, number>();
  let currentWindow = 0;

  function allowRequest(key: string, now: number): boolean {
    if (limit === 0) return false;

    const newWindow = Math.floor(now / windowMs);

    // Disgard the old window counts if we enter a new window
    if (newWindow > currentWindow) {
      counts = new Map<string, number>();
      currentWindow = newWindow;
    }

    const previousCount = counts?.get(key) ?? 0;

    if (previousCount < limit) {
      counts.set(key, previousCount + 1);
      return true;
    }
    return false;
  }

  // How many counts are stored right now (used by a test to check that old
  // windows don't pile up forever).
  function size(): number {
    return counts.size;
  }

  return { allowRequest, size };
}

// ---------------------------------------------------------------------------
// Step 4: token bucket. Each key has a bucket holding up to `capacity`
// tokens. A request takes 1 token; with no token it's rejected. Tokens come
// back at `refillPerSecond` (fractions are fine, e.g. 0.5 tokens).
// A key that has never been seen starts with a FULL bucket.
// ---------------------------------------------------------------------------

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

export function createTokenBucketLimiter(
  capacity: number,
  refillPerSecond: number,
) {
  // maps key to # of tokens in bucket
  const tokenBucket = new Map<string, TokenBucketValue>();

  // request for key is only valid if the tokens associated with the key has more than 0 tokens
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
    // no request is allowed if capacity is 0
    if (capacity === 0) {
      return {
        allowed: false,
        limit: capacity,
        remaining: 0,
        retryAfterSeconds: 0,
      };
    }

    const currBucket = tokenBucket.get(key);

    // first request made for key, we are at full capacity
    if (!currBucket) {
      const newBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: capacity - 1,
      };
      tokenBucket.set(key, newBucket);

      return {
        allowed: true,
        limit: capacity,
        remaining: capacity - 1,
        retryAfterSeconds: 0, // this request succeeded so we don't need to retry again
      };
    }

    // this is not the first request made for key
    const secondsPassedSinceLastUpdate = (now - currBucket.updatedAt) / 1000;
    const tokensStoredAfterLastUpdate = currBucket.tokens;
    const refilledSinceLastUpdate =
      secondsPassedSinceLastUpdate * refillPerSecond;
    const currentTokenCount = Math.min(
      capacity,
      tokensStoredAfterLastUpdate + refilledSinceLastUpdate,
    );

    // only make request if there is at least one full token available
    if (currentTokenCount >= 1) {
      const updatedBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: currentTokenCount - 1,
      };
      tokenBucket.set(key, updatedBucket);

      return {
        allowed: true,
        limit: capacity,
        remaining: Math.floor(currentTokenCount - 1),
        retryAfterSeconds: 0, // this request succeeded so we don't need to retry again
      };
    }

    // there are no complete tokens available
    const retryAfterSeconds = (1 - currentTokenCount) / refillPerSecond;

    return {
      allowed: false,
      limit: capacity,
      remaining: Math.floor(currentTokenCount),
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
  // TODO: what do you need to remember per key?

  function check(
    key: string,
    now: number,
  ): {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfterSeconds: number;
  } {
    // TODO
    void key;
    void now;
    void limit;
    void windowMs;
    throw new Error("not implemented");
  }

  // Total number of timestamps stored across all keys (used by a test to
  // check that old ones are thrown away).
  function size(): number {
    // TODO
    throw new Error("not implemented");
  }

  return { check, size };
}
