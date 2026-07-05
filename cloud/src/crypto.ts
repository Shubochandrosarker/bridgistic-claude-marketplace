/**
 * AES-256-GCM encrypt/decrypt for tenant credentials at rest in D1, keyed by
 * the TENANT_ENC_KEY Wrangler secret (32 raw bytes, base64-encoded).
 *
 * This is the single most security-sensitive file in this Worker: it is
 * what stands between "a leaked D1 export" and "every connected site's
 * Bridgistic key is exposed." Generate TENANT_ENC_KEY with:
 *   openssl rand -base64 32
 * and set it with `wrangler secret put TENANT_ENC_KEY` - never commit it,
 * never reuse it across environments.
 */

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("TENANT_ENC_KEY must decode to exactly 32 bytes (openssl rand -base64 32).");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Returns `${ivBase64}.${ciphertextBase64}` - store this whole string. */
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(stored: string, base64Key: string): Promise<string> {
  const [ivB64, ctB64] = stored.split(".");
  if (!ivB64 || !ctB64) {
    throw new Error("Malformed encrypted secret (expected ivBase64.ciphertextBase64).");
  }
  const key = await importKey(base64Key);
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ctB64);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
