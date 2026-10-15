import { test } from "node:test";
import assert from "node:assert/strict";
import { createVerificationLimits } from "./limiter.ts";

const TEN_MINUTES = 10 * 60 * 1000;
const limits = (capacity = 5) =>
  createVerificationLimits({
    customer: { capacity, refillPerSecond: 1 },
    document: { limit: 3, windowMs: TEN_MINUTES },
  });

test("allowed when both limits allow", () => {
  const { checkLimits } = limits();
  assert.deepEqual(checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 }), {
    allowed: true,
    rejectedBy: null,
    retryAfterSeconds: 0,
  });
});

test("the document limit applies across API keys", () => {
  const { checkLimits } = limits();
  checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 });
  checkLimits({ apiKey: "globex", documentNumber: "P1", now: 0 });
  checkLimits({ apiKey: "initech", documentNumber: "P1", now: 0 });
  assert.deepEqual(checkLimits({ apiKey: "umbrella", documentNumber: "P1", now: 1000 }), {
    allowed: false,
    rejectedBy: "document",
    retryAfterSeconds: 599,
  });
});

test("the customer limit rejects first, with its own retryAfter", () => {
  const { checkLimits } = limits(2);
  checkLimits({ apiKey: "acme", documentNumber: "A", now: 0 });
  checkLimits({ apiKey: "acme", documentNumber: "B", now: 0 });
  assert.deepEqual(checkLimits({ apiKey: "acme", documentNumber: "C", now: 0 }), {
    allowed: false,
    rejectedBy: "customer",
    retryAfterSeconds: 1,
  });
});

test("a request rejected by the customer limit does NOT use a document attempt", () => {
  const { checkLimits } = limits(1);
  // Uses acme's only token, and P1's 1st attempt.
  assert.equal(checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 }).allowed, true);
  // acme is out of tokens: these must not touch P1's count.
  for (let i = 0; i < 5; i++) {
    assert.equal(checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 }).rejectedBy, "customer");
  }
  // Other customers can still use P1's remaining 2 attempts.
  assert.equal(checkLimits({ apiKey: "globex", documentNumber: "P1", now: 0 }).allowed, true);
  assert.equal(checkLimits({ apiKey: "initech", documentNumber: "P1", now: 0 }).allowed, true);
  assert.equal(checkLimits({ apiKey: "umbrella", documentNumber: "P1", now: 0 }).rejectedBy, "document");
});

test("a request rejected by the document limit still spends the customer's token", () => {
  const { checkLimits } = limits(4);
  for (let i = 0; i < 3; i++) checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 });
  assert.equal(checkLimits({ apiKey: "acme", documentNumber: "P1", now: 0 }).rejectedBy, "document");
  // 4 tokens used (3 allowed + 1 rejected by the document limit): bucket empty.
  assert.equal(checkLimits({ apiKey: "acme", documentNumber: "P2", now: 0 }).rejectedBy, "customer");
});
