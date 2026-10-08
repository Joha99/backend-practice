import { test } from "node:test";
import assert from "node:assert/strict";
import { createTokenBucketLimiter } from "./limiter.ts";

// Our Free plan: 1 request per second on average, bursts of up to 5.
const freePlan = () => createTokenBucketLimiter(5, 1);

test("starts full: a burst of 5 is allowed, the 6th is rejected", () => {
  const limiter = freePlan();
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.allowRequest("a", 0), true, `request ${i + 1}`);
  }
  assert.equal(limiter.allowRequest("a", 0), false);
});

test("one token comes back each second", () => {
  const limiter = freePlan();
  for (let i = 0; i < 5; i++) limiter.allowRequest("a", 0);
  assert.equal(limiter.allowRequest("a", 999), false, "not quite 1 token yet");
  assert.equal(limiter.allowRequest("a", 1000), true, "1 token after 1s");
  assert.equal(limiter.allowRequest("a", 1000), false, "and only 1");
});

test("partial tokens add up", () => {
  const limiter = freePlan();
  for (let i = 0; i < 5; i++) limiter.allowRequest("a", 0);
  assert.equal(limiter.allowRequest("a", 500), false, "0.5 tokens is not enough");
  assert.equal(limiter.allowRequest("a", 1000), true, "0.5 + 0.5 = 1 token");
});

test("fractions aren't thrown away when a request is allowed", () => {
  const limiter = freePlan();
  for (let i = 0; i < 5; i++) limiter.allowRequest("a", 0); // empty at 0
  assert.equal(limiter.allowRequest("a", 1500), true, "1.5 tokens -> allowed, 0.5 left over");
  assert.equal(limiter.allowRequest("a", 2000), true, "0.5 left over + 0.5 refilled = 1 token");
});

test("over a long stretch, the average is refillPerSecond", () => {
  const limiter = freePlan();
  let allowed = 0;
  // someone hammering every 300ms for 60 seconds
  for (let t = 0; t <= 60_000; t += 300) if (limiter.allowRequest("a", t)) allowed++;
  // 5 (starting burst) + 60 (one per second) = 65
  assert.ok(allowed >= 64 && allowed <= 65, `allowed ${allowed}, expected about 65`);
});

test("the bucket never holds more than capacity", () => {
  const limiter = freePlan();
  limiter.allowRequest("a", 0); // 4 left
  // idle for an hour: would be 3,600+ tokens without a cap
  const later = 60 * 60 * 1000;
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.allowRequest("a", later), true, `request ${i + 1}`);
  }
  assert.equal(limiter.allowRequest("a", later), false, "capped at 5, not 3,600");
});

test("no boundary burst: the Step 3 trick doesn't work", () => {
  const limiter = freePlan();
  let allowed = 0;
  for (let i = 0; i < 10; i++) if (limiter.allowRequest("a", 999)) allowed++;
  for (let i = 0; i < 10; i++) if (limiter.allowRequest("a", 1000)) allowed++;
  assert.equal(allowed, 5, "only the 5 tokens in the bucket, wherever the clock is");
});

test("each key has its own bucket", () => {
  const limiter = createTokenBucketLimiter(1, 1);
  assert.equal(limiter.allowRequest("a", 0), true);
  assert.equal(limiter.allowRequest("a", 0), false);
  assert.equal(limiter.allowRequest("b", 0), true);
});
