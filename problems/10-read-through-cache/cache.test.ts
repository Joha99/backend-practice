import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ReadThroughCache } from "./cache.ts";

type Profile = { id: string; name: string };

/** Let pending promise callbacks run (so the loader has been called). */
const tick = () => new Promise((r) => setImmediate(r));

/** A fake origin whose loads you resolve or reject by hand. */
const origin = () => {
  const db = new Map<string, Profile>([
    ["u1", { id: "u1", name: "Ada" }],
    ["u2", { id: "u2", name: "Grace" }],
    ["u3", { id: "u3", name: "Linus" }],
  ]);
  const calls: string[] = [];
  const pending: { key: string; resolve: () => void; reject: (e: Error) => void }[] = [];
  let manual = false;

  const loader = (key: string): Promise<Profile | null> => {
    calls.push(key);
    const read = () => (db.has(key) ? { ...db.get(key)! } : null);
    if (!manual) return Promise.resolve(read());
    return new Promise((resolve, reject) => {
      pending.push({ key, resolve: () => resolve(read()), reject });
    });
  };

  return {
    db,
    calls,
    loader,
    manual: () => (manual = true),
    resolveAll: () => pending.splice(0).forEach((p) => p.resolve()),
    rejectAll: (e: Error) => pending.splice(0).forEach((p) => p.reject(e)),
  };
};

const setup = (maxEntries = 100) => {
  let t = 0;
  const o = origin();
  const cache = new ReadThroughCache<Profile>({
    loader: o.loader,
    ttlMs: 60_000,
    negativeTtlMs: 5_000,
    maxEntries,
    now: () => t,
  });
  return { cache, o, advance: (ms: number) => (t += ms) };
};

describe("read-through and TTL", () => {
  test("miss loads, hit doesn't", async () => {
    const { cache, o } = setup();
    assert.deepEqual(await cache.get("u1"), { id: "u1", name: "Ada" });
    assert.deepEqual(await cache.get("u1"), { id: "u1", name: "Ada" });
    assert.deepEqual(o.calls, ["u1"]);
    assert.equal(cache.size(), 1);
  });

  test("expired values reload", async () => {
    const { cache, o, advance } = setup();
    await cache.get("u1");
    advance(59_999);
    await cache.get("u1");
    assert.equal(o.calls.length, 1);
    advance(1);
    o.db.set("u1", { id: "u1", name: "Ada L." });
    assert.equal((await cache.get("u1"))?.name, "Ada L.");
    assert.equal(o.calls.length, 2);
  });

  test("not-found results are cached for negativeTtlMs", async () => {
    const { cache, o, advance } = setup();
    assert.equal(await cache.get("ghost"), null);
    assert.equal(await cache.get("ghost"), null);
    assert.equal(o.calls.length, 1);
    advance(5_000);
    o.db.set("ghost", { id: "ghost", name: "Now exists" });
    assert.equal((await cache.get("ghost"))?.name, "Now exists");
    assert.equal(o.calls.length, 2);
  });
});

describe("LRU", () => {
  test("evicts the least recently used key", async () => {
    const { cache, o } = setup(2);
    await cache.get("u1");
    await cache.get("u2");
    await cache.get("u1"); // u1 is now most recent
    await cache.get("u3"); // evicts u2
    assert.equal(cache.size(), 2);
    o.calls.length = 0;
    await cache.get("u1");
    await cache.get("u3");
    assert.deepEqual(o.calls, [], "u1 and u3 should still be cached");
    await cache.get("u2");
    assert.deepEqual(o.calls, ["u2"], "u2 should have been evicted");
  });
});

describe("single-flight", () => {
  test("concurrent gets share one load", async () => {
    const { cache, o } = setup();
    o.manual();
    const results = Promise.all(Array.from({ length: 50 }, () => cache.get("u1")));
    await tick();
    o.resolveAll();
    const values = await results;
    assert.equal(o.calls.length, 1);
    assert.ok(values.every((v) => v?.name === "Ada"));
  });

  test("a failed load rejects every waiter, caches nothing, and the next get retries", async () => {
    const { cache, o } = setup();
    o.manual();
    const waiters = Array.from({ length: 3 }, () => cache.get("u1"));
    await tick();
    o.rejectAll(new Error("origin down"));
    for (const w of waiters) await assert.rejects(w, /origin down/);
    assert.equal(cache.size(), 0);

    const retry = cache.get("u1");
    await tick();
    o.resolveAll();
    assert.equal((await retry)?.name, "Ada");
    assert.equal(o.calls.length, 2);
  });
});

describe("invalidation", () => {
  test("invalidate drops the cached value", async () => {
    const { cache, o } = setup();
    await cache.get("u1");
    o.db.set("u1", { id: "u1", name: "Ada (updated)" });
    cache.invalidate("u1");
    assert.equal((await cache.get("u1"))?.name, "Ada (updated)");
  });

  test("invalidate during an in-flight load: result is returned but not cached", async () => {
    const { cache, o } = setup();
    o.manual();
    const inFlight = cache.get("u1"); // load starts, reading the OLD row later
    await tick();

    cache.invalidate("u1"); // a write happened meanwhile
    o.resolveAll();
    assert.equal((await inFlight)?.name, "Ada", "the waiter still gets its result");
    assert.equal(cache.size(), 0, "the possibly stale result must not be cached");

    o.db.set("u1", { id: "u1", name: "Ada (updated)" });
    const next = cache.get("u1");
    await tick();
    o.resolveAll();
    assert.equal((await next)?.name, "Ada (updated)");
  });
});
