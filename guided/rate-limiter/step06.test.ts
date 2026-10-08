import { test } from "node:test";
import assert from "node:assert/strict";
import { createSlidingWindowLogLimiter } from "./limiter.ts";

const TEN_MINUTES = 10 * 60 * 1000;
const fraudLimit = () => createSlidingWindowLogLimiter(3, TEN_MINUTES);

test("allows 3 attempts, rejects the 4th", () => {
  const limiter = fraudLimit();
  assert.deepEqual(limiter.check("doc-1", 0), { allowed: true, limit: 3, remaining: 2, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.check("doc-1", 1000), { allowed: true, limit: 3, remaining: 1, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.check("doc-1", 2000), { allowed: true, limit: 3, remaining: 0, retryAfterSeconds: 0 });
  // the oldest attempt (at 0) leaves the window at 600,000; now is 3,000
  assert.deepEqual(limiter.check("doc-1", 3000), { allowed: false, limit: 3, remaining: 0, retryAfterSeconds: 597 });
});

test("the window slides: attempts drop out one at a time", () => {
  const limiter = fraudLimit();
  limiter.check("doc-1", 0);
  limiter.check("doc-1", 60_000);
  limiter.check("doc-1", 120_000);
  assert.equal(limiter.check("doc-1", TEN_MINUTES - 1).allowed, false, "all 3 still inside");
  assert.equal(limiter.check("doc-1", TEN_MINUTES).allowed, true, "the attempt at 0 just left");
  assert.equal(limiter.check("doc-1", TEN_MINUTES + 1).allowed, false, "60,000 and 120,000 are still inside");
});

test("no boundary burst: the Step 3 trick doesn't work", () => {
  const limiter = fraudLimit();
  let allowed = 0;
  for (let i = 0; i < 5; i++) if (limiter.check("doc-1", TEN_MINUTES - 1).allowed) allowed++;
  for (let i = 0; i < 5; i++) if (limiter.check("doc-1", TEN_MINUTES).allowed) allowed++;
  assert.equal(allowed, 3, "exactly 3 in any 10 minutes, wherever the clock is");
});

test("rejected attempts are not recorded (retrying while blocked doesn't extend the block)", () => {
  const limiter = fraudLimit();
  for (const t of [0, 1, 2]) limiter.check("doc-1", t);
  for (let t = 1000; t < TEN_MINUTES; t += 60_000) limiter.check("doc-1", t); // all rejected
  assert.equal(limiter.check("doc-1", TEN_MINUTES + 2).allowed, true);
});

test("retryAfterSeconds rounds up and is never 0 when rejected", () => {
  const limiter = fraudLimit();
  for (const t of [0, 1, 2]) limiter.check("doc-1", t);
  const r = limiter.check("doc-1", TEN_MINUTES - 1); // 1ms until the attempt at 0 leaves
  assert.equal(r.allowed, false);
  assert.equal(r.retryAfterSeconds, 1);
});

test("each key is separate", () => {
  const limiter = fraudLimit();
  for (const t of [0, 1, 2]) limiter.check("doc-1", t);
  assert.equal(limiter.check("doc-2", 3).allowed, true);
});

test("old timestamps are thrown away", () => {
  const limiter = fraudLimit();
  // one attempt every 5 minutes for 10 hours -> 120 allowed attempts
  for (let t = 0; t < 10 * 60 * 60 * 1000; t += 5 * 60 * 1000) limiter.check("doc-1", t);
  assert.ok(limiter.size() <= 3, `kept ${limiter.size()} timestamps; only ones inside the window matter`);
});
