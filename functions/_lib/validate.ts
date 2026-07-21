import { z } from 'zod';

/**
 * Payload schema for POST /api/contact.
 * Kept tight: name 1–80, email valid, message 10–2000, token required.
 */
export const contactPayloadSchema = z.object({
  // .trim() first: zod runs checks in chain order, so validations see the
  // trimmed value (a padded email must not fail .email(), a whitespace-only
  // name must fail .min(1)).
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(80, 'Name must be 80 characters or fewer'),
  email: z
    .string()
    .trim()
    .email('Please use a valid email address')
    .max(254, 'Email is too long'),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be 2000 characters or fewer'),
  turnstileToken: z.string().min(1, 'Turnstile token is required'),
});

export type ContactPayload = z.infer<typeof contactPayloadSchema>;

export interface ValidationResult {
  ok: boolean;
  data?: ContactPayload;
  /** Human-readable summary of the first issue. */
  message?: string;
  /** Field-by-field issues for clients that want to display per-field errors. */
  issues?: { field: string; message: string }[];
}

export function validateContactPayload(body: unknown): ValidationResult {
  const parsed = contactPayloadSchema.safeParse(body);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const issues = parsed.error.issues.map((i) => ({
    field: i.path.join('.') || '(root)',
    message: i.message,
  }));
  return { ok: false, message: issues[0]?.message ?? 'Invalid payload', issues };
}
