import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.ts";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp();
});

const create = (payload: unknown) => app.inject({ method: "POST", url: "/bookmarks", payload: payload as object });

const assertError = (res: { statusCode: number; json: () => any }, status: number, code: string) => {
  assert.equal(res.statusCode, status);
  const body = res.json();
  assert.equal(body.error?.code, code);
  assert.equal(typeof body.error?.message, "string");
};

describe("create", () => {
  test("creates a bookmark with normalized fields", async () => {
    const res = await create({ url: "https://example.com", title: "  Example  ", tags: ["Dev", "dev", "Web"] });
    assert.equal(res.statusCode, 201);
    const b = res.json();
    assert.equal(b.title, "Example");
    assert.deepEqual([...b.tags].sort(), ["dev", "web"]);
    assert.equal(typeof b.id, "string");
    assert.equal(b.createdAt, b.updatedAt);
  });

  test("tags default to []", async () => {
    const res = await create({ url: "https://a.com", title: "A" });
    assert.deepEqual(res.json().tags, []);
  });

  const invalid: [string, unknown][] = [
    ["bad url", { url: "not a url", title: "x" }],
    ["non-http url", { url: "ftp://a.com", title: "x" }],
    ["blank title", { url: "https://a.com", title: "   " }],
    ["long title", { url: "https://a.com", title: "x".repeat(201) }],
    ["too many tags", { url: "https://a.com", title: "x", tags: ["a", "b", "c", "d", "e", "f"] }],
    ["long tag", { url: "https://a.com", title: "x", tags: ["x".repeat(31)] }],
    ["missing fields", {}],
  ];
  for (const [name, payload] of invalid) {
    test(`rejects ${name}`, async () => {
      assertError(await create(payload), 400, "VALIDATION_ERROR");
    });
  }

  test("duplicate url -> 409", async () => {
    await create({ url: "https://dup.com", title: "one" });
    assertError(await create({ url: "https://dup.com", title: "two" }), 409, "CONFLICT");
  });
});

describe("read", () => {
  test("lists newest first and filters by tag", async () => {
    await create({ url: "https://1.com", title: "one", tags: ["js"] });
    await new Promise((r) => setTimeout(r, 5));
    await create({ url: "https://2.com", title: "two", tags: ["go"] });
    await new Promise((r) => setTimeout(r, 5));
    await create({ url: "https://3.com", title: "three", tags: ["JS"] });

    const all = (await app.inject({ url: "/bookmarks" })).json();
    assert.deepEqual(all.map((b: any) => b.title), ["three", "two", "one"]);

    const js = (await app.inject({ url: "/bookmarks?tag=JS" })).json();
    assert.deepEqual(js.map((b: any) => b.title), ["three", "one"]);
  });

  test("get by id and 404", async () => {
    const created = (await create({ url: "https://a.com", title: "A" })).json();
    const res = await app.inject({ url: `/bookmarks/${created.id}` });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), created);
    assertError(await app.inject({ url: "/bookmarks/nope" }), 404, "NOT_FOUND");
  });

  test("unknown route uses the error shape", async () => {
    assertError(await app.inject({ url: "/nope" }), 404, "NOT_FOUND");
  });
});

describe("update", () => {
  test("partial update bumps updatedAt", async () => {
    const created = (await create({ url: "https://a.com", title: "A", tags: ["x"] })).json();
    await new Promise((r) => setTimeout(r, 5));
    const res = await app.inject({ method: "PATCH", url: `/bookmarks/${created.id}`, payload: { title: "B" } });
    assert.equal(res.statusCode, 200);
    const b = res.json();
    assert.equal(b.title, "B");
    assert.equal(b.url, "https://a.com");
    assert.deepEqual(b.tags, ["x"]);
    assert.ok(b.updatedAt > created.updatedAt);
  });

  test("rejects empty body, unknown fields, invalid values", async () => {
    const { id } = (await create({ url: "https://a.com", title: "A" })).json();
    for (const payload of [{}, { color: "red" }, { title: "" }]) {
      assertError(await app.inject({ method: "PATCH", url: `/bookmarks/${id}`, payload }), 400, "VALIDATION_ERROR");
    }
  });

  test("changing url to an existing one -> 409, same url is fine", async () => {
    await create({ url: "https://taken.com", title: "T" });
    const { id } = (await create({ url: "https://mine.com", title: "M" })).json();
    assertError(
      await app.inject({ method: "PATCH", url: `/bookmarks/${id}`, payload: { url: "https://taken.com" } }),
      409,
      "CONFLICT",
    );
    const same = await app.inject({ method: "PATCH", url: `/bookmarks/${id}`, payload: { url: "https://mine.com" } });
    assert.equal(same.statusCode, 200);
  });

  test("404 for missing id", async () => {
    assertError(await app.inject({ method: "PATCH", url: "/bookmarks/nope", payload: { title: "x" } }), 404, "NOT_FOUND");
  });
});

describe("delete", () => {
  test("204 then 404", async () => {
    const { id } = (await create({ url: "https://a.com", title: "A" })).json();
    const res = await app.inject({ method: "DELETE", url: `/bookmarks/${id}` });
    assert.equal(res.statusCode, 204);
    assertError(await app.inject({ method: "DELETE", url: `/bookmarks/${id}` }), 404, "NOT_FOUND");
  });

  test("url is free to reuse after delete", async () => {
    const { id } = (await create({ url: "https://a.com", title: "A" })).json();
    await app.inject({ method: "DELETE", url: `/bookmarks/${id}` });
    assert.equal((await create({ url: "https://a.com", title: "A again" })).statusCode, 201);
  });
});
