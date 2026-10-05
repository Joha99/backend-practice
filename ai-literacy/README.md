# AI Literacy Practice

Practice for the round where you get **unfamiliar legacy code** and, using your own AI tool on screen, you **work out what it does → find what's wrong → fix it → generate edge-case tests**. You'll also be asked how AI has changed the way you work.

The point is to practice the **process**, not to find the answers. Do every exercise *with* Claude Code (or whatever you'll use in the interview), out loud, as if someone were watching.

## Exercises

Each folder has one file. No tests, few comments, and no hints about what's wrong. The language changes on purpose, as it does in the real round.

| # | File | Language | Context |
| --- | --- | --- | --- |
| 01 | `01-promo-codes-js/promoCodes.cjs` | JavaScript (old CommonJS) | validates a promo code at Shop checkout |
| 02 | `02-cashback-python/cashback.py` | Python | calculates cashback with tiers and a monthly cap |
| 03 | `03-rate-limiter-ruby/throttle.rb` | Ruby | throttles the partner API and the verify endpoint |
| 04 | `04-offer-search-ts/offerSearch.ts` | TypeScript | search-as-you-type controller on the Shop page |

Each has **more than one** problem, ranging from obvious to subtle. Aim to find at least two.

`_ANSWER_KEY.md` lists what's planted. **Don't open it until you've finished an exercise**: it's for checking yourself afterwards, not for help.

## The workflow (about 30 minutes per exercise)

1. **Read first (5 min).** Skim the file yourself. Then ask the model to explain what the code is *for* before asking it to change anything. Confirm or challenge its explanation in your own words. *Pasting the file in and asking "fix this" is a negative signal.*
2. **Find problems (8 min).** Ask for bugs, edge cases, and assumptions. Then **verify each claim yourself**: have the model write a tiny script that reproduces the bug, and run it. A claim you didn't reproduce isn't a finding.
3. **Fix (7 min).** Fix one problem at a time. Read every diff. Ask why when a change surprises you. Don't accept refactors you didn't ask for.
4. **Tests (8 min).** Have the model generate edge-case tests, then review them: do they test behavior or just the implementation? Do they fail on the original code and pass on the fix? Add the case it missed.
5. **Wrap up (2 min).** Summarize what the code does, what was wrong, what you changed, and what you'd still worry about.

Running tests without extra installs: JavaScript and TypeScript with `node --test`, Python with `python3 -m unittest`, Ruby with `ruby` + `minitest` (bundled with Ruby).

## Re-steering: practice this deliberately

Interviewers specifically watch how you correct the model. Weak: "that's wrong, try again". Strong: specific, with context.

- *"Your fix changes the public return shape. Callers rely on `reason` being one of these five strings. Keep the shape and only change the comparison."*
- *"These tests only check the happy path. Add cases for: the member's group being first in the list, a cart total that produces a fractional discount, and an expiry date checked in a US timezone."*
- *"You said this is thread-safe. It's called from multiple Puma threads. Walk through two requests incrementing the same counter at once."*
- *"Don't rewrite the file. Show me the smallest diff that fixes only the out-of-order responses."*

When the model is confidently wrong, say what evidence would settle it ("write a script that shows the third use succeeding") instead of arguing.

## Your two stories

They'll ask how AI has changed the way you work, with real examples. Prepare both in this shape: **situation → what you asked the AI → what you checked or corrected → outcome (numbers if you have them) → what you learned.**

1. **AI saved real work.** Candidates from this practice: generating mock data and test cases you would have skipped, reproducing a race condition with a script, explaining unfamiliar code before changing it.
2. **AI was the wrong tool.** For example: it confidently produced a plausible but wrong fix; the problem needed context the model didn't have (business rules, production data); or reading the code yourself was faster. Say how you noticed.

Have one more ready: **how you verify AI output** (tests that fail first, running things yourself, reading every diff, never trusting claims you haven't reproduced).
