// ✅ PROVIDED for Steps 9–12. You don't need to edit this file.
//
// A fake version of Redis: a store that SEVERAL servers share over the
// network. Frontend analogy: localStorage that every browser tab can see,
// except every call is async (it's a network round trip) and it can go down.
//
// Every method `await`s before doing its work, like a real network call. That
// gap is what lets two servers' requests interleave (Step 9).

export class StoreUnavailableError extends Error {
  constructor(message = "store unavailable") {
    super(message);
    this.name = "StoreUnavailableError";
  }
}

/** What your limiters depend on. Anything with these methods works. */
export interface SharedStore {
  /** Read a number, or null if the key doesn't exist (or expired). */
  get(key: string): Promise<number | null>;
  /** Write a number that disappears after ttlMs. */
  set(key: string, value: number, ttlMs: number): Promise<void>;
  /**
   * ATOMIC "add 1 and tell me the new value", in ONE round trip. Nothing can
   * happen between the read and the write (Redis INCR). A new key starts at 0
   * (so the first incr returns 1) and expires ttlMs after it was CREATED.
   */
  incr(key: string, ttlMs: number): Promise<number>;
}

export class FakeSharedStore implements SharedStore {
  /** Set to true to simulate the store being down: every call throws. */
  down = false;
  /** How many round trips were made (tests use it). */
  calls = 0;

  private data = new Map<string, { value: number; expiresAt: number }>();
  private now: () => number;

  /** `now` is the store's clock, in ms. */
  constructor(now: () => number) {
    this.now = now;
  }

  async get(key: string): Promise<number | null> {
    await this.roundTrip();
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    await this.roundTrip();
    this.data.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    await this.roundTrip();
    // From here to the return there's no `await`, so no other request can
    // run in the middle. That's what "atomic" means.
    const entry = this.live(key);
    if (entry) {
      entry.value += 1;
      return entry.value;
    }
    this.data.set(key, { value: 1, expiresAt: this.now() + ttlMs });
    return 1;
  }

  /** Number of keys that haven't expired (a test helper, not a network call). */
  size(): number {
    for (const key of [...this.data.keys()]) this.live(key);
    return this.data.size;
  }

  private live(key: string) {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  private async roundTrip() {
    this.calls++;
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (this.down) throw new StoreUnavailableError();
  }
}
