# Backend Practice

Small, self-contained backend engineering problems. Each problem lives in its own folder under `problems/` with a stub file (spec in the header comment) and a test suite that acts as the grader.

Stack: Node 24 running TypeScript natively (no build step), `node:test`, Fastify, zod. Postgres + Redis via Docker from problem 05 on.

## Getting started

```bash
npm install
node --test problems/01-raw-http-server/*.test.ts   # one problem
npm test                                           # everything
npm run typecheck
```

Run a problem's server manually: `node problems/01-raw-http-server/server.ts`, then hit it with `curl`.

> Node's type stripping only supports _erasable_ TypeScript: no `enum`, no `namespace`, no constructor parameter properties (`constructor(public x: number)`). Declare fields explicitly instead. `tsconfig.json` sets `erasableSyntaxOnly` so the editor flags these.

## Problems

| Status | #   | Problem                                  | Path                              | Difficulty   | Key Skills                                                                                                                               |
| ------ | --- | ---------------------------------------- | --------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
|        | 01  | Raw HTTP Server                          | `problems/01-raw-http-server/`    | Easy         | node:http, streaming request bodies, status codes, routing, 405 + Allow                                                                  |
|        | 02  | Bookmarks CRUD                           | `problems/02-bookmarks-crud/`     | Intermediate | Fastify, zod validation, centralized error handling, PATCH semantics, 409                                                                |
|        | 03  | Offset vs Cursor Pagination              | `problems/03-pagination/`         | Intermediate | cursor encoding, stable sort tiebreakers, pagination under inserts                                                                       |
|        | 04  | Rate Limiter (identity-verification API) | `problems/04-rate-limiter/`       | Hard         | sliding window log, token bucket, 429 + Retry-After, stacked limits; Part B: multi-region failover, circuit breaker, fail open vs closed |
|        | 09  | Job Queue                                | `problems/09-job-queue/`          | Hard         | at-least-once delivery, leases/visibility timeout, backoff, dead letters, idempotency keys                                               |
|        | 10  | Read-Through Cache                       | `problems/10-read-through-cache/` | Hard         | TTL, negative caching, LRU, single-flight (stampedes), invalidation races                                                                |
|        | 12  | Consistent Hashing                       | `problems/12-consistent-hashing/` | Intermediate | sharding, virtual nodes, minimal key movement, binary search                                                                             |

## Roadmap (not yet created)

| #   | Problem                  | Difficulty   | Key Skills                                                                |
| --- | ------------------------ | ------------ | ------------------------------------------------------------------------- |
| 05  | Postgres Notes           | Intermediate | `pg`, raw SQL, migrations, parameterized queries, indexes                 |
| 06  | Inventory Reservations   | Hard         | transactions, race conditions, `SELECT ... FOR UPDATE`, isolation levels  |
| 07  | Idempotency Keys         | Hard         | safe retries for POST, storing responses, concurrent duplicate requests   |
| 08  | Session Auth             | Hard         | password hashing, cookies, session store, CSRF basics                     |
| 11  | URL Shortener (capstone) | Hard         | combines everything: schema, cache, rate limits, analytics counts         |
| 13  | Job Queue on Postgres    | Hard         | port problem 09 to a table: `FOR UPDATE SKIP LOCKED`, worker processes    |
| 14  | Cache on Redis           | Hard         | port problem 10 to Redis: TTLs, pub/sub invalidation, fleet-wide stampede |

## System Design (whiteboard)

Interview-style design prompts in `design/`. Each has clarifying questions to ask, numbers to assume, what to produce in 45 minutes, the deep dives an interviewer will push on, and a self-grading rubric. Talk or write through one, then grade yourself. Each links to the coding problem that builds its core piece.

| Status | Prompt                                                                  | File                                              | Coding problem |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------------- | -------------- |
|        | Rate limiter for an identity-verification API (+ multi-region failover) | `design/01-rate-limiter-identity-verification.md` | 04             |
|        | Caching for a verified-profile lookup service                           | `design/02-caching-verified-profiles.md`          | 10             |
|        | Scaling the verification API to 50,000 req/s                            | `design/03-scaling-verification-api.md`           | 12 (+ 04, 10)  |
|        | Async document verification pipeline (queues)                           | `design/04-async-verification-pipeline-queues.md` | 09             |
|        | Shop offers page at peak traffic (3 rising parts)                       | `design/05-shop-offers-peak-traffic.md`           | —              |
|        | Cashback tracking and rewards ledger (3 rising parts)                   | `design/06-cashback-rewards-ledger.md`            | 09 (+ 06, 07)  |

## AI Literacy (legacy code + your AI tool)

`ai-literacy/` has four short legacy files in different languages (JavaScript, Python, Ruby, TypeScript), each with several planted problems and no tests. Work through them **with** your AI tool: explain intent → find and reproduce bugs → fix → generate edge-case tests. The README there covers the workflow, how to re-steer the model, and how to prepare your two AI stories. `_ANSWER_KEY.md` is for checking yourself afterwards.
