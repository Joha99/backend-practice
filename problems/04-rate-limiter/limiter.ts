/**
 * Rate Limiter, Part A: two algorithms
 *
 * Implement two classic rate limiting algorithms as plain classes (no
 * framework). Part A continues in app.ts (put them in front of an API) and
 * Part B is multiRegion.ts (survive a region outage).
 *
 * Time is injected: every class takes `now: () => number` (ms). Never call
 * Date.now() directly, so tests can control time.
 *
 * Every check returns a Decision:
 *   { allowed: boolean, remaining: number, retryAfterMs: number }
 *   - remaining: how many more requests would be allowed right now
 *     (after this one, if it was allowed). Never negative.
 *   - retryAfterMs: 0 when allowed; otherwise how long until the next
 *     request for this key would be allowed.
 *
 * Requirements:
 * 1. SlidingWindowLimiter({ limit, windowMs, now }) — sliding window LOG.
 *    check(key) allows the request if fewer than `limit` requests for that
 *    key were ALLOWED in the window (now - windowMs, now]. A request exactly
 *    windowMs old has left the window.
 *    - Rejected requests are not recorded (they don't extend the block).
 *    - retryAfterMs when rejected: time until the oldest request in the
 *      window falls out of it.
 *    - Keys are independent.
 *    - Don't keep timestamps that have left the window.
 * 2. TokenBucketLimiter({ capacity, refillPerSecond, now }).
 *    take(key, cost = 1): each key starts with a FULL bucket. Tokens refill
 *    continuously (fractional tokens are fine) up to `capacity`. Allowed if
 *    the bucket has at least `cost` tokens, which are then removed.
 *    - remaining = whole tokens left, rounded down.
 *    - retryAfterMs when rejected: time until `cost` tokens are available,
 *      rounded UP to a whole millisecond.
 *    - cost > capacity can never succeed: throw a RangeError.
 *
 * Questions to answer in a comment once you're done:
 * - Memory: what does each algorithm store per key? What happens with
 *   10 million keys? How would you clean up keys nobody uses any more?
 * - Fixed window counter (count per minute bucket) is cheaper than a log.
 *   What burst does it allow at a window boundary?
 * - Which algorithm suits "allow short bursts, but limit the average rate"?
 *
 * Run tests: node --test problems/04-rate-limiter/limiter.test.ts
 * Time target: 40 minutes.
 */

export type Clock = () => number;

export type Decision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export class SlidingWindowLimiter {
  readonly limit: number;
  readonly windowMs: number;
  readonly now: Clock;

  constructor(opts: { limit: number; windowMs: number; now?: Clock }) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.now = opts.now ?? Date.now;
  }

  check(key: string): Decision {
    // TODO: implement
    void key;
    throw new Error("not implemented");
  }
}

export class TokenBucketLimiter {
  readonly capacity: number;
  readonly refillPerSecond: number;
  readonly now: Clock;

  constructor(opts: { capacity: number; refillPerSecond: number; now?: Clock }) {
    this.capacity = opts.capacity;
    this.refillPerSecond = opts.refillPerSecond;
    this.now = opts.now ?? Date.now;
  }

  take(key: string, cost = 1): Decision {
    // TODO: implement
    void key;
    void cost;
    throw new Error("not implemented");
  }
}
