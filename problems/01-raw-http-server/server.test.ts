import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createServer } from "./server.ts";

let server: http.Server;
let base: string;

before(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const postNote = (body: unknown) =>
  fetch(`${base}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("health", () => {
  test("GET /health returns ok", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), { status: "ok" });
  });
});

describe("notes", () => {
  test("POST /notes creates a note", async () => {
    const res = await postNote({ text: "hello" });
    assert.equal(res.status, 201);
    const note = await res.json();
    assert.equal(note.text, "hello");
    assert.equal(typeof note.id, "string");
    assert.ok(!Number.isNaN(Date.parse(note.createdAt)), "createdAt is an ISO date");
  });

  test("GET /notes lists notes oldest first", async () => {
    await postNote({ text: "second" });
    const res = await fetch(`${base}/notes`);
    assert.equal(res.status, 200);
    const notes = await res.json();
    assert.ok(Array.isArray(notes));
    const texts = notes.map((n: { text: string }) => n.text);
    assert.ok(texts.indexOf("hello") < texts.indexOf("second"));
  });

  test("GET /notes/:id returns one note, 404 when missing", async () => {
    const created = await (await postNote({ text: "find me" })).json();
    const res = await fetch(`${base}/notes/${created.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), created);

    const missing = await fetch(`${base}/notes/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.ok((await missing.json()).error);
  });

  test("DELETE /notes/:id returns 204, then 404", async () => {
    const created = await (await postNote({ text: "delete me" })).json();
    const res = await fetch(`${base}/notes/${created.id}`, { method: "DELETE" });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");

    const again = await fetch(`${base}/notes/${created.id}`, { method: "DELETE" });
    assert.equal(again.status, 404);
  });
});

describe("validation", () => {
  test("invalid JSON -> 400", async () => {
    const res = await postNote("{not json");
    assert.equal(res.status, 400);
    assert.ok((await res.json()).error);
  });

  for (const body of [{}, { text: 42 }, { text: "   " }]) {
    test(`bad text ${JSON.stringify(body)} -> 400`, async () => {
      const res = await postNote(body);
      assert.equal(res.status, 400);
      assert.ok((await res.json()).error);
    });
  }

  test("body over 1 MB -> 413", async () => {
    const res = await postNote({ text: "x".repeat(1024 * 1024 + 1) });
    assert.equal(res.status, 413);
  });
});

describe("routing", () => {
  test("unknown path -> 404", async () => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error);
  });

  test("wrong method -> 405 with Allow header", async () => {
    const res = await fetch(`${base}/notes`, { method: "PUT" });
    assert.equal(res.status, 405);
    const allow = res.headers.get("allow") ?? "";
    assert.match(allow, /GET/);
    assert.match(allow, /POST/);
  });

  test("separate servers have separate stores", async (t) => {
    const other = createServer();
    t.after(() => {
      other.closeAllConnections();
      other.close();
    });
    await new Promise<void>((resolve) => other.listen(0, resolve));
    const port = (other.address() as AddressInfo).port;
    const notes = await (await fetch(`http://localhost:${port}/notes`)).json();
    assert.deepEqual(notes, []);
  });
});
