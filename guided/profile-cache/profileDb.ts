// ✅ PROVIDED. You don't need to edit this file.
//
// A fake database of verified-identity profiles. Reading from it is the
// "slow, expensive" thing the cache protects. Tests use its knobs to count
// reads and to control WHEN a read finishes (to set up timing races).

export interface Profile {
  id: string;
  name: string;
  status: "verified" | "revoked";
}

export class FakeProfileDb {
  /** The "table". Tests change rows directly to simulate writes. */
  rows = new Map<string, Profile>();
  /** How many reads hit the database. The whole point of a cache is to keep this low. */
  calls = 0;
  /** When true, reads wait until release() is called. */
  paused = false;
  /** When true, the next read rejects (then this resets to false). */
  failNext = false;

  private waiting: Array<() => void> = [];

  constructor(profiles: Profile[] = []) {
    for (const p of profiles) this.rows.set(p.id, p);
  }

  /** The loader to hand to your cache. Resolves to a COPY of the row, or null. */
  load = async (id: string): Promise<Profile | null> => {
    this.calls++;
    const shouldFail = this.failNext;
    this.failNext = false;
    // The database reads the row NOW; the answer travels back later. So a
    // write that happens while the answer is in flight isn't in it.
    const row = this.rows.get(id);
    const snapshot = row ? { ...row } : null;
    if (this.paused) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (shouldFail) throw new Error("database timeout");
    return snapshot;
  };

  /** Let every paused read finish (with the data they read when they started). */
  release(): void {
    this.paused = false;
    const waiting = this.waiting;
    this.waiting = [];
    waiting.forEach((resolve) => resolve());
  }
}
