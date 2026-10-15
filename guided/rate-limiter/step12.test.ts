import { test } from "node:test";
import assert from "node:assert/strict";
import { createMultiRegionLimiter } from "./limiter.ts";
import { FakeSharedStore } from "./sharedStore.ts";

const MINUTE = 60_000;
const PROBE_AFTER = 10_000;

const setup = () => {
  let time = 0;
  const clock = () => time;
  const stores = {
    home: new FakeSharedStore(clock),
    backup: new FakeSharedStore(clock),
  };
  const limiter = createMultiRegionLimiter({
    stores,
    homeRegionOf: () => "home",
    failoverOf: { home: "backup", backup: "home" },
    limit: 100,
    windowMs: MINUTE,
    failMode: "closed",
    probeAfterMs: PROBE_AFTER,
  });
  return {
    stores,
    check: () => limiter.check("k", time),
    setTime: (t: number) => {
      time = t;
    },
  };
};

test("after a failure, the dead store is skipped (not called) until probeAfterMs", async () => {
  const { stores, check, setTime } = setup();
  stores.home.down = true;
  assert.equal((await check()).servedBy, "backup");
  assert.equal(stores.home.calls, 1, "tried once and failed");

  setTime(5_000);
  for (let i = 0; i < 3; i++) assert.equal((await check()).servedBy, "backup");
  assert.equal(stores.home.calls, 1, "breaker open: home isn't called at all");
});

test("half-open: after probeAfterMs one request tries again; success closes the breaker", async () => {
  const { stores, check, setTime } = setup();
  stores.home.down = true;
  await check(); // fails at t=0, open until 10,000
  stores.home.down = false; // home recovers, but we don't know yet

  setTime(PROBE_AFTER - 1);
  assert.equal((await check()).servedBy, "backup", "still open");
  assert.equal(stores.home.calls, 1);

  setTime(PROBE_AFTER);
  assert.deepEqual(await check(), { allowed: true, servedBy: "home", degraded: false });
  assert.equal((await check()).servedBy, "home", "closed again: back to normal");
});

test("half-open probe fails: open again for another probeAfterMs", async () => {
  const { stores, check, setTime } = setup();
  stores.home.down = true;
  await check(); // open until 10,000
  setTime(PROBE_AFTER);
  assert.equal((await check()).servedBy, "backup", "probe failed");
  assert.equal(stores.home.calls, 2);
  setTime(PROBE_AFTER + 5_000);
  await check();
  assert.equal(stores.home.calls, 2, "open until 20,000 now");
  setTime(2 * PROBE_AFTER);
  stores.home.down = false;
  assert.equal((await check()).servedBy, "home");
});

test("the breaker applies to the failover store too", async () => {
  const { stores, check, setTime } = setup();
  stores.home.down = true;
  stores.backup.down = true;
  assert.deepEqual(await check(), { allowed: false, servedBy: null, degraded: true });
  assert.equal(stores.home.calls, 1);
  assert.equal(stores.backup.calls, 1);
  setTime(1_000);
  assert.deepEqual(await check(), { allowed: false, servedBy: null, degraded: true });
  assert.equal(stores.home.calls, 1, "both open: neither is called");
  assert.equal(stores.backup.calls, 1);
});
