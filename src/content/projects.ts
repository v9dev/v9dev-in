/**
 * Work / case-study cards rendered in the horizontal Work carousel.
 * Real projects from JP - no fake "live" links. Each card has either
 * a repo / case-study link or none (for in-progress or private work).
 */
export interface Project {
  slug: string;
  year: number;
  title: string;
  subtitle: string;
  outcome: string;            // headline metric / impact line
  stack: string[];            // skill ids from skills.ts
  links: { repo?: string; case?: string };
  /** Path under /public or absolute URL. Replace with real screenshots. */
  cover: string;
  /** Tag chip shown above the title. */
  tag: 'Self-hosted' | 'OSS' | 'Production' | 'WIP';
}

export const projects: Project[] = [
  {
    slug: 'stalwart-mail-server',
    year: 2025,
    title: 'Production Mail Server, One VPS',
    subtitle:
      'Stalwart on a single Hetzner box: SMTP, IMAP, JMAP, anti-spam, DKIM/SPF/DMARC. Replaced a paid provider.',
    outcome: '0$ provider bill · TLS-A everywhere · 99.9% deliverability',
    stack: ['linux', 'nginx', 'docker', 'cloudflare', 'hetzner', 'bash'],
    links: {},
    cover: '/work/mail.svg',
    tag: 'Self-hosted',
  },
  {
    slug: 'server-cockpit',
    year: 2025,
    title: 'One-Pane Server Cockpit',
    subtitle:
      'Full-stack monitoring across a fleet: Homarr as the dashboard, Portainer for containers, Beszel for metrics, Dozzle for live logs, Uptime Kuma for alerts.',
    outcome: '12 services watched · sub-30s mean detection',
    stack: ['linux', 'docker', 'grafana', 'nginx', 'cloudflare'],
    links: {},
    cover: '/work/cockpit.svg',
    tag: 'Self-hosted',
  },
  {
    slug: 'superset-contrib',
    year: 2024,
    title: 'Apache Superset - OSS Contributor',
    subtitle:
      'Patches into the dashboarding side of Superset: query bug fixes, chart polish, docs. Merged upstream.',
    outcome: 'PRs merged · ~3k stars project',
    stack: ['python', 'react', 'typescript', 'postgres'],
    links: { repo: 'https://github.com/apache/superset' },
    cover: '/work/superset.svg',
    tag: 'OSS',
  },
  {
    slug: 'mautic-contrib',
    year: 2024,
    title: 'Mautic - OSS Contributor',
    subtitle:
      'Marketing-automation OSS. Worked on email pipeline, integrations, and a handful of UI fixes. Self-host shop, not SaaS.',
    outcome: 'PRs landed · powering 1000s of self-hosted installs',
    stack: ['python', 'mysql', 'nginx', 'docker'],
    links: { repo: 'https://github.com/mautic/mautic' },
    cover: '/work/mautic.svg',
    tag: 'OSS',
  },
  {
    slug: 'cost-optimize-40',
    year: 2025,
    title: 'Cut a Server Bill ~40%',
    subtitle:
      'Audited running services on a single VPS by actual load. Removed dead containers, swapped fat services for lighter equivalents, tuned systemd units.',
    outcome: '~40% lower monthly cost · same workloads',
    stack: ['linux', 'docker', 'bash', 'grafana', 'nginx'],
    links: {},
    cover: '/work/cost.svg',
    tag: 'Production',
  },
  {
    slug: 'kernel-patches',
    year: 2026,
    title: 'Linux Kernel - Working On It',
    subtitle:
      'Currently studying + sending small patches into the kernel tree. Focus area: systems plumbing, driver tweaks, and tooling for build/test.',
    outcome: 'In progress · learning by patching, not by reading',
    stack: ['c', 'linux', 'bash', 'git'],
    links: {},
    cover: '/work/kernel.svg',
    tag: 'WIP',
  },
];
