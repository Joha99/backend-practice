/**
 * Job Queue: at-least-once delivery, leases, retries, dead letters
 *
 * Build the core of a work queue (the part SQS, Sidekiq, BullMQ, or a
 * Postgres `FOR UPDATE SKIP LOCKED` table all implement), in memory.
 * Context: identity documents are uploaded, then workers run slow checks on
 * them (OCR, fraud scoring). Workers can crash at any moment.
 *
 * It's PULL based and time is injected, so there are no timers:
 *   const q = new JobQueue({ visibilityTimeoutMs, maxAttempts, backoffBaseMs, now })
 *   const id = q.enqueue(payload, { idempotencyKey?, delayMs? })
 *   const job = q.claim("worker-1")   // Job | null
 *   q.complete(job.id, "worker-1")
 *   q.fail(job.id, "worker-1", "OCR timed out")
 *
 * Job (what claim() returns): { id, payload, attempts, lastError?: string }
 *
 * Requirements:
 * 1. enqueue() returns a new job id. With delayMs, the job isn't claimable
 *    until now + delayMs.
 * 2. claim(workerId) returns the claimable job that was enqueued FIRST
 *    (FIFO by enqueue order), or null. Claiming:
 *    - increments attempts (the returned job shows the new count),
 *    - gives that worker a LEASE until now + visibilityTimeoutMs. While the
 *      lease is valid no one else can claim the job.
 * 3. Lease expiry = the worker probably crashed. An expired job becomes
 *    claimable again (at its original FIFO position). That's why delivery
 *    is "at least once".
 * 4. complete(id, workerId) marks the job done. fail(id, workerId, error)
 *    records lastError and schedules a retry after
 *    backoffBaseMs * 2^(attempts - 1)  (1x, 2x, 4x, ...).
 *    Both throw LeaseLostError if that worker doesn't hold a valid lease on
 *    the job (it expired, or someone else holds it now). A slow worker must
 *    not complete a job another worker is processing.
 * 5. Dead letters: when a job has used maxAttempts attempts and fails again
 *    (via fail() OR an expired lease), move it to the dead-letter list
 *    instead of retrying. For an expired lease, lastError = "lease expired".
 * 6. idempotencyKey: enqueueing with a key that's already in the queue (not
 *    yet done or dead) returns the EXISTING job id and adds nothing.
 * 7. stats() -> { ready, delayed, inFlight, done, dead } counts.
 *    ready = claimable now; delayed = waiting on delayMs or backoff;
 *    inFlight = valid lease. deadLetters() -> the dead Job objects.
 *
 * Questions to answer in a comment once you're done:
 * - A worker completes a job, then crashes before calling complete(). The
 *   job runs twice. How do you make the job's side effect safe to repeat?
 * - Why exponential backoff (and in real systems, jitter) instead of
 *   retrying immediately?
 * - How would claim() work on Postgres with 50 workers polling at once?
 *   Look up `SELECT ... FOR UPDATE SKIP LOCKED`.
 * - FIFO is per queue here. What breaks if jobs for the SAME user must run
 *   in order, but workers run in parallel?
 *
 * Run tests: node --test problems/09-job-queue/*.test.ts
 * Time target: 60 minutes.
 */

export type Clock = () => number;

export type Job<T> = {
  id: string;
  payload: T;
  attempts: number;
  lastError?: string;
};

export type QueueStats = {
  ready: number;
  delayed: number;
  inFlight: number;
  done: number;
  dead: number;
};

export class LeaseLostError extends Error {
  constructor(jobId: string) {
    super(`lease lost for job ${jobId}`);
    this.name = "LeaseLostError";
  }
}

export type QueueOptions = {
  visibilityTimeoutMs: number;
  maxAttempts: number;
  backoffBaseMs: number;
  now?: Clock;
};

export class JobQueue<T> {
  readonly opts: QueueOptions;
  readonly now: Clock;

  constructor(opts: QueueOptions) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  enqueue(payload: T, options: { idempotencyKey?: string; delayMs?: number } = {}): string {
    // TODO: implement
    void payload;
    void options;
    throw new Error("not implemented");
  }

  claim(workerId: string): Job<T> | null {
    // TODO: implement
    void workerId;
    throw new Error("not implemented");
  }

  complete(jobId: string, workerId: string): void {
    // TODO: implement
    void jobId;
    void workerId;
    throw new Error("not implemented");
  }

  fail(jobId: string, workerId: string, error: string): void {
    // TODO: implement
    void jobId;
    void workerId;
    void error;
    throw new Error("not implemented");
  }

  stats(): QueueStats {
    // TODO: implement
    throw new Error("not implemented");
  }

  deadLetters(): Job<T>[] {
    // TODO: implement
    throw new Error("not implemented");
  }
}
