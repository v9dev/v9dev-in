/// <reference types="astro/client" />
/// <reference types="vitest/globals" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

type Runtime = import('@astrojs/cloudflare').Runtime<{
  CONTACT_MESSAGES: KVNamespace;
  RATE_LIMIT: KVNamespace;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  IP_HASH_SALT: string;
  CONTACT_FROM_EMAIL: string;
  CONTACT_TO_EMAIL: string;
  PUBLIC_SITE_URL: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
