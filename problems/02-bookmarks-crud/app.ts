/**
 * Bookmarks CRUD API (Fastify + zod)
 *
 * Rebuild a REST API using a framework, and see what it handles compared
 * with problem 01. Focus on request validation and a consistent error shape.
 *
 * Bookmark: { id: string, url: string, title: string, tags: string[],
 *             createdAt: string, updatedAt: string }
 *
 * Requirements:
 * 1. POST /bookmarks { url, title, tags? } -> 201 bookmark
 *    - url: a valid http(s) URL
 *    - title: 1-200 chars after trim (store the trimmed value)
 *    - tags: optional, default [], max 5, each 1-30 chars, stored lowercased
 *      and de-duplicated
 *    - 409 if a bookmark with the same url already exists
 * 2. GET /bookmarks -> 200 array, newest first.
 *    Optional ?tag=foo filters to bookmarks with that tag (case-insensitive).
 * 3. GET /bookmarks/:id -> 200 or 404
 * 4. PATCH /bookmarks/:id -> partial update of url/title/tags with the same
 *    rules. Unknown fields -> 400. Empty body {} -> 400. Bumps updatedAt.
 *    Changing url to one another bookmark uses -> 409.
 * 5. DELETE /bookmarks/:id -> 204 or 404
 * 6. Every error uses one shape:
 *      { error: { code: string, message: string, details?: unknown } }
 *    with codes VALIDATION_ERROR (400), NOT_FOUND (404), CONFLICT (409).
 *    Hint: Fastify's setErrorHandler / setNotFoundHandler, plus a custom
 *    error class you throw from handlers.
 * 7. Each buildApp() call gets its own in-memory store.
 *
 * Concepts:
 * - Schema validation at the boundary (zod's safeParse, .strict()).
 * - Centralized error handling instead of per-route try/catch.
 * - PUT vs PATCH semantics.
 * - Testing with app.inject() (no real network).
 *
 * Run tests: node --test problems/02-bookmarks-crud/*.test.ts
 * Time target: 60 minutes.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

export const buildApp = (): FastifyInstance => {
  const app = Fastify();

  // TODO: implement

  return app;
};

if (import.meta.main) {
  buildApp().listen({ port: 3000 }).then((addr) => console.log(`listening on ${addr}`));
}
