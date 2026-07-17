export const SITE = {
  url: 'https://v9dev.in',
  name: 'v9dev.in',
  title: 'JP Singh - Forward Deployed Engineer · Cloud + Full-stack',
  description:
    'I design cloud platforms, build full-stack products, and keep them alive in production. From a single VPS to multi-region Kubernetes. Available for work.',
  author: 'JP Singh',
  email: 'hello@v9dev.in',
  socials: {
    github: 'https://github.com/v9dev',
    linkedin: 'https://www.linkedin.com/in/v9dev',
  },
} as const;

export const socialList = [
  { label: 'GitHub', href: SITE.socials.github, icon: 'github' },
  { label: 'LinkedIn', href: SITE.socials.linkedin, icon: 'linkedin' },
  { label: 'Email', href: `mailto:${SITE.email}`, icon: 'mail' },
] as const;
