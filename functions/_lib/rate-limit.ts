/**
 * KV-backed sliding-window rate limit, keyed by hashed IP.
 *
 * One key per IP per hour. The KV value is the count; we set TTL to the
 * remaining window so the key auto-evicts. Cheap and good enough for a
 * contact form (we're not protecting a payment endpoint).
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/** Subset of KVNamespace we actually use - makes testing trivial. */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  resetIn: number;
}

export interface RateLimitOpts {
  /** Requests allowed per window. */
  max?: number;
  /** Window length in seconds. */
  windowSeconds?: number;
}

export async function checkRateLimit(
  ipHash: string,
  store: RateLimitStore | KVNamespace,
  { max = 5, windowSeconds = 60 * 60 }: RateLimitOpts = {},
): Promise<RateLimitResult> {
  const key = `rl:${ipHash}`;
  const raw = await store.get(key);
  const current = raw ? Number.parseInt(raw, 10) : 0;

  if (Number.isNaN(current)) {
    // Corrupt key; treat as empty and start over.
    await store.put(key, '1', { expirationTtl: windowSeconds });
    return { ok: true, remaining: max - 1, resetIn: windowSeconds };
  }

  if (current >= max) {
    return { ok: false, remaining: 0, resetIn: windowSeconds };
  }

  await store.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { ok: true, remaining: max - 1 - current, resetIn: windowSeconds };
}

/**
 * Salted SHA-256 hash of an IP - never store raw IPs in KV.
 * Uses Web Crypto (available in Workers + Node 20+).
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}
