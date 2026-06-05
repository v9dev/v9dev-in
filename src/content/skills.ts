export type Cluster =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'language';

export interface Skill {
  /** Stable id used as React key + reference from projects.ts */
  id: string;
  /** Display name */
  name: string;
  /** Short role / category line shown on hover */
  role: string;
  /** Which cluster the node lives in on the constellation */
  cluster: Cluster;
  /** simple-icons slug - used to look up the SVG */
  icon: string;
  /** Brand hex for hover glow / tooltip accent */
  brand: string;
  /** Optional years-of-experience for the tooltip. Capped at 5 anywhere on the site. */
  years?: number;
}

export const clusters: Record<Cluster, { label: string; accent: 'lime' | 'fuchsia' | 'cyan' }> = {
  language: { label: 'Languages', accent: 'cyan' },
  frontend: { label: 'Frontend', accent: 'lime' },
  backend: { label: 'Backend', accent: 'lime' },
  database: { label: 'Data', accent: 'fuchsia' },
  cloud: { label: 'Cloud', accent: 'cyan' },
  devops: { label: 'DevOps', accent: 'fuchsia' },
};

export const skills: Skill[] = [
  // ── Languages ─────────────────────────────────────────────
  { id: 'typescript', name: 'TypeScript', role: 'Typed JavaScript', cluster: 'language', icon: 'typescript', brand: '#3178C6', years: 4 },
  { id: 'javascript', name: 'JavaScript', role: 'Programming Language', cluster: 'language', icon: 'javascript', brand: '#F7DF1E', years: 5 },
  { id: 'python', name: 'Python', role: 'Programming Language', cluster: 'language', icon: 'python', brand: '#3776AB', years: 4 },
  { id: 'c', name: 'C', role: 'Systems Programming', cluster: 'language', icon: 'c', brand: '#A8B9CC', years: 3 },
  { id: 'bash', name: 'Bash', role: 'Shell Scripting', cluster: 'language', icon: 'gnubash', brand: '#4EAA25', years: 3 },
  { id: 'php', name: 'PHP', role: 'Server-side language', cluster: 'language', icon: 'php', brand: '#777BB4', years: 5 },

  // ── Frontend ──────────────────────────────────────────────
  { id: 'react', name: 'React', role: 'Frontend Framework', cluster: 'frontend', icon: 'react', brand: '#61DAFB', years: 4 },
  { id: 'nextjs', name: 'Next.js', role: 'Full-stack Framework', cluster: 'frontend', icon: 'nextdotjs', brand: '#FFFFFF', years: 3 },
  { id: 'tailwind', name: 'Tailwind CSS', role: 'Utility-first CSS', cluster: 'frontend', icon: 'tailwindcss', brand: '#06B6D4', years: 4 },
  { id: 'astro', name: 'Astro', role: 'Content-first Framework', cluster: 'frontend', icon: 'astro', brand: '#FF5D01', years: 2 },

  // ── Backend ───────────────────────────────────────────────
  { id: 'node', name: 'Node.js', role: 'JavaScript Runtime', cluster: 'backend', icon: 'nodedotjs', brand: '#5FA04E', years: 5 },
  { id: 'bun', name: 'Bun', role: 'Fast JS Runtime', cluster: 'backend', icon: 'bun', brand: '#FBF0DF', years: 1 },
  { id: 'express', name: 'Express', role: 'Node Web Framework', cluster: 'backend', icon: 'express', brand: '#FFFFFF', years: 3 },
  { id: 'flask', name: 'Flask', role: 'Python Web Framework', cluster: 'backend', icon: 'flask', brand: '#FFFFFF', years: 2 },
  { id: 'graphql', name: 'GraphQL', role: 'API Query Language', cluster: 'backend', icon: 'graphql', brand: '#E10098', years: 2 },
  { id: 'firebase', name: 'Firebase', role: 'Backend-as-a-Service', cluster: 'backend', icon: 'firebase', brand: '#DD2C00', years: 3 },

  // ── Data ──────────────────────────────────────────────────
  { id: 'postgres', name: 'PostgreSQL', role: 'Relational Database', cluster: 'database', icon: 'postgresql', brand: '#4169E1', years: 4 },
  { id: 'mysql', name: 'MySQL', role: 'Relational Database', cluster: 'database', icon: 'mysql', brand: '#4479A1', years: 3 },
  { id: 'sqlite', name: 'SQLite', role: 'Embedded Database', cluster: 'database', icon: 'sqlite', brand: '#003B57', years: 3 },
  { id: 'mongodb', name: 'MongoDB', role: 'Document Database', cluster: 'database', icon: 'mongodb', brand: '#47A248', years: 4 },
  { id: 'redis', name: 'Redis', role: 'In-memory Store', cluster: 'database', icon: 'redis', brand: '#DC382D', years: 3 },
  { id: 'prisma', name: 'Prisma', role: 'TypeScript ORM', cluster: 'database', icon: 'prisma', brand: '#2D3748', years: 2 },

  // ── Cloud ─────────────────────────────────────────────────
  { id: 'aws', name: 'AWS', role: 'Cloud Platform', cluster: 'cloud', icon: 'amazonwebservices', brand: '#FF9900', years: 4 },
  { id: 'gcp', name: 'Google Cloud', role: 'Cloud Platform', cluster: 'cloud', icon: 'googlecloud', brand: '#4285F4', years: 2 },
  { id: 'azure', name: 'Azure', role: 'Cloud Platform', cluster: 'cloud', icon: 'icloud', brand: '#0078D4', years: 2 },
  { id: 'digitalocean', name: 'DigitalOcean', role: 'Cloud Infrastructure', cluster: 'cloud', icon: 'digitalocean', brand: '#0080FF', years: 4 },
  { id: 'cloudflare', name: 'Cloudflare', role: 'Edge / DNS / Workers', cluster: 'cloud', icon: 'cloudflare', brand: '#F38020', years: 3 },
  { id: 'hetzner', name: 'Hetzner', role: 'Bare-metal Hosting', cluster: 'cloud', icon: 'hetzner', brand: '#D50C2D', years: 2 },

  // ── DevOps / Infra (~2 years across the board) ───────────
  { id: 'linux', name: 'Linux', role: 'Operating System', cluster: 'devops', icon: 'linux', brand: '#FCC624', years: 5 },
  { id: 'docker', name: 'Docker', role: 'Containerization', cluster: 'devops', icon: 'docker', brand: '#2496ED', years: 2 },
  { id: 'kubernetes', name: 'Kubernetes', role: 'Container Orchestration', cluster: 'devops', icon: 'kubernetes', brand: '#326CE5', years: 2 },
  { id: 'terraform', name: 'Terraform', role: 'Infrastructure as Code', cluster: 'devops', icon: 'terraform', brand: '#7B42BC', years: 2 },
  { id: 'nginx', name: 'NGINX', role: 'Web Server / Proxy', cluster: 'devops', icon: 'nginx', brand: '#009639', years: 3 },
  { id: 'apache', name: 'Apache', role: 'Web Server', cluster: 'devops', icon: 'apache', brand: '#D22128', years: 2 },
  { id: 'git', name: 'Git', role: 'Version Control', cluster: 'devops', icon: 'git', brand: '#F05032', years: 5 },
  { id: 'githubactions', name: 'GitHub Actions', role: 'CI/CD Pipelines', cluster: 'devops', icon: 'githubactions', brand: '#2088FF', years: 2 },
  { id: 'jenkins', name: 'Jenkins', role: 'CI/CD Server', cluster: 'devops', icon: 'jenkins', brand: '#D24939', years: 2 },
  { id: 'grafana', name: 'Grafana', role: 'Observability', cluster: 'devops', icon: 'grafana', brand: '#F46800', years: 2 },
];

export const skillsById = Object.fromEntries(skills.map((s) => [s.id, s])) as Record<string, Skill>;

export const skillsByCluster = skills.reduce<Record<Cluster, Skill[]>>(
  (acc, s) => {
    acc[s.cluster] ??= [];
    acc[s.cluster].push(s);
    return acc;
  },
  {} as Record<Cluster, Skill[]>,
);
