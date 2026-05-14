/**
 * Blog post seed data. Replace these with real posts when ready.
 * Schema kept tiny so future migration to MDX / content collections
 * is trivial - swap the array source, components stay the same.
 */
export interface Post {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Read time in minutes (estimate). */
  readMins: number;
  /** Comma-free tags shown as small mono chips. */
  tags: string[];
  /** Optional external link until /blog/<slug>.mdx exists. */
  href?: string;
}

export const posts: Post[] = [
  {
    slug: 'self-hosting-mail-with-stalwart',
    title: 'Self-hosting production mail with Stalwart on one VPS',
    excerpt:
      'Why I left a paid provider, how Stalwart compares to the iRedMail/mailcow stack, and the exact systemd / Cloudflare / DNS setup that gets you a TLS-A on every record.',
    date: '2026-04-02',
    readMins: 9,
    tags: ['Stalwart', 'Mail', 'Self-hosted'],
  },
  {
    slug: 'cost-cutting-by-audit',
    title: 'Cutting 40% off a server bill without losing anything',
    excerpt:
      'A repeatable audit: list every service, measure actual load, kill the dead ones, swap the heavy ones, tune the rest. The whole loop took a weekend.',
    date: '2026-03-18',
    readMins: 7,
    tags: ['Linux', 'Cost', 'Ops'],
  },
  {
    slug: 'monitoring-stack-no-cloud',
    title: 'A monitoring stack that fits on one VPS',
    excerpt:
      'Homarr + Beszel + Dozzle + Uptime Kuma in one cockpit. What each tool actually owns, what to alert on, and how to keep the whole thing under 200MB RAM.',
    date: '2026-02-27',
    readMins: 8,
    tags: ['Observability', 'Self-hosted'],
  },
];
