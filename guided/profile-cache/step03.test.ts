import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileCache } from "./cache.ts";
import { FakeProfileDb, type Profile } from "./profileDb.ts";

const MINUTE = 60_000;
const people: Profile[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), status: "verified" }));

test("size counts cached ids", async () => {
  const db = new FakeProfileDb(people);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  assert.equal(cache.size(), 0);
  await cache.get("a", 0);
  await cache.get("b", 0);
  await cache.get("a", 0);
  assert.equal(cache.size(), 2);
});

test("over maxEntries, the least recently STORED id is evicted when nothing was read again", async () => {
  const db = new FakeProfileDb(people);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE, maxEntries: 2 });
  await cache.get("a", 0);
  await cache.get("b", 0);
  await cache.get("c", 0); // evicts a
  assert.equal(cache.size(), 2);
  await cache.get("b", 0);
  await cache.get("c", 0);
  assert.equal(db.calls, 3, "b and c are still cached");
  await cache.get("a", 0);
  assert.equal(db.calls, 4, "a was evicted");
});

test("a cache hit counts as a use (LRU, not first-in-first-out)", async () => {
  const db = new FakeProfileDb(people);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE, maxEntries: 2 });
  await cache.get("a", 0);
  await cache.get("b", 0);
  await cache.get("a", 0); // a is now the most recently used
  await cache.get("c", 0); // evicts b, not a
  await cache.get("a", 0);
  assert.equal(db.calls, 3, "a survived");
  await cache.get("b", 0);
  assert.equal(db.calls, 4, "b was evicted");
});

test("re-storing an id that's already cached doesn't evict anything", async () => {
  const db = new FakeProfileDb(people);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE, maxEntries: 2 });
  await cache.get("a", 0); // a expires at 60,000
  await cache.get("b", 1000); // b expires at 61,000
  await cache.get("a", MINUTE); // a expired: reloaded and stored again (cache is full, but a is already in it)
  assert.equal(db.calls, 3);
  assert.equal(cache.size(), 2);
  await cache.get("b", MINUTE);
  assert.equal(db.calls, 3, "b wasn't evicted to make room for a");
});

test("cached nulls count toward maxEntries too", async () => {
  const db = new FakeProfileDb(people);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE, negativeTtlMs: MINUTE, maxEntries: 2 });
  await cache.get("a", 0);
  await cache.get("ghost1", 0);
  await cache.get("ghost2", 0); // evicts a
  assert.equal(cache.size(), 2);
  await cache.get("a", 0);
  assert.equal(db.calls, 4);
});
