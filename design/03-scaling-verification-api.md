# Design: Scaling the Verification API from One Server to 50,000 req/s

**Time:** 45 min  
**Practice the core in code:** `problems/12-consistent-hashing/` (sharding), plus 04 and 10

## Prompt

> Our identity-verification API runs on one server with one Postgres database and handles 100 requests/s. Traffic is growing to 50,000 requests/s across three regions over the next year. Walk me through how the architecture evolves, step by step, and what breaks at each step.

This is an **evolution** question: don't draw the final architecture first. Start from what exists, find the next bottleneck, fix it, repeat.

## Clarifying questions to ask

- What's the read/write mix? Which endpoints are hot?
- What does one request do: CPU work, DB queries, calls to third-party vendors? Which part is slowest?
- What are the latency and availability targets (p99, uptime)?
- Is any of the work synchronous only because it always has been?
- Are there data residency rules across regions?
- What's the budget? Is "rewrite everything" on the table?

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Request mix | 85% reads (status lookups), 15% writes (new verifications, status updates) |
| Per request today | ~20 ms CPU, 3 DB queries, writes also call a vendor (1–10 s) synchronously |
| Data | 200 M verifications, growing 5 M/month; 2 KB each + document images (stored elsewhere) |
| Targets | p99 < 300 ms for reads, 99.95% availability |
| Regions | us-east, eu-west, ap-south; EU data stays in the EU |

## What to produce

1. **Back-of-envelope** at each scale step: servers needed, DB QPS, storage growth, bandwidth.
2. **The evolution**, roughly: 100 → 1,000 → 10,000 → 50,000 req/s. At each step: the bottleneck, the change you make, and the new problem it creates.
3. **The final picture**: load balancing, stateless app tier, caching, async processing, database scaling, multi-region layout.
4. **How you'd roll it out** without downtime (especially the database changes).

## Deep dives the interviewer will push on

- Which bottleneck shows up first? How do you know, and what would you measure before changing anything?
- Making the app tier stateless: what state is hiding in the current server (sessions, in-memory rate limits, local files)?
- Reads: caching vs read replicas. What does replication lag do to "I just submitted, now show me my status"?
- Writes: when does one Postgres primary stop being enough? Vertical scaling vs partitioning by time vs sharding by customer/user. What's your shard key, and what queries get harder?
- Resharding: you started with 8 shards and need 32. How do you move data without downtime? (Where does consistent hashing help, and where doesn't it?)
- The synchronous vendor call holds a connection for up to 10 s. What does that do to capacity, and what's the fix?
- Autoscaling: what metric drives it, how fast does it react, and what happens during a 10× spike before new servers are ready?
- Backpressure and load shedding: when overloaded, what do you reject first?
- Multi-region: active-active or active-passive? How is a request routed to the right region, and what happens to an EU user who travels to the US?
- What breaks during a regional failover: DNS TTLs, cold caches, connection storms?

## Follow-ups

- Cost: which of your changes is the most expensive, and is there a cheaper path to the same result?
- A single enterprise customer becomes 30% of all traffic. Does your design isolate them from everyone else?
- What would you build first if you only had one quarter?

## Self-grading rubric

**Strong signals**
- Starts by measuring and estimating, not by drawing boxes.
- Scales step by step, naming the specific bottleneck each change removes and the new problem it introduces.
- Moves slow vendor calls off the request path (queue + async status), recognizing it as the biggest capacity win.
- Chooses a shard key from the query patterns and explains cross-shard costs and resharding.
- Handles read-your-writes with replicas and caches.
- Multi-region plan covers routing, data residency, failover, and failback.
- Includes zero-downtime migrations and observability.

**Weak signals**
- Jumps straight to "microservices + Kubernetes + Kafka" without numbers.
- Adds caches and replicas without discussing staleness.
- Shards without a shard key discussion.
- Treats multi-region as copying everything everywhere.
