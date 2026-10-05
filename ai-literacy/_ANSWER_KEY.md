# Answer key: open only AFTER finishing an exercise

Use this to check what you and the model found. Missing one isn't failing: notice *why* you missed it (didn't ask about edge cases? didn't reproduce? trusted the model?).

---

## 01 — promoCodes.cjs (JavaScript)

1. **Group check skips the first group.** `indexOf(...) > 0` should be `!== -1` (or `>= 0`, or `includes`). A nurse can't use a promo whose groups list starts with "nurse".
2. **One extra use allowed.** `promo.uses > promo.maxUses` should be `>=`. With `maxUses: 2`, a third use succeeds and `remaining` comes back as `-1`.
3. **Fractional cents.** 20% of 999 cents returns `199.8`. Money must be rounded to whole cents (and the rounding rule should be stated: usually round half up, or round down in the customer's disfavor per business rules).
4. **Date-only expiry is UTC midnight.** `new Date("2026-11-30")` is midnight UTC, which is the afternoon of Nov 29 in the US. A code "ending Nov 30" is already expired on the morning of Nov 30 in Pacific time. Decide the business rule (end of day in which timezone?) and store a full timestamp.
5. **Validation mutates state.** `validate()` increments `promo.uses`, so just *checking* a code (e.g. showing the discount in the cart) uses it up. Validate and redeem should be separate.
6. Smaller: `maxUses: 0` is treated as "unlimited" because of the truthy check; `usesLeft` returns `NaN` when there's no `maxUses`; `DAY` is exported but unused.

## 02 — cashback.py (Python)

1. **Mutable default argument.** `history=[]` is created once and shared across every call. `preview()` never passes history, so every preview from every member appends to the same list, and the monthly cap leaks between members: member m2 gets `$0` because m1 already hit the cap.
2. **Preview has a side effect.** Even with the default fixed, `preview` is meant to be read-only but the function appends to history.
3. **Tier boundary.** `total > minimum` means an order of exactly $50 gets 2%, not 3% (and exactly $200 gets 3%). Confirm the rule ("$50 and over" is the usual meaning) and use `>=`.
4. **Floats for money.** `round(2.675, 2)` is `2.67` because of binary floating point. Use `Decimal` or integer cents, with an explicit rounding rule.
5. Smaller: `max(0, ...)` mixes int and float; `history` isn't filtered by `member_id`, so passing a list containing other members' records would also leak.

## 03 — throttle.rb (Ruby)

1. **Class variables are shared by every instance.** `@@counts` and `@@window_started` belong to the class, so the partner throttle (limit 100) and the verify throttle (limit 5) share one count per client. Five partner calls use up the verify limit, and each limiter's window resets the other's. Use instance variables (`@counts`).
2. **Not thread-safe.** Rails/Puma runs requests on several threads; check-then-increment on a Hash isn't atomic, so concurrent requests can exceed the limit. Needs a Mutex, or better, an atomic store (Redis `INCR` + `EXPIRE`).
3. **Per-process memory.** Each server process has its own counts, so with N processes the real limit is N× the configured one. In production this belongs in a shared store.
4. **Fixed window burst.** A client can make `limit` requests at the end of one window and `limit` more at the start of the next: 2× the limit in a few seconds.
5. Smaller: `remaining` ignores the window (stale counts after the window has passed); entries are never cleaned up (memory grows with every client id).

## 04 — offerSearch.ts (TypeScript)

1. **Out-of-order responses.** If the request for "ca" is slow and "cat" is fast, the "ca" results arrive last and overwrite the "cat" results. The UI shows results for a query the user already changed. Track the latest request (an id/counter, or `AbortController`) and ignore stale responses.
2. **Stale `loading` flag.** A finishing stale request sets `loading: false` while the latest request is still in flight.
3. **Clearing the query doesn't cancel.** Typing below 2 characters sets `results: []`, but an in-flight request still lands afterwards and brings results back.
4. **Updates after dispose.** `dispose()` clears the timer but not an in-flight request, so `onUpdate` can be called after the component is gone.
5. Smaller: the error message drops the actual error (no logging/observability); whitespace-only changes ("cat" → "cat ") trigger new requests because the debounce compares raw queries.
