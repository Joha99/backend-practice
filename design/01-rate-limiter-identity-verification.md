# Design: Rate Limiter for an Identity-Verification API (+ Multi-Region Failover)

**Time:** 45 min (Part 1: 25 min, Part 2: 20 min)  
**Practice the core in code:** `problems/04-rate-limiter/` (Part A = Part 1, Part B = Part 2)

## Prompt

> We sell an identity-verification API. Businesses send us a person's ID document and selfie; we check them (partly via paid third-party vendors) and return a result. Design the rate limiting for this API.
>
> **Part 2:** We now run in three regions. Extend your design so rate limiting keeps working when a region fails.

## Clarifying questions to ask

Ask these before designing. The answers change the design.

- Who are we limiting: the calling business (API key), the end user (document / person), the IP, or all of them?
- What are we protecting against: cost (paid vendor calls), abuse (enumerating document numbers), fairness between customers, or our own capacity? Which matters most?
- Are limits per-plan (free / pro / enterprise)? Can enterprise customers burst?
- Hard limit or soft (allow some overage and bill it)?
- What should a rejected client see, and how should they back off?
- How accurate must the limit be? Is 2% over the limit acceptable? 100% over?
- Latency budget for the limiter check itself?
- (Part 2) Can an EU person's data leave the EU? (Data residency changes where counters can live.)

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Customers (API keys) | 2,000 |
| Global peak | 5,000 verification requests/s |
| Vendor cost | $0.50 per verification; vendor caps us at 8,000 req/s total |
| Plans | Free: 1 req/s, burst 5. Pro: 20 req/s, burst 100. Enterprise: custom |
| Abuse limit | 3 attempts per document per 10 min, across all customers |
| Limiter latency budget | < 5 ms p99 added per request |
| Regions (Part 2) | us-east, eu-west, ap-south. EU documents must be processed and stored in the EU |

## What to produce

1. **Requirements** you're designing for (functional + non-functional), confirmed with the interviewer.
2. **Rough numbers**: requests/s per region, how many counters exist, memory per counter, total memory.
3. **Algorithm choice** for each limit, with the trade-off you're accepting.
4. **Architecture**: where the check runs (gateway? app? sidecar?), where counters live, what the request path looks like end to end.
5. **API behavior**: status code, headers, what a client should do on rejection.
6. **Part 2**: what happens to limiting when one region's counter store goes down, and when a whole region goes down.

## Deep dives the interviewer will push on

- Your counter store is shared by 50 app servers. How do you make "read count, compare, increment" safe when two requests for the same key arrive at the same instant?
- The counter store is slow or down. Does the API reject everything, allow everything, or something in between? Is the answer the same for the per-document abuse limit and the per-customer limit?
- A customer has 20 servers that all retry at exactly the same moment after a 429. What happens, and what do you tell customers to do?
- Hot key: one enterprise customer sends 3,000 req/s. Does one counter become a bottleneck? How do you spread it?
- Where do limit configs live, and how does a plan upgrade take effect without a deploy?
- How do you know the limiter is working? What do you measure and alert on?
- **Part 2:** keys live in a "home" region vs every region counts locally and syncs. Compare accuracy, latency, and outage behavior.
- **Part 2:** during failover, how far over the limit can a key get? Is that acceptable for the cost limit? For the abuse limit?
- **Part 2:** how does data residency constrain where an EU document's counter can live? What's your failover region for EU traffic?
- **Part 2:** the failed region comes back. How do you switch back without a burst of over-admission or a thundering herd?

## Follow-ups

- Add a monthly quota (e.g. 10,000 verifications/month on the Pro plan). How is that different from a per-second limit?
- Charge customers for overage instead of rejecting. What changes?
- A customer complains they got 429s while under their limit. How do you debug it?

## Self-grading rubric

**Strong signals**
- Separates the *why* of each limit (cost, abuse, fairness, capacity) and picks a different key and algorithm for each.
- Picks an algorithm deliberately and names what it gives up (memory vs accuracy vs burst behavior).
- Makes the check-and-increment atomic and says how.
- Has a clear fail-open vs fail-closed decision per limit, justified by the business risk.
- Returns 429 with `Retry-After` and gives clients backoff guidance (with jitter).
- Part 2: quantifies worst-case over-admission during failover, respects data residency, and handles recovery (not just failure).
- Mentions observability: rejection rates per key, limiter latency, store errors.

**Weak signals**
- One global limit with no discussion of what it protects.
- In-memory counters per server without noticing N servers = N× the limit.
- "Use Redis" with no story for when Redis is down.
- Treats multi-region as "replicate everything" without consistency, latency, or residency trade-offs.
