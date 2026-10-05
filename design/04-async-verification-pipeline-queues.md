# Design: Asynchronous Document Verification Pipeline (Queues)

**Time:** 45 min  
**Practice the core in code:** `problems/09-job-queue/`

## Prompt

> When a business submits a verification, several slow steps run: extract text from the ID document (OCR), match the selfie against the ID photo, and check the person against watchlists through a third-party vendor. Then we notify the business with the result. Design this pipeline so it's reliable, scales, and never loses or double-charges a verification.

## Clarifying questions to ask

- How long does each step take, and how often does each one fail? Which failures are worth retrying?
- Which steps depend on each other, and which can run in parallel?
- Does each vendor have rate limits or per-call costs?
- How does the business learn the result: polling, webhooks, both? What delivery guarantee do they expect?
- Is there a deadline (e.g. a result within 5 minutes, or it counts as failed)?
- Can a business cancel a verification in progress?
- What must be auditable (regulators may ask "what happened, when, and why")?

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Volume | 2 M verifications/day, peak 100/s |
| OCR | 2–10 s, fails 1% of the time (retryable) |
| Face match | 1–3 s, our own GPU service |
| Watchlist vendor | up to 60 s, fails 5% (timeouts), **max 50 req/s**, $0.20 per call |
| Result | webhook to the business within 5 min (p99), retried if their endpoint is down |
| Audit | every step's input, output, and timing kept for 5 years |

## What to produce

1. **The flow**: steps, which run in parallel, and what triggers each.
2. **The queueing design**: one queue per step, a single queue, or a workflow/orchestration engine? Why?
3. **Job lifecycle**: states, retries, backoff, timeouts, dead letters.
4. **Data model**: what's stored about a verification and each step, and where.
5. **Delivery to the business**: status API and webhooks, including retries and security.
6. **Capacity math**: workers per step, queue depth during a spike, how long a backlog takes to drain.

## Deep dives the interviewer will push on

- Queues deliver at least once. A worker finishes the paid vendor call, then crashes before acknowledging. How do you avoid paying twice and recording two results?
- The vendor allows 50 req/s, but a spike puts 6,000 jobs in the queue. How do you respect the vendor limit, and what do you tell businesses about delays?
- Choreography (each step emits an event that triggers the next) vs orchestration (a coordinator drives the steps). Which is easier to debug and audit?
- A "poison" document crashes the OCR worker every time. What stops it from blocking the queue forever?
- Retries: which errors are retryable? How do backoff and jitter work here? What's the total retry budget relative to the 5-minute deadline?
- Webhooks: the business's endpoint is down for 2 hours. How do you retry, in what order, and how does the business verify that a webhook really came from you?
- Ordering: can two status updates for the same verification arrive at the business out of order? Does it matter, and how do you handle it?
- Exactly-once processing doesn't exist in practice. What do you actually guarantee, and how (idempotency keys, deduplication, transactional outbox)?
- How do you replay or re-run a step after a bug fix, for 10,000 affected verifications?
- What do you monitor: queue depth, age of oldest message, retry rate, dead letter count, end-to-end latency?

## Follow-ups

- Add a manual review step where a human approves borderline cases (minutes to days). How does the workflow change?
- Cancellations: the business cancels while the vendor call is in flight.
- A region fails mid-pipeline. What happens to in-flight jobs?

## Self-grading rubric

**Strong signals**
- Treats at-least-once delivery as a given and designs every step to be idempotent, especially paid vendor calls.
- Separates retryable from non-retryable errors, with backoff + jitter, a retry budget tied to the deadline, and a dead-letter path with alerting.
- Controls throughput to the vendor (a rate limiter / concurrency cap on that step) and reasons about backlog drain time.
- Picks orchestration or choreography deliberately, with auditability in mind.
- Webhooks: retries with backoff, idempotent payloads (event ids), signatures, and a status API as a fallback.
- Mentions the transactional outbox (or equivalent) for "update DB + enqueue next step" atomically.
- Concrete monitoring: queue age, not just depth.

**Weak signals**
- "Put it on Kafka" without lifecycle, retries, or idempotency.
- Assumes exactly-once delivery.
- Retries forever, or retries non-retryable errors.
- No plan for the vendor's rate limit or cost.
