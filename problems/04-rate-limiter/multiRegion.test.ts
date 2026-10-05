import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MultiRegionLimiter } from "./multiRegion.ts";
import { RegionStore } from "./regionStore.ts";

const setup = (overrides: { failMode?: "open" | "closed"; limit?: number } = {}) => {
  let t = 0;
  const us = new RegionStore("us-east");
  const eu = new RegionStore("eu-west");
  const ap = new RegionStore("ap-south");
  const limiter = new MultiRegionLimiter({
    stores: [us, eu, ap],
    // keys starting with "eu:" live in eu-west, everything else in us-east
    homeRegionOf: (key) => (key.startsWith("eu:") ? "eu-west" : "us-east"),
    failoverOf: { "us-east": "eu-west", "eu-west": "ap-south", "ap-south": "us-east" },
    limit: overrides.limit ?? 5,
    windowMs: 60_000,
    failMode: overrides.failMode ?? "closed",
    probeAfterMs: 10_000,
    now: () => t,
  });
  return { limiter, us, eu, ap, advance: (ms: number) => (t += ms), set: (ms: number) => (t = ms) };
};

describe("normal operation", () => {
  test("counts in the home store and enforces the limit", () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(limiter.check("user-1"), { allowed: true, servedBy: "us-east", degraded: false });
    }
    assert.deepEqual(limiter.check("user-1"), { allowed: false, servedBy: "us-east", degraded: false });
  });

  test("keys use their own home region", () => {
    const { limiter, us, eu } = setup();
    assert.equal(limiter.check("eu:user-2").servedBy, "eu-west");
    assert.equal(eu.calls, 1);
    assert.equal(us.calls, 0);
  });

  test("a new fixed window resets the count", () => {
    const { limiter, set } = setup();
    for (let i = 0; i < 6; i++) limiter.check("user-1");
    set(60_000);
    assert.equal(limiter.check("user-1").allowed, true);
  });
});

describe("failover", () => {
  test("home down -> failover region decides, degraded", () => {
    const { limiter, us } = setup();
    us.setDown(true);
    assert.deepEqual(limiter.check("user-1"), { allowed: true, servedBy: "eu-west", degraded: true });
  });

  test("counting restarts in the failover region (up to 2x limit per window)", () => {
    const { limiter, us } = setup();
    for (let i = 0; i < 5; i++) limiter.check("user-1");
    assert.equal(limiter.check("user-1").allowed, false);
    us.setDown(true);
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.check("user-1").allowed, true, `failover request ${i + 1}`);
    }
    assert.equal(limiter.check("user-1").allowed, false);
  });

  test("failover follows each region's configured backup", () => {
    const { limiter, eu } = setup();
    eu.setDown(true);
    assert.equal(limiter.check("eu:user-2").servedBy, "ap-south");
  });
});

describe("circuit breaker", () => {
  test("a down store is not called again until probeAfterMs passes", () => {
    const { limiter, us, advance } = setup({ limit: 100 });
    us.setDown(true);
    limiter.check("user-1");
    assert.equal(us.calls, 1);
    for (let i = 0; i < 20; i++) {
      advance(400); // 8s total, still inside the 10s window
      limiter.check("user-1");
    }
    assert.equal(us.calls, 1, "should not hammer a store that is down");
  });

  test("half-open: after probeAfterMs, one probe; recovery puts home back in use", () => {
    const { limiter, us, advance } = setup({ limit: 100 });
    us.setDown(true);
    limiter.check("user-1");
    us.setDown(false);
    advance(5_000);
    assert.equal(limiter.check("user-1").servedBy, "eu-west", "still within probeAfterMs");
    advance(5_000);
    assert.deepEqual(limiter.check("user-1"), { allowed: true, servedBy: "us-east", degraded: false });
    assert.equal(us.calls, 2);
  });

  test("a failed probe marks the store down for another probeAfterMs", () => {
    const { limiter, us, advance } = setup({ limit: 100 });
    us.setDown(true);
    limiter.check("user-1"); // fails, down until 10s
    advance(10_000);
    limiter.check("user-1"); // probe fails, down until 20s
    assert.equal(us.calls, 2);
    advance(9_000);
    limiter.check("user-1");
    assert.equal(us.calls, 2);
    advance(1_000);
    limiter.check("user-1");
    assert.equal(us.calls, 3);
  });

  test("the breaker also protects failover stores", () => {
    const { limiter, us, eu, advance } = setup();
    us.setDown(true);
    eu.setDown(true);
    limiter.check("user-1");
    for (let i = 0; i < 10; i++) {
      advance(500);
      limiter.check("user-1");
    }
    assert.equal(us.calls, 1);
    assert.equal(eu.calls, 1);
  });
});

describe("both stores unavailable", () => {
  test("fail closed", () => {
    const { limiter, us, eu } = setup({ failMode: "closed" });
    us.setDown(true);
    eu.setDown(true);
    assert.deepEqual(limiter.check("user-1"), { allowed: false, servedBy: null, degraded: true });
  });

  test("fail open", () => {
    const { limiter, us, eu } = setup({ failMode: "open" });
    us.setDown(true);
    eu.setDown(true);
    assert.deepEqual(limiter.check("user-1"), { allowed: true, servedBy: null, degraded: true });
  });
});

test("non-outage errors are not swallowed", () => {
  const { limiter, us } = setup();
  us.incr = () => {
    throw new TypeError("bug in the store client");
  };
  assert.throws(() => limiter.check("user-1"), TypeError);
});
