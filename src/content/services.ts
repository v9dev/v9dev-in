export interface Service {
  id: string;
  num: `0${number}`;
  title: string;
  tagline: string;
  blurb: string;
  deliverables: string[];
  accent: 'lime' | 'fuchsia' | 'cyan';
}

export const services: Service[] = [
  {
    id: 'cloud',
    num: '01',
    title: 'Cloud Architecture',
    tagline: 'Designs that scale and stay cheap.',
    blurb:
      'Greenfield infrastructure on AWS, GCP, Azure, DigitalOcean, or Hetzner. Multi-region when you need it, single-VPS when you do not.',
    deliverables: [
      'Architecture review & cost audit',
      'IaC (Terraform) for your whole stack',
      'Production-grade VPC + IAM',
      'Multi-environment promotion path',
    ],
    accent: 'cyan',
  },
  {
    id: 'selfhosted',
    num: '02',
    title: 'Self-hosted Platforms',
    tagline: 'Your own PaaS on your own hardware.',
    blurb:
      'Coolify, Dokploy, Portainer, Homarr, Uptime Kuma, Grafana — turn a homelab or single VPS into a production cockpit.',
    deliverables: [
      'Coolify / Dokploy deployment',
      'Reverse proxy + TLS automation',
      'Backups + restore drills',
      'Grafana + Loki + Prom stack',
    ],
    accent: 'fuchsia',
  },
  {
    id: 'fullstack',
    num: '03',
    title: 'Full-stack Builds',
    tagline: 'From idea to live URL.',
    blurb:
      'Next.js, React, Node, Bun, Python — shipped end-to-end with auth, payments, observability, and a deploy pipeline you can actually trust.',
    deliverables: [
      'MVPs in 2–4 weeks',
      'TypeScript everywhere, tests where they earn it',
      'Stripe, Auth, transactional email',
      'Type-safe API + Postgres + Prisma',
    ],
    accent: 'lime',
  },
  {
    id: 'devops',
    num: '04',
    title: 'DevOps & Automation',
    tagline: 'CI/CD that just works.',
    blurb:
      'Docker, Kubernetes, Terraform, GitHub Actions. Build pipelines, deploy pipelines, rollback strategies, and the boring runbooks that prevent 3am pages.',
    deliverables: [
      'GitHub Actions workflows',
      'Zero-downtime k8s rollouts',
      'Image scanning + secret hygiene',
      'On-call runbooks + alerts',
    ],
    accent: 'cyan',
  },
];
