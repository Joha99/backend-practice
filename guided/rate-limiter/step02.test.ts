import { test } from "node:test";
import assert from "node:assert/strict";
import { createFixedWindowLimiter } from "./limiter.ts";

// 3 requests per 1,000 ms window. Windows are 0–999, 1000–1999, 2000–2999, ...

test("allows `limit` requests in a window, then rejects", () => {
  const limiter = createFixedWindowLimiter(3, 1000);
  assert.equal(limiter.allowRequest("a", 0), true);
  assert.equal(limiter.allowRequest("a", 100), true);
  assert.equal(limiter.allowRequest("a", 200), true);
  assert.equal(limiter.allowRequest("a", 300), false);
});

test("a new window starts a fresh count", () => {
  const limiter = createFixedWindowLimiter(3, 1000);
  for (const t of [0, 1, 2]) limiter.allowRequest("a", t);
  assert.equal(limiter.allowRequest("a", 999), false, "999 is still in the first window");
  assert.equal(limiter.allowRequest("a", 1000), true, "1000 is the start of the next window");
});

test("windows are aligned to the clock, not to the first request", () => {
  const limiter = createFixedWindowLimiter(1, 1000);
  assert.equal(limiter.allowRequest("a", 900), true);
  assert.equal(limiter.allowRequest("a", 1000), true, "only 100ms later, but it's a new window");
});

test("each key has its own count", () => {
  const limiter = createFixedWindowLimiter(1, 1000);
  assert.equal(limiter.allowRequest("a", 0), true);
  assert.equal(limiter.allowRequest("a", 10), false);
  assert.equal(limiter.allowRequest("b", 10), true);
});

test("old windows don't pile up in memory", () => {
  const limiter = createFixedWindowLimiter(5, 1000);
  for (let t = 0; t < 100_000; t += 1000) {
    limiter.allowRequest("a", t); // one request per window, 100 windows
  }
  assert.ok(limiter.size() <= 1, `stored ${limiter.size()} counts for 1 key`);
});
