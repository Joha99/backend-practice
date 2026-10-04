/**
 * Raw HTTP Server (no framework)
 *
 * Build a tiny JSON notes API using only `node:http`. The point is to see
 * what frameworks do for you: routing, body parsing, status codes, headers.
 *
 * Requirements:
 * 1. GET /health -> 200 { status: "ok" }
 * 2. GET /notes -> 200 array of all notes (oldest first).
 * 3. POST /notes with JSON body { text: string }
 *    - 201 with the created note: { id: string, text: string, createdAt: string (ISO) }
 *    - 400 { error } if the body is not valid JSON
 *    - 400 { error } if `text` is missing, not a string, or blank after trim
 *    - 413 { error } if the body is larger than 1 MB (stop reading once exceeded)
 * 4. GET /notes/:id -> 200 note, or 404 { error }
 * 5. DELETE /notes/:id -> 204 with an empty body, or 404 { error }
 * 6. Unknown path -> 404 { error }
 * 7. Known path, wrong method (e.g. PUT /notes) -> 405 { error } with an
 *    `Allow` header listing the valid methods (e.g. "GET, POST").
 * 8. Every JSON response sets `Content-Type: application/json`.
 * 9. Each call to createServer() gets its own empty in-memory store.
 *
 * Concepts:
 * - The request body arrives as a stream of chunks ("data" / "end" events,
 *   or `for await (const chunk of req)`).
 * - Status codes: 200 vs 201 vs 204, 400 vs 404 vs 405 vs 413.
 * - URL parsing: `new URL(req.url, "http://localhost")`.
 * - crypto.randomUUID() for ids.
 *
 * Run tests: node --test problems/01-raw-http-server/*.test.ts
 * Time target: 45 minutes.
 */

import http from "node:http";

export const createServer = (): http.Server => {
  // TODO: implement

  return http.createServer((req, res) => {
    res.statusCode = 501;
    res.end();
  });
};

// Run directly for manual testing with curl: node problems/01-raw-http-server/server.ts
if (import.meta.main) {
  createServer().listen(3000, () => console.log("listening on http://localhost:3000"));
}
