import { test } from "node:test";
import assert from "node:assert/strict";
import { createProfileCache } from "./cache.ts";
import { FakeProfileDb } from "./profileDb.ts";

const MINUTE = 60_000;
const ann = { id: "ann", name: "Ann Lee", status: "verified" as const };

test("invalidate drops the cached answer: the next get reads the database", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE });
  await cache.get("ann", 0);
  db.rows.set("ann", { ...ann, status: "revoked" });
  cache.invalidate("ann");
  assert.equal((await cache.get("ann", 1000))?.status, "revoked");
  assert.equal(db.calls, 2);
});

test("invalidating an id that isn't cached is harmless", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: MINUTE });
  assert.doesNotThrow(() => cache.invalidate("nobody"));
});

test("THE RACE: a read that was in flight during invalidate is not stored", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE });

  db.paused = true;
  const early = cache.get("ann", 0); // 1. a read starts and sees "verified"

  db.rows.set("ann", { ...ann, status: "revoked" }); // 2. verification is revoked
  cache.invalidate("ann"); //                            ...and the cache is told

  db.release(); // 3. the old read finishes with the OLD row
  assert.equal((await early)?.status, "verified", "the early caller asked before the change: it gets the old answer");

  // 4. If that old row had been stored, this would say "verified" for 5 minutes.
  assert.equal((await cache.get("ann", 1000))?.status, "revoked");
});

test("a get that starts after invalidate doesn't join the old in-flight read", async () => {
  const db = new FakeProfileDb([ann]);
  const cache = createProfileCache({ loadProfile: db.load, ttlMs: 5 * MINUTE });

  db.paused = true;
  const early = cache.get("ann", 0);
  db.rows.set("ann", { ...ann, status: "revoked" });
  cache.invalidate("ann");
  const late = cache.get("ann", 10); // must start its own read, which sees "revoked"
  assert.equal(db.calls, 2);

  db.release();
  assert.equal((await early)?.status, "verified");
  assert.equal((await late)?.status, "revoked");
  await cache.get("ann", 20);
  assert.equal(db.calls, 2, "the fresh read's answer was stored");
});
