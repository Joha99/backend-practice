import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildApp, type Post } from "./app.ts";

const byFeedOrder = (a: Post, b: Post) =>
  b.createdAt.localeCompare(a.createdAt) || b.id - a.id;

describe("offset", () => {
  test("first page and total", async () => {
    const app = buildApp();
    const res = await app.inject({ url: "/posts/offset?limit=10" });
    assert.equal(res.statusCode, 200);
    const { items, total } = res.json();
    assert.equal(total, 250);
    assert.equal(items.length, 10);
    assert.deepEqual(items, [...items].sort(byFeedOrder));
    assert.equal(items[0].id, 250);
  });

  test("default limit is 20", async () => {
    const { items } = (await buildApp().inject({ url: "/posts/offset" })).json();
    assert.equal(items.length, 20);
  });

  test("offset past the end -> empty items", async () => {
    const { items } = (await buildApp().inject({ url: "/posts/offset?offset=1000" })).json();
    assert.deepEqual(items, []);
  });
});

describe("cursor", () => {
  test("walking every page returns each post exactly once, in order", async () => {
    const app = buildApp();
    const seen: Post[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const qs: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const res = await app.inject({ url: `/posts/cursor?limit=7${qs}` });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      seen.push(...body.items);
      cursor = body.nextCursor;
      pages++;
      assert.ok(pages < 100, "pagination never ended");
    } while (cursor);

    assert.equal(seen.length, 250);
    assert.equal(new Set(seen.map((p) => p.id)).size, 250);
    assert.deepEqual(seen, [...seen].sort(byFeedOrder));
  });

  test("nextCursor is null on the last page", async () => {
    const { items, nextCursor } = (await buildApp({ seedCount: 5 }).inject({ url: "/posts/cursor?limit=10" })).json();
    assert.equal(items.length, 5);
    assert.equal(nextCursor, null);
  });

  test("cursor does not expose a plain offset", async () => {
    const { nextCursor } = (await buildApp().inject({ url: "/posts/cursor?limit=20" })).json();
    assert.notEqual(nextCursor, "20");
  });

  test("malformed cursor -> 400", async () => {
    const res = await buildApp().inject({ url: "/posts/cursor?cursor=garbage!!" });
    assert.equal(res.statusCode, 400);
  });
});

describe("validation", () => {
  for (const q of ["limit=0", "limit=101", "limit=abc", "limit=2.5", "offset=-1"]) {
    test(`offset endpoint rejects ${q}`, async () => {
      assert.equal((await buildApp().inject({ url: `/posts/offset?${q}` })).statusCode, 400);
    });
  }
  test("cursor endpoint rejects bad limit", async () => {
    assert.equal((await buildApp().inject({ url: "/posts/cursor?limit=0" })).statusCode, 400);
  });
});

describe("insert between page loads", () => {
  test("offset pagination shows a duplicate on page 2", async () => {
    const app = buildApp();
    const page1 = (await app.inject({ url: "/posts/offset?limit=10&offset=0" })).json().items;
    const created = await app.inject({ method: "POST", url: "/posts", payload: { title: "breaking news" } });
    assert.equal(created.statusCode, 201);
    const page2 = (await app.inject({ url: "/posts/offset?limit=10&offset=10" })).json().items;
    assert.equal(page2[0].id, page1[9].id, "last item of page 1 is shifted onto page 2");
  });

  test("cursor pagination continues cleanly", async () => {
    const app = buildApp();
    const first = (await app.inject({ url: "/posts/cursor?limit=10" })).json();
    await app.inject({ method: "POST", url: "/posts", payload: { title: "breaking news" } });
    const second = (
      await app.inject({ url: `/posts/cursor?limit=10&cursor=${encodeURIComponent(first.nextCursor)}` })
    ).json();
    const ids1 = new Set(first.items.map((p: Post) => p.id));
    assert.ok(second.items.every((p: Post) => !ids1.has(p.id)), "no duplicates");
    assert.equal(second.items[0].id, first.items[9].id - 1, "no skipped items");
  });

  test("new post appears at the top", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/posts", payload: { title: "newest" } });
    const { items } = (await app.inject({ url: "/posts/cursor?limit=1" })).json();
    assert.equal(items[0].title, "newest");
    assert.equal(items[0].id, 251);
  });
});
