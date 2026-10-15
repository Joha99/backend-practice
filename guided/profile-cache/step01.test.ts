import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileCache } from "./cache.ts";
import { FakeProfileDb } from "./profileDb.ts";

const MINUTE = 60_000;
const ann = { id: "ann", name: "Ann Lee", status: "verified" as const };

test("the first get reads the database; the second is served from the cache", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE });
  assert.deepEqual(await cache.get("ann", 0), ann);
  assert.deepEqual(await cache.get("ann", 1000), ann);
  assert.equal(db.calls, 1);
});

test("an answer expires exactly ttlMs after it was stored", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  await cache.get("ann", 0);
  await cache.get("ann", MINUTE - 1);
  assert.equal(db.calls, 1, "still fresh 1 ms before expiry");
  await cache.get("ann", MINUTE);
  assert.equal(db.calls, 2, "expired at exactly ttlMs");
  await cache.get("ann", MINUTE + 1000);
  assert.equal(db.calls, 2, "the reload is fresh for another ttlMs");
});

test("a reload after expiry picks up changes", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  await cache.get("ann", 0);
  db.rows.set("ann", { ...ann, name: "Ann Kim" });
  assert.equal((await cache.get("ann", 30_000))?.name, "Ann Lee", "stale but within ttl: that's the trade-off");
  assert.equal((await cache.get("ann", MINUTE))?.name, "Ann Kim");
});

test("ids are cached separately", async () => {
  const db = new FakeProfileDb([ann, { id: "bo", name: "Bo Park", status: "verified" }]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  assert.equal((await cache.get("ann", 0))?.name, "Ann Lee");
  assert.equal((await cache.get("bo", 0))?.name, "Bo Park");
  await cache.get("ann", 0);
  await cache.get("bo", 0);
  assert.equal(db.calls, 2);
});

test("not found returns null, and (in Step 1) isn't cached", async () => {
  const db = new FakeProfileDb([]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  assert.equal(await cache.get("ghost", 0), null);
  assert.equal(await cache.get("ghost", 0), null);
  assert.equal(db.calls, 2);
});
