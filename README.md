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

| Status | #  | Problem                         | Path                              | Difficulty   | Key Skills                                                                 |
| ------ | -- | ------------------------------- | --------------------------------- | ------------ | -------------------------------------------------------------------------- |
|        | 01 | Raw HTTP Server                 | `problems/01-raw-http-server/`    | Easy         | node:http, streaming request bodies, status codes, routing, 405 + Allow     |
|        | 02 | Bookmarks CRUD                  | `problems/02-bookmarks-crud/`     | Intermediate | Fastify, zod validation, centralized error handling, PATCH semantics, 409   |
|        | 03 | Offset vs Cursor Pagination     | `problems/03-pagination/`         | Intermediate | cursor encoding, stable sort tiebreakers, pagination under inserts         |

## Roadmap (not yet created)

| #  | Problem                       | Difficulty   | Key Skills                                                              |
| -- | ----------------------------- | ------------ | ----------------------------------------------------------------------- |
| 04 | Rate Limiter                  | Intermediate | token bucket vs sliding window, 429 + Retry-After, Fastify hooks        |
| 05 | Postgres Notes                | Intermediate | `pg`, raw SQL, migrations, parameterized queries, indexes               |
| 06 | Inventory Reservations        | Hard         | transactions, race conditions, `SELECT ... FOR UPDATE`, isolation levels |
| 07 | Idempotency Keys              | Hard         | safe retries for POST, storing responses, concurrent duplicate requests |
| 08 | Session Auth                  | Hard         | password hashing, cookies, session store, CSRF basics                   |
| 09 | Job Queue on Postgres         | Hard         | `FOR UPDATE SKIP LOCKED`, retries with backoff, worker processes        |
| 10 | Read-Through Cache            | Hard         | Redis, TTLs, invalidation, cache stampede                               |
| 11 | URL Shortener (capstone)      | Hard         | combines everything: schema, cache, rate limits, analytics counts       |
