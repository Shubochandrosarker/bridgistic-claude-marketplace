/**
 * Best-effort fixed-window rate limiter backed by the OAUTH_KV namespace
 * the Worker already requires, so no new binding is needed.
 *
 * KV has no atomic increment, so this is read-then-write and can slightly
 * undercount two requests that race inside the same window - that's an
 * accepted tradeoff for blunting abuse (a hammering token or a scripted
 * /authorize flood), not a precise quota system.
 */

const WINDOW_SECONDS = 60;

export async function isRateLimited(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds = WINDOW_SECONDS
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const bucketKey = `ratelimit:${key}:${bucket}`;
  const current = Number((await kv.get(bucketKey)) ?? "0");
  if (current >= limit) {
    return true;
  }
  // TTL covers this window plus the next, so a slow write near the window
  // boundary can't leave a bucket permanently uncounted.
  await kv.put(bucketKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return false;
}
