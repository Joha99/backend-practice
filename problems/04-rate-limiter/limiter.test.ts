import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SlidingWindowLimiter, TokenBucketLimiter } from "./limiter.ts";

const clock = () => {
  let t = 0;
  return { now: () => t, set: (ms: number) => (t = ms), advance: (ms: number) => (t += ms) };
};

describe("SlidingWindowLimiter", () => {
  test("allows up to limit, then rejects with retryAfterMs", () => {
    const c = clock();
    const l = new SlidingWindowLimiter({ limit: 3, windowMs: 1000, now: c.now });

    c.set(0);
    assert.deepEqual(l.check("a"), { allowed: true, remaining: 2, retryAfterMs: 0 });
    c.set(1);
    assert.deepEqual(l.check("a"), { allowed: true, remaining: 1, retryAfterMs: 0 });
    c.set(2);
    assert.deepEqual(l.check("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    c.set(3);
    assert.deepEqual(l.check("a"), { allowed: false, remaining: 0, retryAfterMs: 997 });
  });

  test("a request exactly windowMs old has left the window", () => {
    const c = clock();
    const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000, now: c.now });
    c.set(0);
    assert.equal(l.check("a").allowed, true);
    c.set(999);
    assert.equal(l.check("a").allowed, false);
    c.set(1000);
    assert.equal(l.check("a").allowed, true);
  });

  test("the window slides: old requests drop out one at a time", () => {
    const c = clock();
    const l = new SlidingWindowLimiter({ limit: 2, windowMs: 1000, now: c.now });
    c.set(0);
    l.check("a");
    c.set(500);
    l.check("a");
    c.set(900);
    assert.deepEqual(l.check("a"), { allowed: false, remaining: 0, retryAfterMs: 100 });
    c.set(1000);
    assert.deepEqual(l.check("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    c.set(1400);
    assert.deepEqual(l.check("a"), { allowed: false, remaining: 0, retryAfterMs: 100 });
  });

  test("rejected requests are not recorded", () => {
    const c = clock();
    const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000, now: c.now });
    c.set(0);
    l.check("a");
    for (let t = 1; t < 1000; t += 50) {
      c.set(t);
      assert.equal(l.check("a").allowed, false);
    }
    c.set(1000);
    assert.equal(l.check("a").allowed, true, "hammering while blocked must not extend the block");
  });

  test("keys are independent", () => {
    const c = clock();
    const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000, now: c.now });
    assert.equal(l.check("a").allowed, true);
    assert.equal(l.check("a").allowed, false);
    assert.equal(l.check("b").allowed, true);
  });
});

describe("TokenBucketLimiter", () => {
  test("starts full and drains", () => {
    const c = clock();
    const b = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: c.now });
    assert.deepEqual(b.take("a"), { allowed: true, remaining: 2, retryAfterMs: 0 });
    assert.deepEqual(b.take("a"), { allowed: true, remaining: 1, retryAfterMs: 0 });
    assert.deepEqual(b.take("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    assert.deepEqual(b.take("a"), { allowed: false, remaining: 0, retryAfterMs: 1000 });
  });

  test("refills continuously, including fractions", () => {
    const c = clock();
    const b = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 2, now: c.now });
    b.take("a", 3);
    c.advance(250); // 0.5 tokens
    assert.deepEqual(b.take("a"), { allowed: false, remaining: 0, retryAfterMs: 250 });
    c.advance(250); // 1 token
    assert.deepEqual(b.take("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    c.advance(1300); // 2.6 tokens
    assert.deepEqual(b.take("a"), { allowed: true, remaining: 1, retryAfterMs: 0 });
  });

  test("never refills above capacity", () => {
    const c = clock();
    const b = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 10, now: c.now });
    c.advance(60_000);
    assert.equal(b.take("a").allowed, true);
    assert.equal(b.take("a").allowed, true);
    assert.equal(b.take("a").allowed, false);
  });

  test("cost > 1 and retryAfterMs rounds up", () => {
    const c = clock();
    const b = new TokenBucketLimiter({ capacity: 5, refillPerSecond: 3, now: c.now });
    assert.deepEqual(b.take("a", 4), { allowed: true, remaining: 1, retryAfterMs: 0 });
    // has 1 token, needs 3 -> 2 tokens at 3/s = 666.67ms -> 667
    assert.deepEqual(b.take("a", 3), { allowed: false, remaining: 1, retryAfterMs: 667 });
  });

  test("a rejected take removes no tokens", () => {
    const c = clock();
    const b = new TokenBucketLimiter({ capacity: 5, refillPerSecond: 1, now: c.now });
    b.take("a", 4);
    assert.equal(b.take("a", 2).allowed, false);
    assert.deepEqual(b.take("a", 1), { allowed: true, remaining: 0, retryAfterMs: 0 });
  });

  test("cost > capacity throws RangeError", () => {
    const b = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 1, now: () => 0 });
    assert.throws(() => b.take("a", 3), RangeError);
  });

  test("keys are independent", () => {
    const b = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1, now: () => 0 });
    assert.equal(b.take("a").allowed, true);
    assert.equal(b.take("a").allowed, false);
    assert.equal(b.take("b").allowed, true);
  });
});
