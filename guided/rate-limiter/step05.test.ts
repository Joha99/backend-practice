import { test } from "node:test";
import assert from "node:assert/strict";
import { createTokenBucketLimiter } from "./limiter.ts";

test("allowed: limit, remaining after this request, retryAfter 0", () => {
  const limiter = createTokenBucketLimiter(5, 1);
  assert.deepEqual(limiter.check("a", 0), { allowed: true, limit: 5, remaining: 4, retryAfterSeconds: 0 });
  assert.deepEqual(limiter.check("a", 0), { allowed: true, limit: 5, remaining: 3, retryAfterSeconds: 0 });
});

test("rejected: remaining 0 and how long to wait", () => {
  const limiter = createTokenBucketLimiter(5, 1);
  for (let i = 0; i < 5; i++) limiter.check("a", 0);
  assert.deepEqual(limiter.check("a", 0), { allowed: false, limit: 5, remaining: 0, retryAfterSeconds: 1 });
});

test("retryAfterSeconds rounds UP to whole seconds", () => {
  // 1 token every 2 seconds
  const limiter = createTokenBucketLimiter(1, 0.5);
  limiter.check("a", 0); // bucket empty
  assert.equal(limiter.check("a", 0).retryAfterSeconds, 2, "needs 1 full token: 2s");
  assert.equal(limiter.check("a", 500).retryAfterSeconds, 2, "0.25 tokens, needs 0.75 more: 1.5s -> 2");
  assert.equal(limiter.check("a", 1500).retryAfterSeconds, 1, "0.75 tokens, needs 0.25 more: 0.5s -> 1");
});

test("remaining counts whole tokens only", () => {
  const limiter = createTokenBucketLimiter(5, 1);
  for (let i = 0; i < 5; i++) limiter.check("a", 0); // empty
  // at 2.5s there are 2.5 tokens; this request uses 1, leaving 1.5 -> 1 whole
  assert.deepEqual(limiter.check("a", 2500), { allowed: true, limit: 5, remaining: 1, retryAfterSeconds: 0 });
});

test("check and allowRequest agree (they share one bucket)", () => {
  const limiter = createTokenBucketLimiter(2, 1);
  assert.equal(limiter.allowRequest("a", 0), true);
  assert.equal(limiter.check("a", 0).allowed, true);
  assert.equal(limiter.allowRequest("a", 0), false, "2 tokens were used between the two methods");
});
