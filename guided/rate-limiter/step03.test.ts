import { test } from "node:test";
import assert from "node:assert/strict";
import { createFixedWindowLimiter } from "./limiter.ts";

// Step 3: YOU write this test. It should PASS against your fixed window
// limiter, and in doing so prove the fixed window's weak spot.
//
// Setup: a limit of 5 requests per 1,000 ms window.
// Goal: show that one customer can get MORE than 5 requests allowed within a
// span of time much shorter than 1,000 ms.
//
// When you're done, `allowedInBurst` should be the number of requests that
// were allowed during your short burst.

test("a fixed window allows a burst of up to 2x the limit at a boundary", () => {
  const limiter = createFixedWindowLimiter(5, 1000);
  let allowedInBurst = 0;

  // TODO: send requests at carefully chosen times, counting how many are
  // allowed in `allowedInBurst`. Keep all of them within 10 ms of each other.

  const startTime = 950;
  const smallWindowMs = 100;

  for (let i = startTime; i < startTime + smallWindowMs; i += 10) {
    assert.equal(limiter.allowRequest("a", i), true);
    allowedInBurst++;
  }

  assert.equal(
    allowedInBurst,
    10,
    "5 per second, yet 10 got through in a few ms",
  );
});
