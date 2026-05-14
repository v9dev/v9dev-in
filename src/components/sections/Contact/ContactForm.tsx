import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

interface ErrorBody {
  error: 'ValidationError' | 'TurnstileFailed' | 'RateLimited' | 'ResendFailed';
  message?: string;
}

const errorMessage: Record<ErrorBody['error'], string> = {
  ValidationError: 'Please check the fields and try again.',
  TurnstileFailed: 'Spam check failed. Refresh and try once more.',
  RateLimited: 'Too many messages in a short time. Take five and try again.',
  ResendFailed: 'My mail server hiccuped. Try again in a minute.',
};

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorKey, setErrorKey] = useState<ErrorBody['error'] | null>(null);
  const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '';

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setErrorKey(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      turnstileToken: String(data.get('cf-turnstile-response') ?? ''),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus('sent');
        form.reset();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as Partial<ErrorBody>;
      setErrorKey(body.error ?? 'ResendFailed');
      setStatus('error');
    } catch {
      setErrorKey('ResendFailed');
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4"
      aria-live="polite"
      noValidate
    >
      <Field
        name="name"
        label="Your name"
        required
        autoComplete="name"
        maxLength={80}
      />
      <Field
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        name="message"
        label="What's the project?"
        textarea
        required
        minLength={10}
        maxLength={2000}
      />

      {siteKey && (
        <div
          className="cf-turnstile"
          data-sitekey={siteKey}
          data-theme="dark"
          data-size="flexible"
        />
      )}

      <div className="flex items-center justify-between gap-4 mt-2">
        <p className="font-mono text-[11px] text-muted">
          By sending you agree to be contacted back at the address above.
        </p>
        <SubmitButton status={status} />
      </div>

      <AnimatePresence>
        {status === 'error' && errorKey && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-mono text-xs text-fuchsia"
            role="alert"
          >
            {errorMessage[errorKey]}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
}

function Field({
  name,
  label,
  type = 'text',
  textarea,
  required,
  minLength,
  maxLength,
  autoComplete,
}: FieldProps) {
  const id = `f-${name}`;
  const sharedProps = {
    id,
    name,
    required,
    minLength,
    maxLength,
    autoComplete,
    placeholder: ' ',
    className:
      'peer w-full bg-canvas/40 border border-line/60 rounded-2xl px-4 pt-6 pb-2.5 text-text placeholder-transparent focus:border-lime focus:outline-none transition-colors',
  };

  return (
    <div className="relative">
      {textarea ? (
        <textarea rows={5} {...sharedProps} />
      ) : (
        <input type={type} {...sharedProps} />
      )}
      <label
        htmlFor={id}
        className="absolute left-4 top-2.5 font-mono text-[11px] uppercase tracking-widest text-muted pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-xs peer-placeholder-shown:tracking-wide peer-placeholder-shown:normal-case peer-focus:top-2.5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-lime transition-all"
      >
        {label}
      </label>
    </div>
  );
}

function SubmitButton({ status }: { status: Status }) {
  const text =
    status === 'sending'
      ? 'Sending…'
      : status === 'sent'
        ? 'Sent ✓'
        : status === 'error'
          ? 'Retry →'
          : 'Send →';

  return (
    <motion.button
      type="submit"
      disabled={status === 'sending' || status === 'sent'}
      whileHover={status === 'idle' || status === 'error' ? { scale: 1.03 } : undefined}
      whileTap={status === 'idle' || status === 'error' ? { scale: 0.97 } : undefined}
      className={`relative inline-flex items-center justify-center min-w-[8rem] rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
        status === 'sent'
          ? 'bg-lime text-canvas'
          : status === 'error'
            ? 'bg-fuchsia text-canvas'
            : 'bg-text text-canvas hover:bg-white'
      }`}
      data-cursor-label={status === 'idle' ? 'send' : status}
    >
      {text}
    </motion.button>
  );
}
