import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.ts";

const setup = () => {
  let t = 1_000_000;
  const app = buildApp({ now: () => t });
  const verify = (key: string | null, documentNumber = "D-1", name = "Ada Lovelace") =>
    app.inject({
      method: "POST",
      url: "/verifications",
      headers: key === null ? {} : { "x-api-key": key },
      payload: { documentNumber, name },
    });
  return { app, verify, advance: (ms: number) => (t += ms) };
};

describe("validation", () => {
  test("missing api key -> 401", async () => {
    const { verify } = setup();
    assert.equal((await verify(null)).statusCode, 401);
  });

  test("invalid body -> 400", async () => {
    const { app } = setup();
    const res = await app.inject({
      method: "POST",
      url: "/verifications",
      headers: { "x-api-key": "k1" },
      payload: { documentNumber: "", name: "x" },
    });
    assert.equal(res.statusCode, 400);
  });

  test("201 with pending status and X-RateLimit-Remaining", async () => {
    const { verify } = setup();
    const res = await verify("k1");
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().status, "pending");
    assert.equal(typeof res.json().id, "string");
    assert.equal(res.headers["x-ratelimit-remaining"], "9");
  });
});

describe("per-api-key token bucket", () => {
  test("burst of 10, then 429 with Retry-After in whole seconds", async () => {
    const { verify } = setup();
    for (let i = 0; i < 10; i++) {
      assert.equal((await verify("k1", `D-${i}`)).statusCode, 201);
    }
    const res = await verify("k1", "D-99");
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers["retry-after"], "1");
  });

  test("refills at 1 per second", async () => {
    const { verify, advance } = setup();
    for (let i = 0; i < 10; i++) await verify("k1", `D-${i}`);
    advance(1000);
    assert.equal((await verify("k1", "D-50")).statusCode, 201);
    assert.equal((await verify("k1", "D-51")).statusCode, 429);
  });

  test("different api keys have separate buckets", async () => {
    const { verify } = setup();
    for (let i = 0; i < 10; i++) await verify("k1", `D-${i}`);
    assert.equal((await verify("k2", "D-77")).statusCode, 201);
  });
});

describe("per-document sliding window", () => {
  test("3 attempts per 10 minutes across all api keys", async () => {
    const { verify } = setup();
    assert.equal((await verify("k1", "D-7")).statusCode, 201);
    assert.equal((await verify("k2", "D-7")).statusCode, 201);
    assert.equal((await verify("k3", "D-7")).statusCode, 201);
    const res = await verify("k4", "D-7");
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers["retry-after"], "600");
  });

  test("window reopens after 10 minutes", async () => {
    const { verify, advance } = setup();
    for (const k of ["k1", "k2", "k3"]) await verify(k, "D-7");
    advance(10 * 60_000);
    assert.equal((await verify("k4", "D-7")).statusCode, 201);
  });

  test("Retry-After is rounded up, never 0", async () => {
    const { verify, advance } = setup();
    for (const k of ["k1", "k2", "k3"]) await verify(k, "D-7");
    advance(10 * 60_000 - 1); // 1ms left
    assert.equal((await verify("k4", "D-7")).headers["retry-after"], "1");
  });

  test("api-key rejection does not use a document attempt", async () => {
    const { verify } = setup();
    for (let i = 0; i < 10; i++) await verify("k1", `B-${i}`); // k1 bucket empty
    for (let i = 0; i < 5; i++) {
      assert.equal((await verify("k1", "D-7")).statusCode, 429); // rejected by key limit
    }
    for (const k of ["k2", "k3", "k4"]) {
      assert.equal((await verify(k, "D-7")).statusCode, 201, "D-7 should still have 3 attempts");
    }
  });

  test("validation failures use neither limit", async () => {
    const { app, verify } = setup();
    for (let i = 0; i < 20; i++) {
      await app.inject({
        method: "POST",
        url: "/verifications",
        headers: { "x-api-key": "k1" },
        payload: { documentNumber: "D-7" }, // missing name -> 400
      });
    }
    assert.equal((await verify("k1", "D-7")).headers["x-ratelimit-remaining"], "9");
  });
});
