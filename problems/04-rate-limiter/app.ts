/**
 * Rate Limiter, Part A (continued): protect an identity-verification API
 *
 * Put your limiters from limiter.ts in front of a fake identity-verification
 * endpoint. Verification is expensive (it calls a paid third-party check)
 * and is a target for abuse (guessing document numbers), so there are TWO
 * limits.
 *
 * Endpoint: POST /verifications
 *   header  x-api-key: <client key>          (identifies the calling business)
 *   body    { documentNumber: string, name: string }
 *   -> 201 { id: string, status: "pending" }
 *
 * Requirements:
 * 1. Missing x-api-key -> 401 { error }. Invalid body (zod: documentNumber
 *    1-40 chars, name 1-200 chars) -> 400 { error }.
 * 2. Per-API-key limit: TokenBucketLimiter, capacity 10, refill 1 per second
 *    (clients may burst to 10, average 1/s).
 * 3. Per-document limit: SlidingWindowLimiter, 3 attempts per 10 minutes for
 *    the same documentNumber, ACROSS all API keys (stops one person being
 *    checked over and over by different clients).
 * 4. Over either limit -> 429 { error } with a Retry-After header in whole
 *    SECONDS, rounded up (never 0).
 * 5. Order matters: check the API-key limit first. A request rejected by the
 *    API-key limit must NOT use up one of the document's 3 attempts.
 *    Requests that fail validation (400/401) use up neither limit.
 * 6. Every 201 includes X-RateLimit-Remaining with the API key's remaining
 *    tokens.
 * 7. buildApp({ now }) passes the clock through to both limiters.
 *
 * Questions to answer in a comment once you're done:
 * - A request passes the API-key limit, then fails the document limit. It
 *   has used one API-key token. Is that acceptable? What would it take to
 *   avoid it?
 * - Where should limits be enforced with 20 app servers behind a load
 *   balancer? (In-memory limiters per server let each client do 20x.)
 * - Should the document limit key on the raw document number? (Think
 *   about logging and storing personal data.)
 *
 * Run tests: node --test problems/04-rate-limiter/app.test.ts
 * Time target: 30 minutes.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { type Clock } from "./limiter.ts";

export const buildApp = ({ now = Date.now }: { now?: Clock } = {}): FastifyInstance => {
  const app = Fastify();

  // TODO: implement
  void now;

  return app;
};

if (import.meta.main) {
  buildApp().listen({ port: 3000 }).then((addr) => console.log(`listening on ${addr}`));
}
