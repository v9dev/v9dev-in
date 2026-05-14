/**
 * Work / case-study cards rendered in the horizontal Work carousel.
 *
 * Placeholder content seeded by Claude — swap titles, outcomes, screenshots,
 * and links with real projects before going live. `cover` is intentionally
 * a plain string so the placeholders work without committed images; switch
 * to `import type { ImageMetadata } from 'astro'` once you import real images.
 */
export interface Project {
  slug: string;
  year: number;
  title: string;
  subtitle: string;
  outcome: string;            // headline metric / impact line
  stack: string[];            // skill ids from skills.ts
  links: { live?: string; repo?: string };
  /** Path under /public or absolute URL. Replace with real screenshots. */
  cover: string;
  /** Tag chip shown above the title — feel free to repurpose. */
  tag: 'Production' | 'Self-hosted' | 'OSS' | 'Internal';
}

export const projects: Project[] = [
  {
    slug: 'multi-region-saas',
    year: 2025,
    title: 'Multi-region SaaS Platform',
    subtitle: 'Kubernetes on three continents, one deploy pipeline.',
    outcome: '99.98% uptime · sub-200ms p95 globally',
    stack: ['kubernetes', 'terraform', 'aws', 'postgres', 'redis', 'nextjs', 'typescript'],
    links: { live: 'https://example.com' },
    cover: '/work/placeholder-saas.svg',
    tag: 'Production',
  },
  {
    slug: 'self-hosted-lab',
    year: 2025,
    title: 'Self-hosted Lab Cockpit',
    subtitle: '12 services, one dashboard, zero cloud bill.',
    outcome: '$0/mo · Grafana + Coolify + Uptime Kuma',
    stack: ['linux', 'docker', 'nginx', 'grafana', 'cloudflare', 'bash'],
    links: { live: 'https://example.com' },
    cover: '/work/placeholder-lab.svg',
    tag: 'Self-hosted',
  },
  {
    slug: 'analytics-pipeline',
    year: 2024,
    title: 'Real-time Analytics Pipeline',
    subtitle: 'Bun ingest, Postgres + ClickHouse store, React dashboard.',
    outcome: '10k events/s sustained · p99 ingest < 35ms',
    stack: ['bun', 'typescript', 'postgres', 'react', 'tailwind', 'docker'],
    links: { repo: 'https://github.com/v9dev' },
    cover: '/work/placeholder-analytics.svg',
    tag: 'OSS',
  },
  {
    slug: 'dev-portal',
    year: 2024,
    title: 'Internal Developer Portal',
    subtitle: '⌘K to deploy, rollback, tail logs across every service.',
    outcome: 'Cut deploy time 8× · onboarded juniors in a day',
    stack: ['nextjs', 'react', 'typescript', 'kubernetes', 'githubactions', 'graphql'],
    links: { live: 'https://example.com' },
    cover: '/work/placeholder-portal.svg',
    tag: 'Internal',
  },
];
