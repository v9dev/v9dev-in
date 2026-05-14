import { describe, it, expect } from 'vitest';
import { checkRateLimit, hashIp, type RateLimitStore } from './rate-limit';

function fakeStore(): RateLimitStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(k) {
      return data.get(k) ?? null;
    },
    async put(k, v) {
      data.set(k, v);
    },
  };
}

describe('checkRateLimit', () => {
  it('allows the first request and decrements remaining', async () => {
    const store = fakeStore();
    const r = await checkRateLimit('abc', store, { max: 3 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(2);
    expect(store.data.get('rl:abc')).toBe('1');
  });

  it('counts up across requests within the same window', async () => {
    const store = fakeStore();
    await checkRateLimit('abc', store, { max: 3 });
    await checkRateLimit('abc', store, { max: 3 });
    const third = await checkRateLimit('abc', store, { max: 3 });
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    expect(store.data.get('rl:abc')).toBe('3');
  });

  it('rejects once max is reached', async () => {
    const store = fakeStore();
    await checkRateLimit('abc', store, { max: 2 });
    await checkRateLimit('abc', store, { max: 2 });
    const third = await checkRateLimit('abc', store, { max: 2 });
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    // Did not increment past max.
    expect(store.data.get('rl:abc')).toBe('2');
  });

  it('tracks different ip hashes independently', async () => {
    const store = fakeStore();
    await checkRateLimit('abc', store, { max: 1 });
    const otherIp = await checkRateLimit('def', store, { max: 1 });
    expect(otherIp.ok).toBe(true);
  });

  it('recovers from a corrupt KV value by re-seeding', async () => {
    const store = fakeStore();
    store.data.set('rl:abc', 'not-a-number');
    const r = await checkRateLimit('abc', store, { max: 2 });
    expect(r.ok).toBe(true);
    expect(store.data.get('rl:abc')).toBe('1');
  });
});

describe('hashIp', () => {
  it('returns a 24-char hex string', async () => {
    const h = await hashIp('1.2.3.4', 'salt');
    expect(h).toMatch(/^[a-f0-9]{24}$/);
  });

  it('is deterministic for the same (ip, salt)', async () => {
    const a = await hashIp('1.2.3.4', 'salt');
    const b = await hashIp('1.2.3.4', 'salt');
    expect(a).toBe(b);
  });

  it('differs when salt differs', async () => {
    const a = await hashIp('1.2.3.4', 'salt-a');
    const b = await hashIp('1.2.3.4', 'salt-b');
    expect(a).not.toBe(b);
  });

  it('differs when ip differs', async () => {
    const a = await hashIp('1.2.3.4', 'salt');
    const b = await hashIp('1.2.3.5', 'salt');
    expect(a).not.toBe(b);
  });
});
