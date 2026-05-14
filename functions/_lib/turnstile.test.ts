import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile';

const mkFetch = (responseBody: object, status = 200) =>
  vi.fn(async () =>
    new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;

describe('verifyTurnstileToken', () => {
  it('returns ok when siteverify says success', async () => {
    const fetchImpl = mkFetch({ success: true });
    const r = await verifyTurnstileToken('token', 'secret', '1.2.3.4', fetchImpl);
    expect(r.ok).toBe(true);
  });

  it('returns errors when siteverify says failure', async () => {
    const fetchImpl = mkFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    const r = await verifyTurnstileToken('token', 'secret', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('invalid-input-response');
  });

  it('rejects empty token', async () => {
    const fetchImpl = mkFetch({});
    const r = await verifyTurnstileToken('', 'secret', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('missing-input');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects empty secret', async () => {
    const fetchImpl = mkFetch({});
    const r = await verifyTurnstileToken('token', '', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('missing-input');
  });

  it('handles non-2xx response from siteverify', async () => {
    const fetchImpl = mkFetch({}, 503);
    const r = await verifyTurnstileToken('token', 'secret', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.errors?.[0]).toMatch(/siteverify-status-503/);
  });

  it('handles network errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const r = await verifyTurnstileToken('token', 'secret', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.errors?.[0]).toBe('network-error');
  });

  it('includes remoteip in the POST body when provided', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = init.body as URLSearchParams;
      expect(body.get('remoteip')).toBe('1.2.3.4');
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;
    await verifyTurnstileToken('token', 'secret', '1.2.3.4', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
