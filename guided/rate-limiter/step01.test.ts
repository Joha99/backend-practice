import { test } from "node:test";
import assert from "node:assert/strict";
import { createCounterLimiter } from "./limiter.ts";

test("allows the first `limit` requests, then rejects", () => {
  const limiter = createCounterLimiter(3);
  assert.equal(limiter.allowRequest("customer-a"), true);
  assert.equal(limiter.allowRequest("customer-a"), true);
  assert.equal(limiter.allowRequest("customer-a"), true);
  assert.equal(limiter.allowRequest("customer-a"), false);
  assert.equal(limiter.allowRequest("customer-a"), false);
});

test("each key has its own count", () => {
  const limiter = createCounterLimiter(1);
  assert.equal(limiter.allowRequest("customer-a"), true);
  assert.equal(limiter.allowRequest("customer-a"), false);
  assert.equal(limiter.allowRequest("customer-b"), true, "customer-b hasn't sent anything yet");
});

test("two limiters don't share counts", () => {
  const perCustomer = createCounterLimiter(1);
  const perDocument = createCounterLimiter(1);
  assert.equal(perCustomer.allowRequest("x"), true);
  assert.equal(perDocument.allowRequest("x"), true, "a separate limiter has its own counts");
});
