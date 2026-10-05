/**
 * Consistent Hashing: sharding that survives adding and removing servers
 *
 * When one cache or database server isn't enough, you split keys across N
 * servers. `hash(key) % N` works until N changes: then almost every key
 * moves, and the whole cache misses at once. Consistent hashing fixes that.
 *
 *   const ring = new HashRing({ virtualNodes: 100 })
 *   ring.addNode("cache-a"); ring.addNode("cache-b")
 *   ring.getNode("user-42")   // "cache-b"
 *
 * Use the provided `hash` (32-bit FNV-1a) for everything, so results are
 * deterministic.
 *
 * Requirements:
 * 1. Each node is placed on a ring (0 .. 2^32 - 1) at `virtualNodes`
 *    points: hash(`${nodeId}#${i}`) for i = 0 .. virtualNodes - 1.
 * 2. getNode(key): find hash(key) on the ring and walk CLOCKWISE to the
 *    first node point at or after it, wrapping around past the end.
 *    Empty ring -> throw an Error.
 * 3. addNode(id) / removeNode(id). Adding a node that already exists, or
 *    removing one that doesn't, does nothing.
 * 4. nodes() -> node ids, sorted.
 * 5. getNode must be O(log P) where P is the number of ring points:
 *    keep the points sorted and binary search. (The test does 200,000
 *    lookups on a ring with 20,000 points.)
 *
 * What the tests check:
 * - Balance: with 100 virtual nodes, 4 nodes each get 15%–35% of 20,000
 *   keys (fair share is 25%).
 * - Adding a 5th node moves roughly 1/5 of keys, and every key that moves
 *   moves TO the new node.
 * - Removing a node moves only the keys that were on it.
 *
 * Questions to answer in a comment once you're done:
 * - With virtualNodes = 1, how uneven can 4 nodes get? Why do virtual
 *   nodes fix it?
 * - How would you give a bigger server twice as many keys?
 * - Compare with `hash % N` when going from 4 to 5 servers: what fraction of
 *   keys move? (Try it.)
 * - A key's node dies. Where should its replica live so a single failure
 *   loses nothing? (Hint: keep walking clockwise.)
 *
 * Run tests: node --test problems/12-consistent-hashing/*.test.ts
 * Time target: 40 minutes.
 */

/** Provided: 32-bit FNV-1a. Returns an unsigned integer in [0, 2^32). */
export const hash = (input: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Extra mixing (murmur3 finalizer) so similar strings spread out.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

export class HashRing {
  readonly virtualNodes: number;

  constructor(opts: { virtualNodes: number }) {
    this.virtualNodes = opts.virtualNodes;
  }

  addNode(id: string): void {
    // TODO: implement
    void id;
    throw new Error("not implemented");
  }

  removeNode(id: string): void {
    // TODO: implement
    void id;
    throw new Error("not implemented");
  }

  getNode(key: string): string {
    // TODO: implement
    void key;
    throw new Error("not implemented");
  }

  nodes(): string[] {
    // TODO: implement
    throw new Error("not implemented");
  }
}
