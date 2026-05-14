import { describe, it, expect, vi } from 'vitest';
import { sendEmail } from './resend';

const baseInput = {
  apiKey: 'key',
  from: 'hello@v9dev.in',
  to: 'jp@v9dev.in',
  subject: 'Hi',
  text: 'A message body.',
};

describe('sendEmail', () => {
  it('returns ok with id on 200', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'em_123' }), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await sendEmail(baseInput, fetchImpl);
    expect(r.ok).toBe(true);
    expect(r.id).toBe('em_123');
  });

  it('sends the bearer token in the Authorization header', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).authorization;
      expect(auth).toBe('Bearer key');
      return new Response(JSON.stringify({ id: 'em_1' }));
    }) as unknown as typeof fetch;
    await sendEmail(baseInput, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('passes reply_to when replyTo is given', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.reply_to).toBe('sender@example.com');
      return new Response(JSON.stringify({ id: 'em_1' }));
    }) as unknown as typeof fetch;
    await sendEmail({ ...baseInput, replyTo: 'sender@example.com' }, fetchImpl);
  });

  it('returns failure on non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('rate limited', { status: 429 }),
    ) as unknown as typeof fetch;
    const r = await sendEmail(baseInput, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/resend-429/);
  });

  it('fails fast when apiKey missing', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await sendEmail({ ...baseInput, apiKey: '' }, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('missing-api-key');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const r = await sendEmail(baseInput, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/network/);
  });
});
