/**
 * Minimal Resend client — POST /emails, that's it. We don't pull in the
 * official SDK because (a) we use a fraction of it and (b) it adds Node
 * polyfills to the Worker bundle.
 */

export interface SendEmailInput {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  /** Plain-text body. Resend will fall back to this when html is absent. */
  text: string;
  /** Optional rich HTML body. */
  html?: string;
  /** If set, reply-to is set to this address (the form submitter's email). */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend's email id when ok=true. */
  id?: string;
  /** Failure reason when ok=false. */
  error?: string;
}

const ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail(
  input: SendEmailInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SendEmailResult> {
  if (!input.apiKey) return { ok: false, error: 'missing-api-key' };
  if (!input.from || !input.to) return { ok: false, error: 'missing-addresses' };

  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `resend-${res.status}:${text.slice(0, 200)}` };
    }
    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, error: `network:${String(e).slice(0, 200)}` };
  }
}
