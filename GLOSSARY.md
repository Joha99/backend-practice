# Backend Glossary for Frontend Engineers

The terms the `design/` prompts (and the ID.me interviewer) use, each with a plain meaning and the closest thing you already know from the browser. Keep it open while you read a design prompt. Reread it the morning of the interview.

You don't need to sound like a backend engineer. Interviewers grade the **reasoning**. "Each server has its own memory, so the count has to live somewhere shared" is a great answer even if you say it with a browser-tab analogy.

---

## Numbers and performance

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **req/s, RPS, QPS** | Requests (or queries) per second the system handles | How many fetches all your users fire per second, combined |
| **Latency** | How long one request takes | Time from `fetch()` to the response |
| **p99 latency** | 99% of requests are faster than this; the slowest 1% are slower | Like a Core Web Vitals percentile: you judge by the slow tail, not the average |
| **Throughput** | How much work per second the whole system gets through | Total requests handled, not how fast each one is |
| **Hot key / hot spot** | One id that gets a huge share of the traffic (a celebrity's profile) | One React Query key every component on the page subscribes to |

## Servers and scaling

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **Horizontal scaling** | Handle more traffic by running more copies of the server | More browser tabs, each a full copy of the app |
| **Stateless server** | A server that keeps nothing important in its own memory between requests, so any copy can handle any request | A component that reads everything from props/the store, with no important `useState` |
| **Load balancer** | Spreads incoming requests across the server copies | A router that sends each user to one of many identical tabs |
| **Sharding / partitioning** | Split data across several machines by key (users A–M on one, N–Z on another) | Splitting one giant normalized store into several by id range |
| **Consistent hashing** | A way to pick which shard owns a key so that adding a machine only moves a few keys | (`problems/12` builds it) |
| **Replica / read replica** | A copy of the database that serves reads | A cached copy of server data in the client |
| **Replication lag** | A replica is a little behind the main copy (e.g. 1 s) | Your client cache showing data from 1 s ago |

## Shared state and correctness

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **Redis** | A very fast in-memory key-value store that every server talks to over the network | `localStorage` that every tab can see, but async and over the network |
| **Key-value store** | A store that maps keys to values, nothing fancier | A `Map` |
| **TTL (time to live)** | A value deletes itself after this long | React Query's `staleTime` / `gcTime`; a cookie's `max-age` |
| **Race condition** | Two things run at the same time, both read old data, and one overwrites the other | Two async click handlers both read stale state, then both call `setState` |
| **Atomic** | Happens as one uninterruptible step; nothing can run in the middle | A synchronous JS function with no `await` in it: the event loop can't interleave anything |
| **INCR** | Redis's atomic "add 1 and return the new value" | (Step 9 of the guided rate limiter) |
| **Lua script (in Redis)** | A small function that runs *inside* Redis atomically, for multi-step logic | Same idea as INCR, for logic too big for one command |
| **Source of truth** | The one place whose value wins when copies disagree | The server, vs the optimistic copy in your UI |

## Caching

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **Cache hit / miss** | The answer was / wasn't already in the cache | React Query returning cached data vs firing a fetch |
| **Hit rate** | Share of requests served from the cache | "How often do we skip the network?" |
| **Cache-aside** | The app checks the cache, and on a miss reads the DB and fills the cache itself | You call `fetch` and `queryClient.setQueryData` yourself |
| **Read-through** | The cache itself loads from the DB on a miss | `useQuery`: you give it the fetcher, it handles misses |
| **Write-through** | Writes go to the cache and the DB together | Updating the cache in the mutation's success handler |
| **Invalidation** | Throwing away a cached value because the real data changed | `invalidateQueries` after a mutation |
| **Eviction / LRU** | Dropping entries when the cache is full; LRU drops the least recently used | Garbage-collecting unused queries |
| **Negative caching** | Also caching "not found" | (Rare on the frontend) |
| **Stampede / thundering herd** | A popular cached value expires and thousands of requests hit the DB at once | Every component refetching the same query at the same moment |
| **Single-flight / request coalescing** | Many identical in-flight requests share one real request | React Query deduping identical in-flight queries |
| **Stale-while-revalidate** | Serve the old value now, refresh it in the background | Literally SWR |
| **CDN** | Caches responses on servers close to users | Same CDN you serve your JS bundle from |

## Queues and async work

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **Message queue** | A list of jobs that workers pick up and do later (SQS, Kafka, RabbitMQ) | An outbox of pending mutations, processed in the background |
| **Producer / consumer (worker)** | Who adds jobs / who does them | The UI enqueueing a mutation / the sync loop sending it |
| **Async processing** | Answer the request now ("received, processing"), do the slow work later | Optimistic UI: confirm instantly, sync after |
| **Webhook** | The server calls *your* URL when the async job finishes | A push notification instead of polling |
| **At-least-once delivery** | A job may run more than once (after a crash or timeout), but never zero times | A retried `fetch` that may have already succeeded the first time |
| **Idempotent / idempotency key** | Doing it twice has the same effect as once; the key lets the server spot repeats | `PUT /favorites/42` vs `POST /favorites/toggle`; a client-generated id on "Place order" |
| **Visibility timeout / lease** | A worker "checks out" a job for N seconds; if it doesn't finish, the job goes back on the queue | A lock with an expiry |
| **Retry with backoff + jitter** | Retry after 1 s, 2 s, 4 s…, plus a little randomness so clients don't all retry together | Your WebSocket reconnect logic |
| **Dead letter queue (DLQ)** | Where jobs go after failing too many times, for a human to look at | The "failed to send, tap to retry" list in a chat app |
| **Backpressure** | Slowing producers down when consumers can't keep up | Pausing a stream reader until you've rendered what you have |
| **Pub/sub** | Publish an event once; every subscriber gets it | `EventTarget` / an event bus (`src/patterns/01` in the frontend repo) |

## Reliability and failure

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **Region** | A full copy of the backend in one geography (us-east, eu-west) | Like a CDN edge location, but for the whole API |
| **Multi-region** | Running in several regions, for speed and for surviving an outage | |
| **Home region** | Each key's data is owned by one region | One source of truth per key |
| **Failover** | When a region or store dies, traffic moves to a backup | A fallback API URL when the primary is down |
| **Circuit breaker** | After failures, stop calling a dependency for a while, then try once ("half-open") | Not retrying a failing fetch in a tight loop |
| **Fail open / fail closed** | When a safety check itself is broken: allow everything / block everything | Feature-flag service down: show the feature to all, or hide it from all? |
| **Graceful degradation** | Keep working with reduced features when something fails | Showing cached data with a "you're offline" banner |
| **Load shedding** | Deliberately rejecting some requests to protect the system | Dropping low-priority analytics events when the tab is busy |
| **SLA / SLO** | A promised (SLA) or targeted (SLO) level of uptime or latency | A performance budget, but contractual |
| **Single point of failure** | One component whose failure takes everything down | One global context provider every route depends on |

## Data and compliance

| Term | Plain meaning | Frontend analogy |
| --- | --- | --- |
| **PII** | Personally identifiable information (name, ID number, face) | What you must never put in a URL or analytics event |
| **Data residency** | Laws saying where data may be stored (EU data stays in the EU) | A rule about which CDN regions may cache a response |
| **Encryption at rest / in transit** | Encrypted on disk / encrypted over the network (TLS) | HTTPS is "in transit" |
| **Right to be forgotten** | A user can demand their data be deleted, including from caches and backups | Clearing their data from `localStorage` *and* every cache |

---

## Phrases that work in a backend design round

- "Each server has its own memory, so this has to live in a **shared store**, and the check-and-update has to be **atomic**."
- "For this limit I'd **fail closed**, because the risk is fraud. For that one I'd **fail open**, because the risk is just cost."
- "I'd return **429 with Retry-After**, and tell clients to retry with **backoff and jitter** so they don't all come back at once."
- "A TTL alone can't meet a 5-second revocation rule, so I'd **invalidate on write** and keep a **short TTL as a backstop** in case an invalidation is lost."
- "The queue gives **at-least-once** delivery, so the worker has to be **idempotent**."
- "Let me put rough numbers on it first…" (then actually multiply: req/s × bytes × seconds).
