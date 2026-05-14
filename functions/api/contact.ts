/**
 * POST /api/contact
 *
 * Flow:
 *   1. Parse + validate JSON body.
 *   2. Verify Cloudflare Turnstile token.
 *   3. Rate-limit per hashed IP (5 / hour).
 *   4. Send email via Resend.
 *   5. Persist message to KV (90-day TTL) as a backup.
 */

import { validateContactPayload } from '../_lib/validate';
import { verifyTurnstileToken } from '../_lib/turnstile';
import { checkRateLimit, hashIp } from '../_lib/rate-limit';
import { sendEmail } from '../_lib/resend';
import { nanoid } from 'nanoid';

interface Env {
  CONTACT_MESSAGES: KVNamespace;
  RATE_LIMIT: KVNamespace;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  IP_HASH_SALT: string;
  CONTACT_FROM_EMAIL: string;
  CONTACT_TO_EMAIL: string;
}

type ErrorCode = 'ValidationError' | 'TurnstileFailed' | 'RateLimited' | 'ResendFailed' | 'BadJSON';

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(error: ErrorCode, status: number, message?: string) {
  return jsonResponse({ error, message }, status);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // 1. Body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('BadJSON', 400, 'Body must be JSON');
  }

  // 2. Validate
  const validation = validateContactPayload(body);
  if (!validation.ok || !validation.data) {
    return errorResponse('ValidationError', 400, validation.message);
  }
  const { name, email, message, turnstileToken } = validation.data;

  // 3. Turnstile
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const turnstile = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
  if (!turnstile.ok) {
    return errorResponse('TurnstileFailed', 400, 'Spam check failed');
  }

  // 4. Rate limit (5 / hour per hashed IP)
  const ipKey = await hashIp(ip, env.IP_HASH_SALT);
  const rate = await checkRateLimit(ipKey, env.RATE_LIMIT, { max: 5, windowSeconds: 3600 });
  if (!rate.ok) {
    return errorResponse('RateLimited', 429, 'Too many messages — try again later');
  }

  // 5. Email
  const subject = `[v9dev.in] New message from ${name}`;
  const text = [
    `From: ${name} <${email}>`,
    `IP: ${ip}`,
    '',
    message,
  ].join('\n');
  const html = `
    <div style="font-family:ui-sans-serif,system-ui;line-height:1.5">
      <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
      <hr/>
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
    </div>
  `;

  const send = await sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.CONTACT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL,
    subject,
    text,
    html,
    replyTo: email,
  });

  // 6. KV backup (best-effort; failure is non-fatal because we already sent)
  const recordId = nanoid(12);
  try {
    await env.CONTACT_MESSAGES.put(
      `msg:${recordId}`,
      JSON.stringify({
        id: recordId,
        receivedAt: new Date().toISOString(),
        name,
        email,
        message,
        ip,
        delivery: send,
      }),
      { expirationTtl: 60 * 60 * 24 * 90 }, // 90 days
    );
  } catch {
    // Swallow — Resend already accepted (or rejected) the send.
  }

  if (!send.ok) {
    return errorResponse('ResendFailed', 502, 'Mail server hiccup');
  }
  return jsonResponse({ ok: true, id: recordId }, 200);
};

// Method-not-allowed for everything else
export const onRequest: PagesFunction = async () =>
  new Response('Method Not Allowed', {
    status: 405,
    headers: { allow: 'POST' },
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
