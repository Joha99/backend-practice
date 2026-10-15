import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileCache } from "./cache.ts";
import { FakeProfileDb } from "./profileDb.ts";

const MINUTE = 60_000;

test("not found is cached for negativeTtlMs", async () => {
  const db = new FakeProfileDb([]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE, negativeTtlMs: 10_000 });
  for (let i = 0; i < 5; i++) assert.equal(await cache.get("ghost", i * 1000), null);
  assert.equal(db.calls, 1, "repeated lookups for a missing id hit the database once");
});

test("a cached null expires after negativeTtlMs (much shorter than ttlMs)", async () => {
  const db = new FakeProfileDb([]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE, negativeTtlMs: 10_000 });
  await cache.get("cara", 0);
  db.rows.set("cara", { id: "cara", name: "Cara Diaz", status: "verified" }); // she just signed up
  assert.equal(await cache.get("cara", 9_999), null, "still the cached 'not found'");
  assert.equal((await cache.get("cara", 10_000))?.name, "Cara Diaz", "the short negative TTL let her appear quickly");
  assert.equal(db.calls, 2);
});

test("found profiles still use ttlMs", async () => {
  const db = new FakeProfileDb([{ id: "ann", name: "Ann", status: "verified" }]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE, negativeTtlMs: 1000 });
  await cache.get("ann", 0);
  await cache.get("ann", 30_000);
  assert.equal(db.calls, 1);
});

test("negativeTtlMs defaults to 0: nulls aren't cached", async () => {
  const db = new FakeProfileDb([]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  await cache.get("ghost", 0);
  await cache.get("ghost", 0);
  assert.equal(db.calls, 2);
});
