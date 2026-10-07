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
