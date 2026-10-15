import { test } from "node:test";
import assert from "node:assert/strict";
import { createAtomicSharedLimiter, createNaiveSharedLimiter } from "./limiter.ts";
import { FakeSharedStore } from "./sharedStore.ts";

const MINUTE = 60_000;

const countAllowed = (results: boolean[]) => results.filter(Boolean).length;

test("naive: works when requests arrive one at a time", async () => {
  const store = new FakeSharedStore(() => 0);
  const limiter = createNaiveSharedLimiter(store, 3, MINUTE);
  const results = [];
  for (let i = 0; i < 5; i++) results.push(await limiter.allowRequest("acme", 0));
  assert.deepEqual(results, [true, true, true, false, false]);
});

test("naive: two servers at the same time let MORE than the limit through", async () => {
  // Two servers (two limiter objects) share one store, like two API servers
  // sharing one Redis. Six requests arrive at the same moment.
  const store = new FakeSharedStore(() => 0);
  const serverA = createNaiveSharedLimiter(store, 3, MINUTE);
  const serverB = createNaiveSharedLimiter(store, 3, MINUTE);
  const results = await Promise.all([
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
  ]);
  assert.ok(
    countAllowed(results) > 3,
    `expected the race to let more than 3 through, got ${countAllowed(results)}. ` +
      "Use get() then set() for the naive version.",
  );
});

test("atomic: the same race lets exactly 3 through", async () => {
  const store = new FakeSharedStore(() => 0);
  const serverA = createAtomicSharedLimiter(store, 3, MINUTE);
  const serverB = createAtomicSharedLimiter(store, 3, MINUTE);
  const results = await Promise.all([
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
    serverA.allowRequest("acme", 0),
    serverB.allowRequest("acme", 0),
  ]);
  assert.equal(countAllowed(results), 3);
});

test("atomic: one round trip per request", async () => {
  const store = new FakeSharedStore(() => 0);
  const limiter = createAtomicSharedLimiter(store, 3, MINUTE);
  await limiter.allowRequest("acme", 0);
  await limiter.allowRequest("acme", 0);
  assert.equal(store.calls, 2, "a get + set would be 2 calls per request");
});

test("atomic: a new window starts a new count, and keys are separate", async () => {
  let time = 0;
  const store = new FakeSharedStore(() => time);
  const limiter = createAtomicSharedLimiter(store, 1, MINUTE);
  assert.equal(await limiter.allowRequest("acme", time), true);
  assert.equal(await limiter.allowRequest("acme", time), false);
  assert.equal(await limiter.allowRequest("globex", time), true);
  time = MINUTE;
  assert.equal(await limiter.allowRequest("acme", time), true);
});

test("atomic: old windows expire from the store", async () => {
  let time = 0;
  const store = new FakeSharedStore(() => time);
  const limiter = createAtomicSharedLimiter(store, 3, MINUTE);
  for (let i = 0; i < 10; i++) {
    time = i * MINUTE;
    await limiter.allowRequest("acme", time);
  }
  assert.ok(store.size() <= 1, `kept ${store.size()} keys; old windows should expire (pass windowMs as the ttl)`);
});
