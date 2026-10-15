import { test } from "node:test";
import assert from "node:assert/strict";
import { createMultiRegionLimiter } from "./limiter.ts";
import { FakeSharedStore, type SharedStore } from "./sharedStore.ts";

const MINUTE = 60_000;

const setup = (failMode: "open" | "closed" = "closed") => {
  const clock = () => 0;
  const stores = {
    "us-east": new FakeSharedStore(clock),
    "eu-west": new FakeSharedStore(clock),
    "ap-south": new FakeSharedStore(clock),
  };
  const limiter = createMultiRegionLimiter({
    stores,
    // Keys look like "eu:P123": the prefix decides the home region.
    homeRegionOf: (key) => ({ us: "us-east", eu: "eu-west", ap: "ap-south" })[key.split(":")[0]]!,
    failoverOf: { "us-east": "eu-west", "eu-west": "us-east", "ap-south": "us-east" },
    limit: 2,
    windowMs: MINUTE,
    failMode,
  });
  return { stores, limiter };
};

test("counts in the key's home region only", async () => {
  const { stores, limiter } = setup();
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: true, servedBy: "eu-west", degraded: false });
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: true, servedBy: "eu-west", degraded: false });
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: false, servedBy: "eu-west", degraded: false });
  assert.equal(stores["eu-west"].calls, 3);
  assert.equal(stores["us-east"].calls, 0);
  assert.equal(stores["ap-south"].calls, 0);
});

test("home store down: fail over, and the count starts fresh there", async () => {
  const { stores, limiter } = setup();
  await limiter.check("eu:P1", 0);
  await limiter.check("eu:P1", 0); // eu-west count is now 2 (at the limit)
  stores["eu-west"].down = true;
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: true, servedBy: "us-east", degraded: true });
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: true, servedBy: "us-east", degraded: true });
  assert.deepEqual(await limiter.check("eu:P1", 0), { allowed: false, servedBy: "us-east", degraded: true });
});

test("home and failover both down: fail closed", async () => {
  const { stores, limiter } = setup("closed");
  stores["ap-south"].down = true;
  stores["us-east"].down = true;
  assert.deepEqual(await limiter.check("ap:P1", 0), { allowed: false, servedBy: null, degraded: true });
});

test("home and failover both down: fail open", async () => {
  const { stores, limiter } = setup("open");
  stores["us-east"].down = true;
  stores["eu-west"].down = true;
  assert.deepEqual(await limiter.check("us:P1", 0), { allowed: true, servedBy: null, degraded: true });
});

test("when the home store recovers, counting goes back home", async () => {
  const { stores, limiter } = setup();
  stores["us-east"].down = true;
  assert.equal((await limiter.check("us:P1", 0)).servedBy, "eu-west");
  stores["us-east"].down = false;
  assert.deepEqual(await limiter.check("us:P1", 0), { allowed: true, servedBy: "us-east", degraded: false });
});

test("other errors are thrown, not failed over", async () => {
  const buggy: SharedStore = {
    get: async () => null,
    set: async () => {},
    incr: async () => {
      throw new RangeError("bug");
    },
  };
  const limiter = createMultiRegionLimiter({
    stores: { a: buggy, b: new FakeSharedStore(() => 0) },
    homeRegionOf: () => "a",
    failoverOf: { a: "b", b: "a" },
    limit: 2,
    windowMs: MINUTE,
    failMode: "open",
  });
  await assert.rejects(limiter.check("k", 0), RangeError);
});
