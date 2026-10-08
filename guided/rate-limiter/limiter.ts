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
    // no request is allowed if capacity is 0
    if (capacity === 0) return false;

    const currBucket = tokenBucket.get(key);
    console.log("currBucket", currBucket);

    // first request made for key
    if (!currBucket) {
      const newBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: capacity - 1,
      };
      tokenBucket.set(key, newBucket);
      return true;
    }

    const secondsPassed = (now - currBucket.updatedAt) / 1000;
    const tokensStored = currBucket.tokens;
    const refilledCount = secondsPassed * refillPerSecond;
    const currentTokenCount = Math.min(capacity, tokensStored + refilledCount);

    // only make request if there are still tokens available in the bucket
    if (currentTokenCount >= 1) {
      const updatedBucket: TokenBucketValue = {
        updatedAt: now,
        tokens: currentTokenCount - 1,
      };
      tokenBucket.set(key, updatedBucket);
      return true;
    }

    return false;
  }

  // -------------------------------------------------------------------------
  // Step 5: same decision as allowRequest, but also return the numbers the
  // HTTP layer needs for its headers:
  //   limit              -> X-RateLimit-Limit      (the bucket's capacity)
  //   remaining          -> X-RateLimit-Remaining  (whole tokens left AFTER
  //                                                 this request)
  //   retryAfterSeconds  -> Retry-After            (0 when allowed; when
  //                         rejected, whole seconds until 1 token is
  //                         available, rounded UP)
  // -------------------------------------------------------------------------
  function check(
    key: string,
    now: number,
  ): { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number } {
    // TODO
    void key;
    void now;
    throw new Error("not implemented");
  }

  return { allowRequest, check };
}
