/**
 * Offset vs Cursor Pagination
 *
 * Implement both pagination styles over the same dataset, then prove why
 * cursor pagination is stable when new rows arrive between page loads.
 * (This is the server side of the infinite scroll feed from the frontend repo.)
 *
 * Data: seedPosts() gives posts with { id: number, title, createdAt: string }.
 * Several posts share the same createdAt, so sort order needs a tiebreaker.
 * Sort order everywhere: createdAt DESC, then id DESC.
 *
 * Requirements:
 * 1. GET /posts/offset?limit=20&offset=0
 *    -> 200 { items: Post[], total: number }
 * 2. GET /posts/cursor?limit=20&cursor=<opaque string>
 *    -> 200 { items: Post[], nextCursor: string | null }
 *    - No cursor = first page. nextCursor is null on the last page.
 *    - The cursor is opaque to clients: encode the sort key of the last
 *      item (createdAt + id), e.g. base64url JSON. Do NOT encode an offset.
 *    - Malformed cursor -> 400 { error }
 * 3. limit: default 20, integer 1..100, otherwise 400. offset: integer >= 0.
 * 4. POST /posts { title } -> 201, a new post with createdAt = now and the
 *    next id (so it lands at the top of the feed).
 * 5. buildApp({ seedCount }) seeds that many posts (default 250).
 *
 * Questions to answer in a comment once you're done:
 * - A post is inserted after the client loads page 1. What does each style
 *   return for page 2? (The tests check this.)
 * - What is the cost of `OFFSET 100000` in a real database vs a cursor
 *   `WHERE (created_at, id) < ($1, $2)` with an index?
 * - What can offset pagination do that cursor pagination can't easily do?
 *
 * Run tests: node --test problems/03-pagination/*.test.ts
 * Time target: 45 minutes.
 */

import Fastify, { type FastifyInstance } from "fastify";

export type Post = { id: number; title: string; createdAt: string };

// Provided: three posts per timestamp, so createdAt alone is not unique.
export const seedPosts = (count: number): Post[] => {
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Post ${i + 1}`,
    createdAt: new Date(start + Math.floor(i / 3) * 60_000).toISOString(),
  }));
};

export const buildApp = ({ seedCount = 250 }: { seedCount?: number } = {}): FastifyInstance => {
  const app = Fastify();
  const posts = seedPosts(seedCount);

  // TODO: implement

  return app;
};

if (import.meta.main) {
  buildApp().listen({ port: 3000 }).then((addr) => console.log(`listening on ${addr}`));
}
