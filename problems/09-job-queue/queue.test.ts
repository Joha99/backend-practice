import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { JobQueue, LeaseLostError } from "./queue.ts";

const setup = (opts: { maxAttempts?: number } = {}) => {
  let t = 0;
  const q = new JobQueue<string>({
    visibilityTimeoutMs: 30_000,
    maxAttempts: opts.maxAttempts ?? 3,
    backoffBaseMs: 1_000,
    now: () => t,
  });
  return { q, advance: (ms: number) => (t += ms) };
};

describe("enqueue and claim", () => {
  test("FIFO, and claim returns null when empty", () => {
    const { q } = setup();
    q.enqueue("a");
    q.enqueue("b");
    assert.equal(q.claim("w1")?.payload, "a");
    assert.equal(q.claim("w2")?.payload, "b");
    assert.equal(q.claim("w3"), null);
  });

  test("claim increments attempts", () => {
    const { q } = setup();
    q.enqueue("a");
    assert.equal(q.claim("w1")?.attempts, 1);
  });

  test("delayMs hides a job until it's due", () => {
    const { q, advance } = setup();
    q.enqueue("later", { delayMs: 5_000 });
    assert.equal(q.claim("w1"), null);
    assert.deepEqual(q.stats(), { ready: 0, delayed: 1, inFlight: 0, done: 0, dead: 0 });
    advance(5_000);
    assert.equal(q.claim("w1")?.payload, "later");
  });

  test("a leased job can't be claimed by someone else", () => {
    const { q, advance } = setup();
    q.enqueue("a");
    q.claim("w1");
    advance(29_999);
    assert.equal(q.claim("w2"), null);
  });
});

describe("leases", () => {
  test("expired lease -> job is claimable again (at least once delivery)", () => {
    const { q, advance } = setup();
    const id = q.enqueue("a");
    q.claim("w1");
    advance(30_000);
    const again = q.claim("w2");
    assert.equal(again?.id, id);
    assert.equal(again?.attempts, 2);
  });

  test("redelivered job keeps its FIFO position", () => {
    const { q, advance } = setup();
    q.enqueue("first");
    q.claim("w1"); // w1 crashes
    q.enqueue("second");
    advance(30_000);
    assert.equal(q.claim("w2")?.payload, "first");
  });

  test("a worker whose lease expired can't complete or fail the job", () => {
    const { q, advance } = setup();
    const id = q.enqueue("a");
    q.claim("w1");
    advance(30_000);
    q.claim("w2");
    assert.throws(() => q.complete(id, "w1"), LeaseLostError);
    assert.throws(() => q.fail(id, "w1", "late"), LeaseLostError);
    q.complete(id, "w2");
    assert.equal(q.stats().done, 1);
  });

  test("expired lease with no new claimer still can't be completed", () => {
    const { q, advance } = setup();
    const id = q.enqueue("a");
    q.claim("w1");
    advance(30_001);
    assert.throws(() => q.complete(id, "w1"), LeaseLostError);
  });

  test("a different worker can't complete a job it doesn't hold", () => {
    const { q } = setup();
    const id = q.enqueue("a");
    q.claim("w1");
    assert.throws(() => q.complete(id, "w2"), LeaseLostError);
  });

  test("completed jobs are never redelivered", () => {
    const { q, advance } = setup();
    const id = q.enqueue("a");
    q.claim("w1");
    q.complete(id, "w1");
    advance(60_000);
    assert.equal(q.claim("w2"), null);
  });
});

describe("retries and dead letters", () => {
  test("fail() retries with exponential backoff", () => {
    const { q, advance } = setup({ maxAttempts: 5 });
    const id = q.enqueue("a");

    q.claim("w1");
    q.fail(id, "w1", "boom 1"); // retry after 1s
    advance(999);
    assert.equal(q.claim("w1"), null);
    advance(1);
    const second = q.claim("w1");
    assert.equal(second?.attempts, 2);
    assert.equal(second?.lastError, "boom 1");

    q.fail(id, "w1", "boom 2"); // retry after 2s
    advance(1_999);
    assert.equal(q.claim("w1"), null);
    advance(1);
    assert.equal(q.claim("w1")?.attempts, 3);

    q.fail(id, "w1", "boom 3"); // retry after 4s
    advance(3_999);
    assert.equal(q.claim("w1"), null);
    advance(1);
    assert.equal(q.claim("w1")?.attempts, 4);
  });

  test("after maxAttempts failures the job is dead-lettered", () => {
    const { q, advance } = setup({ maxAttempts: 2 });
    const id = q.enqueue("poison");
    q.claim("w1");
    q.fail(id, "w1", "bad 1");
    advance(1_000);
    q.claim("w1");
    q.fail(id, "w1", "bad 2");
    advance(60_000);
    assert.equal(q.claim("w1"), null);
    assert.deepEqual(q.stats(), { ready: 0, delayed: 0, inFlight: 0, done: 0, dead: 1 });
    const [dead] = q.deadLetters();
    assert.equal(dead.id, id);
    assert.equal(dead.attempts, 2);
    assert.equal(dead.lastError, "bad 2");
  });

  test("a job that keeps crashing workers is dead-lettered too", () => {
    const { q, advance } = setup({ maxAttempts: 2 });
    q.enqueue("crashes-workers");
    q.claim("w1");
    advance(30_000);
    q.claim("w2");
    advance(30_000);
    assert.equal(q.claim("w3"), null);
    const [dead] = q.deadLetters();
    assert.equal(dead.lastError, "lease expired");
    assert.equal(q.stats().dead, 1);
  });
});

describe("idempotency keys", () => {
  test("duplicate key returns the existing job id", () => {
    const { q } = setup();
    const a = q.enqueue("check doc 7", { idempotencyKey: "doc-7" });
    const b = q.enqueue("check doc 7", { idempotencyKey: "doc-7" });
    assert.equal(a, b);
    assert.equal(q.stats().ready, 1);
  });

  test("dedupes while in flight too", () => {
    const { q } = setup();
    const a = q.enqueue("x", { idempotencyKey: "k" });
    q.claim("w1");
    assert.equal(q.enqueue("x", { idempotencyKey: "k" }), a);
  });

  test("a key can be reused once the job is done", () => {
    const { q } = setup();
    const a = q.enqueue("x", { idempotencyKey: "k" });
    q.claim("w1");
    q.complete(a, "w1");
    const b = q.enqueue("x", { idempotencyKey: "k" });
    assert.notEqual(a, b);
  });
});

test("stats() counts each state", () => {
  const { q } = setup();
  const done = q.enqueue("done");
  q.enqueue("leased");
  q.enqueue("ready");
  q.enqueue("delayed", { delayMs: 10_000 });
  q.claim("w1");
  q.complete(done, "w1");
  q.claim("w2");
  assert.deepEqual(q.stats(), { ready: 1, delayed: 1, inFlight: 1, done: 1, dead: 0 });
});
