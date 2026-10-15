import { test } from "node:test";
import assert from "node:assert/strict";
import { createResilientLimiter } from "./limiter.ts";
import { FakeSharedStore, type SharedStore } from "./sharedStore.ts";

const MINUTE = 60_000;

test("store up: counts in the store, not degraded", async () => {
  const store = new FakeSharedStore(() => 0);
  const limiter = createResilientLimiter({ store, limit: 2, windowMs: MINUTE, failMode: "closed" });
  assert.deepEqual(await limiter.check("acme", 0), { allowed: true, degraded: false });
  assert.deepEqual(await limiter.check("acme", 0), { allowed: true, degraded: false });
  assert.deepEqual(await limiter.check("acme", 0), { allowed: false, degraded: false });
  assert.equal(store.calls, 3);
});

test("store down + fail closed: reject everything", async () => {
  const store = new FakeSharedStore(() => 0);
  store.down = true;
  const limiter = createResilientLimiter({ store, limit: 100, windowMs: MINUTE, failMode: "closed" });
  assert.deepEqual(await limiter.check("acme", 0), { allowed: false, degraded: true });
});

test("store down + fail open: allow everything", async () => {
  const store = new FakeSharedStore(() => 0);
  store.down = true;
  const limiter = createResilientLimiter({ store, limit: 1, windowMs: MINUTE, failMode: "open" });
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(await limiter.check("acme", 0), { allowed: true, degraded: true });
  }
});

test("store down + fail open with a local fallback limit", async () => {
  let time = 0;
  const store = new FakeSharedStore(() => time);
  store.down = true;
  const limiter = createResilientLimiter({
    store,
    limit: 100,
    windowMs: MINUTE,
    failMode: "open",
    localFallbackLimit: 2,
  });
  const results = [];
  for (let i = 0; i < 3; i++) results.push((await limiter.check("acme", time)).allowed);
  assert.deepEqual(results, [true, true, false]);
  assert.equal((await limiter.check("globex", time)).allowed, true, "keys are separate");
  time = MINUTE;
  assert.equal((await limiter.check("acme", time)).allowed, true, "a new window resets the local count");
});

test("the store coming back up just works", async () => {
  const store = new FakeSharedStore(() => 0);
  const limiter = createResilientLimiter({ store, limit: 5, windowMs: MINUTE, failMode: "closed" });
  store.down = true;
  assert.deepEqual(await limiter.check("acme", 0), { allowed: false, degraded: true });
  store.down = false;
  assert.deepEqual(await limiter.check("acme", 0), { allowed: true, degraded: false });
});

test("other errors are bugs: they are thrown, not hidden by the fail mode", async () => {
  const brokenStore: SharedStore = {
    get: async () => null,
    set: async () => {},
    incr: async () => {
      throw new TypeError("bug in our code");
    },
  };
  const limiter = createResilientLimiter({ store: brokenStore, limit: 5, windowMs: MINUTE, failMode: "open" });
  await assert.rejects(limiter.check("acme", 0), TypeError);
});
