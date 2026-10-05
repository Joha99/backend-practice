# Design: Caching for a Verified-Profile Lookup Service

**Time:** 45 min  
**Practice the core in code:** `problems/10-read-through-cache/`

## Prompt

> After someone is verified, businesses look up their verification status and profile constantly ("is this user still verified?"). The lookup hits a database and is too slow and too expensive at our traffic. Design a caching layer for it.

## Clarifying questions to ask

- What exactly is read: the full profile, or just status + a few fields? Do different callers need different fields?
- How stale can a read be? Is that the same for every field? (A name change vs a **revoked** verification.)
- Read/write ratio? How are reads distributed: uniformly, or a few very hot users?
- Is the data personal (PII)? Where may it be stored, and for how long?
- Is there one region or several? Do reads come from the same region the data lives in?
- What happens today when the database is slow: do we serve stale data or fail?

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Profiles | 200 million, ~2 KB each |
| Reads | 50,000/s peak; top 1% of profiles get 60% of reads |
| Writes | 500/s (status changes, profile edits) |
| Latency target | p99 < 50 ms for reads (DB p99 is 200 ms) |
| Freshness | Profile fields: stale up to 5 min is OK. **Revocations must be visible within 5 s** |
| Data | PII; must be encrypted at rest; EU profiles stay in the EU |

## What to produce

1. **Requirements**, including the freshness rules per field.
2. **Rough numbers**: hit rate needed to protect the DB, memory to cache the hot set vs everything, cost.
3. **What to cache and where**: in-process, shared (Redis/Memcached), CDN? Justify each layer or rule it out.
4. **Read path and write path** step by step, including what happens on a miss.
5. **Invalidation strategy** that meets the 5-second revocation rule.
6. **Failure behavior**: cache down, DB down, cache cold after a deploy.

## Deep dives the interviewer will push on

- TTL-only vs explicit invalidation vs both. How do you meet "revocation within 5 s" if invalidation messages can be lost?
- A write and a cache fill race: the fill read the old row, the write invalidated, then the fill stored the old value. How do you prevent caching stale data? (Versioning? Delete-after-write? Leases?)
- A celebrity profile expires and 20,000 requests miss at once. Single-flight works per server. What about across 100 servers?
- How big is the hot set really? What eviction policy fits this access pattern?
- 100 app servers each with an in-process cache: how do invalidations reach all of them? Is in-process caching worth the complexity here?
- Caching negative results ("not found"): useful or dangerous for a verification status?
- Cache-aside vs read-through vs write-through: which do you pick and why?
- PII in a cache: encryption, TTL limits, deletion requests (right to be forgotten), multi-region residency.
- How do you warm the cache after a deploy or a region failover without crushing the DB?

## Follow-ups

- Callers want a list endpoint ("all verified users for business X"). How does caching change?
- The DB adds read replicas with 1 s replication lag. How does that interact with your cache fills?
- Measure it: which metrics tell you the cache is helping, and which tell you it's serving stale data?

## Self-grading rubric

**Strong signals**
- Derives the needed hit rate and memory from the numbers instead of saying "add a cache".
- Treats revocation as a correctness requirement, separate from ordinary freshness, with a mechanism that still works if one invalidation is lost (short TTL as a backstop, version checks, etc.).
- Spots the fill-vs-invalidate race and explains a fix.
- Handles stampedes at both the single-server and the fleet level.
- Has a clear story for cache-down (degrade to DB with load shedding?) and cold starts.
- Raises PII, encryption, and residency without being asked.

**Weak signals**
- "Put Redis in front" with a single TTL for everything.
- Never asks how stale data can be.
- Ignores invalidation across servers or regions.
- No numbers: can't say whether the hot set fits in memory.
