import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileCache } from "./cache.ts";
import { FakeProfileDb } from "./profileDb.ts";

const MINUTE = 60_000;
const ann = { id: "ann", name: "Ann Lee", status: "verified" as const };

test("1,000 requests for the same uncached id make ONE database read", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  const results = await Promise.all(Array.from({ length: 1000 }, () => cache.get("ann", 0)));
  assert.equal(db.calls, 1);
  assert.ok(results.every((r) => r?.name === "Ann Lee"));
});

test("different ids still load separately", async () => {
  const db = new FakeProfileDb([ann, { id: "bo", name: "Bo", status: "verified" }]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  await Promise.all([cache.get("ann", 0), cache.get("bo", 0), cache.get("ann", 0), cache.get("bo", 0)]);
  assert.equal(db.calls, 2);
});

test("a request that arrives while the read is in flight joins it", async () => {
  const db = new FakeProfileDb([ann]);
  db.paused = true;
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  const first = cache.get("ann", 0);
  const second = cache.get("ann", 50);
  assert.equal(db.calls, 1);
  db.release();
  assert.deepEqual(await Promise.all([first, second]), [ann, ann]);
  await cache.get("ann", 100);
  assert.equal(db.calls, 1, "and the answer was stored");
});

test("a failed read rejects every waiting caller and caches nothing", async () => {
  const db = new FakeProfileDb([ann]);
  db.failNext = true;
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  const results = await Promise.allSettled([cache.get("ann", 0), cache.get("ann", 0), cache.get("ann", 0)]);
  assert.equal(db.calls, 1);
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(cache.size(), 0);
  assert.deepEqual(await cache.get("ann", 0), ann, "the next get tries the database again");
  assert.equal(db.calls, 2);
});

test("once the read finishes, the next miss starts a new read", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  await cache.get("ann", 0);
  await cache.get("ann", MINUTE); // expired: a new read, not the old finished one
  assert.equal(db.calls, 2);
});
