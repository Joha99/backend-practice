# Design: Shop Offers Page That Survives Peak Shopping Traffic

**Time:** 45–60 min, three rising-difficulty parts  
**Theme:** ID.me Shop: verified members (military, teachers, nurses, students, first responders…) get exclusive offers and cashback from brands.

## Prompt

> **Part 1 (15 min):** Design the Shop offers page: members browse and search offers from 600+ brands; each offer shows a discount or cashback rate, and some offers are only visible to certain verified groups. It's built with Next.js and React.
>
> **Part 2 (15 min):** Black Friday. Traffic goes from 2,000 to 100,000 page views per second in an hour, and brands change offers every few minutes during the event. Make it hold up.
>
> **Part 3 (15 min):** New constraints: some offers are **limited quantity** ("first 5,000 nurses get 40% off") and must stop showing as available when they run out, and each member now sees a **personalized ranking**. What changes?

Don't read ahead: answer each part before looking at the next one, the way the real round adds constraints.

## Clarifying questions to ask

- Which parts of the page are the same for everyone, the same per verified group, and unique per member?
- Can logged-out visitors see offers? Is SEO important for offer pages?
- How fresh must an offer be when a brand edits or ends it: seconds, minutes?
- Which devices and networks? (Mobile on a weak connection at a military base?)
- What does "page holds up" mean: p75 LCP under 2.5 s? Error rate? Purchases completed?
- Who owns the offers API? Can it change, or do we design around it?
- Is there an existing CDN, design system, and feature flag system?

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Offers | 20,000 active; ~200 visible per group; each ~1 KB of data + an image |
| Groups | 8 verified groups; a member can be in more than one |
| Normal traffic | 2,000 page views/s, 70% mobile |
| Peak | 100,000 page views/s for ~6 hours; offers edited every few minutes |
| Freshness | Offer ended → hidden within 60 s. Limited quantity (Part 3) → within 5 s |
| Goals | Core Web Vitals "good" at p75 (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) |

## What to produce

1. **Rendering strategy** per part of the page (static, ISR, SSR, client fetch) and why. What's cacheable at the CDN, and with what cache key?
2. **Data flow**: browser → CDN → Next.js server → offers API → database. Where does each piece of data come from, and where is it cached?
3. **Group-gated offers**: how the server knows a member's verified groups, and how you keep gated offers out of shared caches for the wrong people.
4. **Part 2**: the plan for 50× traffic: what absorbs the load, what still reaches origin, and what degrades first.
5. **Part 3**: how "sold out" reaches every viewer quickly, and how personalization fits with caching.

## Deep dives the interviewer will push on

- If the page is personalized, can the CDN still cache it? What's the cache key, and what happens to the hit rate as you add more variations?
- ISR with `revalidate: 60`: what does the first visitor after expiry see? What happens when a brand needs an offer removed **now**? (On-demand revalidation? Tag-based purging?)
- An offer is visible only to nurses. A shared cache stored the nurse version under a key that doesn't include the group. What leaks, and how do you make that impossible by design?
- At 100,000 views/s, the CDN cache for the offers list expires everywhere at once. What hits the origin? How do you prevent it?
- The offers API slows to 3 s during the peak. What does the page do: block, show stale data, show a skeleton? Which is best for the member?
- Core Web Vitals: what's your LCP element on this page, and what makes it slow on mobile? Images? Fonts? Hydration?
- Part 3: limited quantity is a shared counter decremented by thousands of members at once. Where does it live, how do you avoid overselling, and how does "sold out" reach pages that are already open (polling, SSE, check on click)?
- Part 3: personalized ranking per member breaks page-level caching. What can you still cache, and where does the personalization happen (edge, server, client)?
- How do you test a 50× event before it happens? What do you watch on the day, and what's the kill switch?

## Self-grading rubric

**Strong signals**
- Splits the page into "everyone / per group / per member" parts and picks a rendering and caching strategy for each, instead of one strategy for the whole page.
- Treats group-gated offers as a **security** issue in caching (cache key or don't cache), not just a UX one.
- Has a concrete plan for the spike: CDN + stale-while-revalidate, request coalescing, protecting the origin, graceful degradation, load testing, and a kill switch / feature flags.
- Uses Core Web Vitals specifically (names the LCP element and what slows it).
- Part 3: atomic decrement / reservation for limited offers, with oversell prevention on the server, and a realistic plan for updating open pages (it's OK to check at claim time and show "sold out" there).
- Adapts the earlier design when constraints change, and says what changed and why.

**Weak signals**
- "Use SSR" or "use ISR" for everything without saying why.
- Personalizes the whole page server-side and wonders why the CDN doesn't help.
- Caches gated content under a shared key.
- Ignores the offers API being slow or down at peak.
