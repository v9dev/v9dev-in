import { describe, it, expect } from 'vitest';
import { validateContactPayload } from './validate';

const goodPayload = {
  name: 'JP Singh',
  email: 'jp@example.com',
  message: 'Hey JP — quick chat about a Kubernetes platform we want shipped.',
  turnstileToken: 'cf-token-xyz',
};

describe('validateContactPayload', () => {
  it('accepts a well-formed payload', () => {
    const r = validateContactPayload(goodPayload);
    expect(r.ok).toBe(true);
    expect(r.data?.name).toBe('JP Singh');
  });

  it('rejects when name is empty', () => {
    const r = validateContactPayload({ ...goodPayload, name: '' });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe('name');
  });

  it('rejects when name exceeds 80 chars', () => {
    const r = validateContactPayload({ ...goodPayload, name: 'a'.repeat(81) });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe('name');
  });

  it('rejects malformed email', () => {
    const r = validateContactPayload({ ...goodPayload, email: 'not-an-email' });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe('email');
  });

  it('rejects message shorter than 10 chars', () => {
    const r = validateContactPayload({ ...goodPayload, message: 'hi' });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe('message');
  });

  it('rejects message longer than 2000 chars', () => {
    const r = validateContactPayload({ ...goodPayload, message: 'x'.repeat(2001) });
    expect(r.ok).toBe(false);
  });

  it('rejects missing turnstile token', () => {
    const r = validateContactPayload({ ...goodPayload, turnstileToken: '' });
    expect(r.ok).toBe(false);
    expect(r.issues?.[0].field).toBe('turnstileToken');
  });

  it('trims whitespace from name, email, and message', () => {
    const r = validateContactPayload({
      ...goodPayload,
      name: '  JP Singh  ',
      email: '  jp@example.com  ',
      message: '  ' + goodPayload.message + '  ',
    });
    expect(r.ok).toBe(true);
    expect(r.data?.name).toBe('JP Singh');
    expect(r.data?.email).toBe('jp@example.com');
  });

  it('returns issues array for completely garbage input', () => {
    const r = validateContactPayload({});
    expect(r.ok).toBe(false);
    expect(r.issues?.length).toBeGreaterThan(0);
  });
});
