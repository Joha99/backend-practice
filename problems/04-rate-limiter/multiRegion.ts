/**
 * Rate Limiter, Part B: multi-region failover
 *
 * The identity-verification API now runs in several regions. Rate limit
 * counters live in a per-region store (see regionStore.ts, provided). Your
 * job: keep limiting correctly when a region's store goes down.
 *
 * Model (simplified on purpose):
 * - FIXED window counter: windowId = Math.floor(now() / windowMs).
 *   Call store.incr(key, windowId); allowed if the returned count <= limit.
 *   (Incrementing on every request, even rejected ones, is the usual Redis
 *   INCR pattern. Fine here.)
 * - Every key has a HOME region (homeRegionOf(key)). Counting always happens
 *   in the home region's store, so one key has one global count no matter
 *   which region served the request.
 * - Every region has a FAILOVER region (failoverOf[region]).
 *
 * check(key) returns { allowed, servedBy, degraded }:
 *   servedBy = the region whose store made the decision, or null if none
 *   could. degraded = true whenever the home store wasn't used.
 *
 * Requirements:
 * 1. Normal case: count in the home store. degraded: false.
 * 2. Home store throws StoreUnavailableError -> count in the failover
 *    region's store instead (counting starts fresh there). degraded: true.
 * 3. Circuit breaker: after a store throws, treat it as DOWN for
 *    probeAfterMs and don't call it at all during that time (go straight to
 *    the failover). Once probeAfterMs has passed, the next check tries it
 *    once ("half-open"): success puts it back in use, failure marks it down
 *    for another probeAfterMs. The breaker applies to every store, including
 *    failover stores.
 * 4. If neither the home nor the failover store can be used:
 *    failMode "closed" -> allowed: false; "open" -> allowed: true.
 *    servedBy: null, degraded: true.
 * 5. Only StoreUnavailableError triggers failover. Any other error is a bug
 *    and must be thrown out of check().
 *
 * Questions to answer in a comment once you're done:
 * - Why is fail-CLOSED the right default for identity verification, when
 *   many APIs choose fail-open? What does each cost you?
 * - During failover, counting restarts in the backup region. What's the
 *   worst case number of requests one key can get through in a window?
 *   How could you shrink that (lower limit while degraded, replicate
 *   counters asynchronously, ...)? What does each cost?
 * - Alternative design: every region counts locally and they sync totals
 *   every second. Compare accuracy, latency, and behavior during an outage
 *   with the "home region" design here.
 * - Fixed windows use the server clock. What goes wrong if regions'
 *   clocks disagree by a few seconds?
 *
 * Run tests: node --test problems/04-rate-limiter/multiRegion.test.ts
 * Time target: 45 minutes.
 */

import { type Clock } from "./limiter.ts";
import { type RegionStore } from "./regionStore.ts";

export type MultiRegionDecision = {
  allowed: boolean;
  servedBy: string | null;
  degraded: boolean;
};

export type MultiRegionOptions = {
  stores: RegionStore[];
  homeRegionOf: (key: string) => string;
  failoverOf: Record<string, string>;
  limit: number;
  windowMs: number;
  failMode: "open" | "closed";
  probeAfterMs: number;
  now?: Clock;
};

export class MultiRegionLimiter {
  readonly opts: MultiRegionOptions;
  readonly now: Clock;

  constructor(opts: MultiRegionOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  check(key: string): MultiRegionDecision {
    // TODO: implement
    void key;
    throw new Error("not implemented");
  }
}
