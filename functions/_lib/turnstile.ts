/**
 * Verifies a Cloudflare Turnstile token by calling siteverify.
 *
 * Cloudflare ships well-known test keys that always pass or fail
 * (https://developers.cloudflare.com/turnstile/troubleshooting/testing/) -
 * we use one of those in .dev.vars for local dev.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  ok: boolean;
  /** Cloudflare error codes when ok=false; useful for logs. */
  errors?: string[];
}

export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!token || !secret) {
    return { ok: false, errors: ['missing-input'] };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) {
      return { ok: false, errors: [`siteverify-status-${res.status}`] };
    }
    const json = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    return json.success
      ? { ok: true }
      : { ok: false, errors: json['error-codes'] ?? ['unknown'] };
  } catch (e) {
    return { ok: false, errors: ['network-error', String(e)] };
  }
}
