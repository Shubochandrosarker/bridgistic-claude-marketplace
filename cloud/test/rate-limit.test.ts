/**
 * Tests for src/rate-limit.ts - the KV-backed fixed-window limiter used to
 * blunt abuse of /mcp and the OAuth handshake routes.
 *
 * Run: npx tsx --test test/rate-limit.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited } from "../src/rate-limit.js";

/** Minimal in-memory stand-in for the two KVNamespace methods this module uses. */
class FakeKv {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }
}

describe("rate-limit: isRateLimited", () => {
  test("allows requests under the limit", async () => {
    const kv = new FakeKv() as unknown as KVNamespace;
    for (let i = 0; i < 5; i++) {
      assert.equal(await isRateLimited(kv, "1.2.3.4:mcp", 5), false);
    }
  });

  test("blocks once the limit is reached within the window", async () => {
    const kv = new FakeKv() as unknown as KVNamespace;
    for (let i = 0; i < 5; i++) {
      await isRateLimited(kv, "1.2.3.4:mcp", 5);
    }
    assert.equal(await isRateLimited(kv, "1.2.3.4:mcp", 5), true);
  });

  test("tracks separate keys independently", async () => {
    const kv = new FakeKv() as unknown as KVNamespace;
    for (let i = 0; i < 5; i++) {
      await isRateLimited(kv, "1.2.3.4:mcp", 5);
    }
    // A different IP (or a different route bucket for the same IP) has its
    // own counter and isn't affected by the first key's exhaustion.
    assert.equal(await isRateLimited(kv, "5.6.7.8:mcp", 5), false);
    assert.equal(await isRateLimited(kv, "1.2.3.4:auth", 5), false);
  });

  test("a limit of 0 blocks immediately", async () => {
    const kv = new FakeKv() as unknown as KVNamespace;
    assert.equal(await isRateLimited(kv, "1.2.3.4:mcp", 0), true);
  });
});
