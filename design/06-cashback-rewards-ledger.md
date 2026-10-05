# Design: Cashback Tracking and Rewards Ledger

**Time:** 45–60 min, three rising-difficulty parts  
**Theme:** ID.me Shop: members click through to a brand, buy something, and earn cashback that is paid out later.  
**Practice the pieces in code:** `problems/09-job-queue/` (retries, at-least-once), roadmap 06–07 (transactions, idempotency keys)

## Prompt

> **Part 1 (15 min):** A member clicks an offer and is sent to the brand's site. Days later, the affiliate network tells us about purchases (by webhook, and also in a nightly file). Design how we track the click, match the purchase to the member, and show "pending cashback: $4.20" in their account.
>
> **Part 2 (15 min):** Webhooks arrive more than once, out of order, and sometimes not at all (the nightly file is the source of truth). Purchases get **returned**, which must reverse the cashback. Make the numbers always correct.
>
> **Part 3 (15 min):** Members can **withdraw** their confirmed cashback to their bank or PayPal once it reaches $10. Design the payout flow. Then: the payout provider times out halfway through a payout. What do you do?

Answer each part before looking at the next one.

## Clarifying questions to ask

- How is a purchase linked to a member? (Click ID passed through the affiliate link? Expiry window?)
- What are the cashback states (pending → confirmed → paid / reversed)? Who decides when pending becomes confirmed?
- How long after purchase can a return happen? Can cashback that's already been paid out be reversed?
- What's the volume of clicks, purchases, and payouts?
- What must be auditable, and for how long? Is this regulated money movement?
- Which currency or currencies?

## Assumptions to use if the interviewer says "you decide"

| | |
| --- | --- |
| Clicks | 5 M/day, peaks of 1,500/s |
| Purchases reported | 300,000/day; webhooks are at-least-once; the nightly file is authoritative |
| Confirmation | Cashback confirmed 60 days after purchase if not returned |
| Returns | ~8% of purchases, reported up to 90 days later |
| Payouts | Members withdraw at ≥ $10; ~20,000 payouts/day via a provider API that can time out |
| Accuracy | Balances must be exactly right. Never pay twice, never lose a cent |

## What to produce

1. **The flow** for each part: click → attribution → pending → confirmed → paid (and reversed).
2. **Data model**: how money is stored. A balance column you update? An append-only ledger of entries? Why?
3. **Ingestion**: how webhooks and the nightly file are processed, deduplicated, and reconciled against each other.
4. **Idempotency** at every step that can be retried.
5. **Part 3**: the payout state machine, including the "provider timed out, did the money move?" case.
6. **Reads**: how "your balance" stays fast at scale without being wrong.

## Deep dives the interviewer will push on

- Why might an append-only ledger (entries that sum to the balance) be safer than updating a `balance` column? What does it cost you?
- The same purchase arrives by webhook three times, and then in the nightly file with a slightly different amount. Which one wins, and how is the correction recorded?
- A return arrives **before** the purchase it reverses (out of order). What happens?
- Click attribution: the member clicks two different offers for the same brand, then buys. Who gets credit? How long is a click valid?
- Two withdrawal requests for the same balance arrive at the same moment from two devices. How do you prevent paying twice? (Transactions, row locks, idempotency keys, a reservation step?)
- The payout provider times out. Did the money move? How do you find out, and what's your retry strategy without double paying?
- Showing a member's balance: cache it, compute it, or keep a running total? How do you stay exactly right?
- Fraud: a member generates fake clicks and purchases. What signals would you look for, and where in the flow would you stop it?
- Event-driven architecture: which parts would you make events (purchase-reported, cashback-confirmed, payout-requested)? What does the transactional outbox solve here?
- Auditing: a member disputes their balance from 8 months ago. Can you reconstruct exactly what happened?

## Self-grading rubric

**Strong signals**
- Uses an append-only ledger (or explains clearly why not) and never "edits" money; corrections are new entries.
- Treats every external input as at-least-once and possibly out of order, with idempotency keys and a reconciliation job against the authoritative nightly file.
- Models cashback and payouts as explicit state machines with allowed transitions.
- Prevents double payouts with a concrete mechanism (transaction + lock or unique constraint + idempotency key with the provider), and handles the timeout case by checking status before retrying.
- Separates "fast to read" (cached/derived balance) from "source of truth" (ledger), with a way to rebuild one from the other.
- Mentions auditability, money in integer cents, and fraud checks.

**Weak signals**
- A single `balance` column updated in place by webhooks.
- Assumes webhooks arrive once and in order.
- Retries a payout blindly after a timeout.
- Uses floating point for money.
