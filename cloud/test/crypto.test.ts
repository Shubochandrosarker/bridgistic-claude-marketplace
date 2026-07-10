/**
 * Tests for src/crypto.ts - AES-256-GCM encrypt/decrypt of tenant secrets at
 * rest in D1. This is the single most security-sensitive file in the Worker
 * (see its own docblock and cloud/README.md's "Security notes"), so these
 * tests focus on the properties that actually matter for that role:
 * round-trip correctness, key-length validation, IV randomization, and
 * tamper detection (AES-GCM's authentication tag must reject any bit flip).
 *
 * Run: npx tsx --test test/crypto.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../src/crypto.js";

/** A valid 32-byte key, base64-encoded, the same way `openssl rand -base64 32` produces. */
function validKey(fill = 7): string {
  return Buffer.alloc(32, fill).toString("base64");
}

describe("crypto: encrypt/decrypt round trip", () => {
  test("decryptSecret(encryptSecret(x)) === x for ordinary text", async () => {
    const key = validKey();
    const stored = await encryptSecret("s_live_abc123_secret_value", key);
    const plain = await decryptSecret(stored, key);
    assert.equal(plain, "s_live_abc123_secret_value");
  });

  test("round trip preserves empty string", async () => {
    const key = validKey();
    const stored = await encryptSecret("", key);
    assert.equal(await decryptSecret(stored, key), "");
  });

  test("round trip preserves unicode / multi-byte content", async () => {
    const key = validKey();
    const plaintext = "clé secrète — 秘密鍵 🔐";
    const stored = await encryptSecret(plaintext, key);
    assert.equal(await decryptSecret(stored, key), plaintext);
  });

  test("round trip preserves long secrets", async () => {
    const key = validKey();
    const plaintext = "x".repeat(5000);
    const stored = await encryptSecret(plaintext, key);
    assert.equal(await decryptSecret(stored, key), plaintext);
  });

  test("stored format is ivBase64.ciphertextBase64", async () => {
    const key = validKey();
    const stored = await encryptSecret("hello", key);
    const parts = stored.split(".");
    assert.equal(parts.length, 2);
    assert.ok(parts[0].length > 0);
    assert.ok(parts[1].length > 0);
    // IV is 12 raw bytes -> 16 base64 chars (no padding needed for 12 bytes).
    assert.equal(Buffer.from(parts[0], "base64").length, 12);
  });
});

describe("crypto: TENANT_ENC_KEY length validation", () => {
  test("throws when key decodes to fewer than 32 bytes", async () => {
    const shortKey = Buffer.alloc(16, 1).toString("base64");
    await assert.rejects(() => encryptSecret("hello", shortKey), /32 bytes/);
  });

  test("throws when key decodes to more than 32 bytes", async () => {
    const longKey = Buffer.alloc(64, 1).toString("base64");
    await assert.rejects(() => encryptSecret("hello", longKey), /32 bytes/);
  });

  test("throws on empty key", async () => {
    await assert.rejects(() => encryptSecret("hello", ""), /32 bytes/);
  });

  test("decryptSecret also validates key length", async () => {
    const key = validKey();
    const stored = await encryptSecret("hello", key);
    const shortKey = Buffer.alloc(31, 1).toString("base64");
    await assert.rejects(() => decryptSecret(stored, shortKey), /32 bytes/);
  });
});

describe("crypto: IV randomization", () => {
  test("encrypting the same plaintext twice yields different ciphertext (random IV)", async () => {
    const key = validKey();
    const a = await encryptSecret("same plaintext", key);
    const b = await encryptSecret("same plaintext", key);
    assert.notEqual(a, b);
    // ...but both still decrypt back to the original value.
    assert.equal(await decryptSecret(a, key), "same plaintext");
    assert.equal(await decryptSecret(b, key), "same plaintext");
  });

  test("the IV portion differs across calls", async () => {
    const key = validKey();
    const a = (await encryptSecret("x", key)).split(".")[0];
    const b = (await encryptSecret("x", key)).split(".")[0];
    assert.notEqual(a, b);
  });
});

describe("crypto: tamper detection (AES-GCM auth tag)", () => {
  test("flipping a byte in the ciphertext fails to decrypt", async () => {
    const key = validKey();
    const stored = await encryptSecret("do not tamper with me", key);
    const [iv, ct] = stored.split(".");
    const bytes = Buffer.from(ct, "base64");
    bytes[0] ^= 0xff; // flip the first byte
    const tampered = `${iv}.${bytes.toString("base64")}`;
    await assert.rejects(() => decryptSecret(tampered, key));
  });

  test("flipping a byte in the IV fails to decrypt", async () => {
    const key = validKey();
    const stored = await encryptSecret("do not tamper with me", key);
    const [iv, ct] = stored.split(".");
    const bytes = Buffer.from(iv, "base64");
    bytes[0] ^= 0xff;
    const tampered = `${bytes.toString("base64")}.${ct}`;
    await assert.rejects(() => decryptSecret(tampered, key));
  });

  test("truncated ciphertext (missing auth tag bytes) fails to decrypt", async () => {
    const key = validKey();
    const stored = await encryptSecret("do not tamper with me", key);
    const [iv, ct] = stored.split(".");
    const bytes = Buffer.from(ct, "base64");
    const truncated = `${iv}.${bytes.subarray(0, bytes.length - 4).toString("base64")}`;
    await assert.rejects(() => decryptSecret(truncated, key));
  });

  test("decrypting with the wrong key fails", async () => {
    const stored = await encryptSecret("secret", validKey(1));
    await assert.rejects(() => decryptSecret(stored, validKey(2)));
  });

  test("malformed stored value (no separator) is rejected before touching crypto.subtle", async () => {
    await assert.rejects(() => decryptSecret("not-a-valid-stored-secret", validKey()), /Malformed encrypted secret/);
  });

  test("malformed stored value (empty ciphertext half) is rejected", async () => {
    await assert.rejects(() => decryptSecret("aGVsbG8=.", validKey()), /Malformed encrypted secret/);
  });
});
