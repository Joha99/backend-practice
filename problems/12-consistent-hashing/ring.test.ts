import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HashRing, hash } from "./ring.ts";

const keys = (n: number) => Array.from({ length: n }, (_, i) => `user-${i}`);

const assignment = (ring: HashRing, ks: string[]) => new Map(ks.map((k) => [k, ring.getNode(k)]));

const ringWith = (ids: string[], virtualNodes = 100) => {
  const ring = new HashRing({ virtualNodes });
  ids.forEach((id) => ring.addNode(id));
  return ring;
};

describe("basics", () => {
  test("empty ring throws", () => {
    assert.throws(() => new HashRing({ virtualNodes: 10 }).getNode("x"));
  });

  test("single node gets every key", () => {
    const ring = ringWith(["only"]);
    assert.ok(keys(100).every((k) => ring.getNode(k) === "only"));
  });

  test("deterministic: same ring, same answers", () => {
    const a = ringWith(["a", "b", "c"]);
    const b = ringWith(["c", "a", "b"]); // insertion order doesn't matter
    for (const k of keys(500)) assert.equal(a.getNode(k), b.getNode(k));
  });

  test("walks clockwise and wraps around", () => {
    const ring = ringWith(["a", "b"], 1);
    const pa = hash("a#0");
    const pb = hash("b#0");
    const [low, high] = pa < pb ? [["a", pa], ["b", pb]] : [["b", pb], ["a", pa]];
    // find keys that land in each arc
    const ks = keys(5000);
    const between = ks.find((k) => hash(k) > (low[1] as number) && hash(k) <= (high[1] as number))!;
    const after = ks.find((k) => hash(k) > (high[1] as number))!;
    const before = ks.find((k) => hash(k) <= (low[1] as number))!;
    assert.equal(ring.getNode(between), high[0]);
    assert.equal(ring.getNode(after), low[0], "past the last point wraps to the first");
    assert.equal(ring.getNode(before), low[0]);
  });

  test("nodes() is sorted; duplicate add / unknown remove do nothing", () => {
    const ring = ringWith(["b", "a"]);
    ring.addNode("a");
    ring.removeNode("zzz");
    assert.deepEqual(ring.nodes(), ["a", "b"]);
  });
});

describe("distribution", () => {
  test("4 nodes x 100 virtual nodes are roughly balanced", () => {
    const ring = ringWith(["n1", "n2", "n3", "n4"]);
    const counts = new Map<string, number>();
    for (const k of keys(20_000)) counts.set(ring.getNode(k), (counts.get(ring.getNode(k)) ?? 0) + 1);
    for (const [node, n] of counts) {
      const share = n / 20_000;
      assert.ok(share > 0.15 && share < 0.35, `${node} got ${(share * 100).toFixed(1)}%`);
    }
    assert.equal(counts.size, 4);
  });
});

describe("rebalancing", () => {
  test("adding a node moves ~1/5 of keys, all to the new node", () => {
    const ks = keys(20_000);
    const ring = ringWith(["n1", "n2", "n3", "n4"]);
    const before = assignment(ring, ks);
    ring.addNode("n5");
    const after = assignment(ring, ks);

    let moved = 0;
    for (const k of ks) {
      if (before.get(k) !== after.get(k)) {
        moved++;
        assert.equal(after.get(k), "n5", `${k} moved between old nodes`);
      }
    }
    const fraction = moved / ks.length;
    assert.ok(fraction > 0.1 && fraction < 0.3, `moved ${(fraction * 100).toFixed(1)}%`);
  });

  test("removing a node only moves the keys that were on it", () => {
    const ks = keys(20_000);
    const ring = ringWith(["n1", "n2", "n3", "n4"]);
    const before = assignment(ring, ks);
    ring.removeNode("n2");
    const after = assignment(ring, ks);
    for (const k of ks) {
      if (before.get(k) !== "n2") assert.equal(after.get(k), before.get(k));
      else assert.notEqual(after.get(k), "n2");
    }
    assert.deepEqual(ring.nodes(), ["n1", "n3", "n4"]);
  });
});

test("lookups are fast (binary search, not a linear scan)", () => {
  const ring = ringWith(Array.from({ length: 200 }, (_, i) => `node-${i}`)); // 20,000 points
  const ks = keys(200_000);
  const start = performance.now();
  for (const k of ks) ring.getNode(k);
  const ms = performance.now() - start;
  assert.ok(ms < 1000, `200k lookups took ${ms.toFixed(0)}ms`);
});
