export type NodeKind = 'client' | 'edge' | 'service' | 'datastore' | 'external';
export interface ArchPort {
  id: string;
  label: string;
  dir: 'in' | 'out';
}
export interface ArchNode {
  id: string;
  label: string;
  kind: NodeKind;
  skillId?: string;
  accent?: string;
  abbr?: string;
  hld: string;
  detail?: {
    ports: ArchPort[];
    protocols: string[];
    config: { label: string; value: string }[];
    tables?: { name: string; columns?: string[] }[];
    notes?: string;
  };
  col?: number;
  decoy?: boolean;
}
export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  protocol?: string;
  required: boolean;
}
export interface Architecture {
  slug: string;
  title: string;
  subtitle: string;
  objective: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  intro?: string;
  hints?: string[];
  projectSlug?: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

const stalwart: Architecture = {
  slug: 'stalwart-mail',
  title: 'Stalwart Mail Server',
  subtitle: 'A full SMTP/IMAP/JMAP mail stack on a single VPS',
  objective: 'Bring the Stalwart mail server online',
  difficulty: 'easy',
  intro: 'One VPS. SMTP, IMAP, JMAP. Wire it up and fire it.',
  projectSlug: 'stalwart-mail-server',
  nodes: [
    {
      id: 'internet',
      label: 'Internet / DNS',
      kind: 'external',
      accent: '#3ae0ff',
      abbr: 'NET',
      col: 0,
      hld: 'Cloudflare DNS - MX, SPF, DKIM, DMARC records resolve mail + web here',
      detail: {
        ports: [{ id: 'out', label: 'public', dir: 'out' }],
        protocols: ['DNS', 'HTTPS', 'SMTP'],
        config: [
          { label: 'MX', value: 'mail.v9dev.in' },
          { label: 'DMARC', value: 'p=reject' },
        ],
      },
    },
    {
      id: 'mailclient',
      label: 'Mail Client',
      kind: 'client',
      accent: '#ff3a8c',
      abbr: 'MUA',
      col: 0,
      hld: 'Thunderbird / iOS Mail / webmail - IMAP + JMAP + SMTP submission',
      detail: {
        ports: [{ id: 'out', label: 'connect', dir: 'out' }],
        protocols: ['IMAP', 'JMAP', 'SMTP'],
        config: [{ label: 'auth', value: 'app password' }],
      },
    },
    {
      id: 'nginx',
      label: 'nginx',
      kind: 'edge',
      skillId: 'nginx',
      col: 1,
      hld: 'TLS termination + reverse proxy for JMAP and the web admin',
      detail: {
        ports: [
          { id: '443', label: '443', dir: 'in' },
          { id: 'up', label: 'proxy', dir: 'out' },
        ],
        protocols: ['HTTPS', 'TLS 1.3'],
        config: [{ label: 'certs', value: "Let's Encrypt" }],
      },
    },
    {
      id: 'stalwart',
      label: 'Stalwart',
      kind: 'service',
      accent: '#b8ff3a',
      abbr: 'STL',
      col: 2,
      hld: 'All-in-one SMTP/IMAP/JMAP server with built-in anti-spam',
      detail: {
        ports: [
          { id: 'smtp', label: 'SMTP 25/465/587', dir: 'in' },
          { id: 'imap', label: 'IMAP 993', dir: 'in' },
          { id: 'jmap', label: 'JMAP', dir: 'in' },
          { id: 'store', label: 'store', dir: 'out' },
        ],
        protocols: ['SMTP', 'IMAP', 'JMAP', 'Sieve'],
        config: [
          { label: 'DKIM', value: 'enabled' },
          { label: 'SPF', value: '-all' },
          { label: 'DMARC', value: 'reject' },
          { label: 'anti-spam', value: 'built-in' },
        ],
      },
    },
    {
      id: 'sqlite',
      label: 'SQLite + blobs',
      kind: 'datastore',
      skillId: 'sqlite',
      col: 3,
      hld: 'Metadata in SQLite; message blobs on the local filesystem',
      detail: {
        ports: [{ id: 'in', label: 'store', dir: 'in' }],
        protocols: ['file'],
        config: [{ label: 'backups', value: 'nightly off-site' }],
        tables: [
          { name: 'accounts', columns: ['id', 'email', 'quota'] },
          { name: 'mailboxes', columns: ['id', 'account_id', 'name'] },
          { name: 'messages', columns: ['id', 'mailbox_id', 'blob_ref', 'flags'] },
        ],
      },
    },
  ],
  edges: [
    { id: 'internet->nginx', from: 'internet', to: 'nginx', protocol: 'HTTPS', required: true },
    {
      id: 'internet->stalwart',
      from: 'internet',
      to: 'stalwart',
      protocol: 'SMTP',
      required: true,
    },
    {
      id: 'mailclient->stalwart',
      from: 'mailclient',
      to: 'stalwart',
      protocol: 'IMAP/JMAP',
      required: true,
    },
    { id: 'nginx->stalwart', from: 'nginx', to: 'stalwart', protocol: 'JMAP', required: true },
    { id: 'stalwart->sqlite', from: 'stalwart', to: 'sqlite', protocol: 'store', required: true },
  ],
};

const cockpit: Architecture = {
  slug: 'cockpit',
  title: 'Server Cockpit',
  subtitle: 'A self-hosted monitoring + management fleet behind one proxy',
  objective: 'Stand up the Server Cockpit monitoring fleet',
  difficulty: 'medium',
  intro: 'A Docker host, a reverse proxy, and a wall of dashboards. Get them all reachable.',
  nodes: [
    {
      id: 'host',
      label: 'Docker Host',
      kind: 'external',
      skillId: 'docker',
      col: 0,
      hld: 'A single Docker host running the whole monitoring stack as containers',
      detail: {
        ports: [{ id: 'out', label: 'docker', dir: 'out' }],
        protocols: ['Docker', 'HTTPS'],
        config: [
          { label: 'engine', value: 'Docker Compose' },
          { label: 'network', value: 'cockpit-net' },
        ],
      },
    },
    {
      id: 'proxy',
      label: 'Reverse Proxy',
      kind: 'edge',
      skillId: 'nginx',
      col: 1,
      hld: 'nginx reverse proxy - TLS termination + subdomain routing to each dashboard',
      detail: {
        ports: [
          { id: '443', label: '443', dir: 'in' },
          { id: 'up', label: 'proxy', dir: 'out' },
        ],
        protocols: ['HTTPS', 'TLS 1.3'],
        config: [{ label: 'certs', value: "Let's Encrypt" }],
      },
    },
    {
      id: 'portainer',
      label: 'Portainer',
      kind: 'service',
      accent: '#13bef9',
      abbr: 'PTR',
      col: 2,
      hld: 'Container management UI - deploy, inspect, and restart stacks',
      detail: {
        ports: [{ id: 'web', label: '9443', dir: 'in' }],
        protocols: ['HTTPS'],
        config: [{ label: 'agent', value: 'local socket' }],
      },
    },
    {
      id: 'homarr',
      label: 'Homarr',
      kind: 'service',
      accent: '#fa5252',
      abbr: 'HMR',
      col: 2,
      hld: 'The landing dashboard - links and status for every other service',
      detail: {
        ports: [{ id: 'web', label: '7575', dir: 'in' }],
        protocols: ['HTTPS'],
        config: [{ label: 'widgets', value: 'docker, ping' }],
      },
    },
    {
      id: 'uptimekuma',
      label: 'Uptime Kuma',
      kind: 'service',
      accent: '#5cdd8b',
      abbr: 'UPK',
      col: 2,
      hld: 'Uptime + status monitoring with alerting for every endpoint',
      detail: {
        ports: [{ id: 'web', label: '3001', dir: 'in' }],
        protocols: ['HTTPS', 'ICMP'],
        config: [{ label: 'checks', value: 'http, tcp, ping' }],
      },
    },
    {
      id: 'dozzle',
      label: 'Dozzle',
      kind: 'service',
      accent: '#ffd43b',
      abbr: 'DZL',
      col: 2,
      hld: 'Real-time container log viewer straight off the Docker socket',
      detail: {
        ports: [{ id: 'web', label: '8080', dir: 'in' }],
        protocols: ['HTTPS', 'Docker'],
        config: [{ label: 'source', value: 'docker.sock' }],
      },
    },
    {
      id: 'beszel',
      label: 'Beszel',
      kind: 'service',
      accent: '#b8ff3a',
      abbr: 'BSZ',
      col: 2,
      hld: 'Lightweight server resource monitor - CPU, memory, disk, network',
      detail: {
        ports: [{ id: 'web', label: '8090', dir: 'in' }],
        protocols: ['HTTPS'],
        config: [{ label: 'agent', value: 'per-host' }],
      },
    },
  ],
  edges: [
    { id: 'host->proxy', from: 'host', to: 'proxy', protocol: 'HTTPS', required: true },
    { id: 'proxy->portainer', from: 'proxy', to: 'portainer', protocol: 'HTTPS', required: true },
    { id: 'proxy->homarr', from: 'proxy', to: 'homarr', protocol: 'HTTPS', required: true },
    {
      id: 'proxy->uptimekuma',
      from: 'proxy',
      to: 'uptimekuma',
      protocol: 'HTTPS',
      required: true,
    },
    { id: 'host->dozzle', from: 'host', to: 'dozzle', protocol: 'Docker', required: true },
    { id: 'host->beszel', from: 'host', to: 'beszel', protocol: 'HTTPS', required: true },
  ],
};

const webstack: Architecture = {
  slug: 'webstack',
  title: 'Full-stack App Stack',
  subtitle: 'Edge -> proxy -> app -> data, the classic web deployment',
  objective: 'Init a full-stack app stack',
  difficulty: 'medium',
  intro: 'Cloudflare in front, nginx, a Node app, and two stores. Stand it up.',
  nodes: [
    {
      id: 'cloudflare',
      label: 'Cloudflare',
      kind: 'external',
      skillId: 'cloudflare',
      col: 0,
      hld: 'CDN + DNS + WAF at the edge - TLS, caching, and DDoS protection',
      detail: {
        ports: [{ id: 'out', label: 'origin', dir: 'out' }],
        protocols: ['HTTPS', 'DNS'],
        config: [
          { label: 'proxy', value: 'orange-cloud' },
          { label: 'cache', value: 'standard' },
        ],
      },
    },
    {
      id: 'nginx',
      label: 'nginx',
      kind: 'edge',
      skillId: 'nginx',
      col: 1,
      hld: 'Reverse proxy + static asset server in front of the app',
      detail: {
        ports: [
          { id: '443', label: '443', dir: 'in' },
          { id: 'up', label: 'upstream', dir: 'out' },
        ],
        protocols: ['HTTPS', 'HTTP/2'],
        config: [{ label: 'gzip', value: 'on' }],
      },
    },
    {
      id: 'app',
      label: 'Node App',
      kind: 'service',
      skillId: 'node',
      col: 2,
      hld: 'The application server - business logic, sessions, and API routes',
      detail: {
        ports: [
          { id: 'http', label: '3000', dir: 'in' },
          { id: 'db', label: 'sql', dir: 'out' },
          { id: 'cache', label: 'cache', dir: 'out' },
        ],
        protocols: ['HTTP', 'SQL', 'RESP'],
        config: [{ label: 'runtime', value: 'Node.js' }],
      },
    },
    {
      id: 'postgres',
      label: 'PostgreSQL',
      kind: 'datastore',
      skillId: 'postgres',
      col: 3,
      hld: 'Primary relational store - users, orders, and durable app state',
      detail: {
        ports: [{ id: 'sql', label: '5432', dir: 'in' }],
        protocols: ['SQL'],
        config: [{ label: 'backups', value: 'PITR' }],
        tables: [
          { name: 'users', columns: ['id', 'email', 'created_at'] },
          { name: 'orders', columns: ['id', 'user_id', 'total'] },
        ],
      },
    },
    {
      id: 'redis',
      label: 'Redis',
      kind: 'datastore',
      skillId: 'redis',
      col: 3,
      hld: 'In-memory cache + session store + rate-limit counters',
      detail: {
        ports: [{ id: 'resp', label: '6379', dir: 'in' }],
        protocols: ['RESP'],
        config: [{ label: 'persistence', value: 'AOF' }],
      },
    },
  ],
  edges: [
    { id: 'cloudflare->nginx', from: 'cloudflare', to: 'nginx', protocol: 'HTTPS', required: true },
    { id: 'nginx->app', from: 'nginx', to: 'app', protocol: 'HTTP', required: true },
    { id: 'app->postgres', from: 'app', to: 'postgres', protocol: 'SQL', required: true },
    { id: 'app->redis', from: 'app', to: 'redis', protocol: 'RESP', required: true },
  ],
};

const ci: Architecture = {
  slug: 'ci',
  title: 'CI/CD Pipeline',
  subtitle: 'Push to deploy - source, runner, build, registry, release',
  objective: 'Wire a CI/CD pipeline',
  difficulty: 'hard',
  intro: 'Git push triggers a runner, build, image push, and a deploy. Chain it.',
  nodes: [
    {
      id: 'git',
      label: 'Git',
      kind: 'external',
      skillId: 'git',
      col: 0,
      hld: 'Source of truth - a push or merged PR fires the pipeline webhook',
      detail: {
        ports: [{ id: 'out', label: 'webhook', dir: 'out' }],
        protocols: ['HTTPS', 'SSH'],
        config: [{ label: 'trigger', value: 'push, tag' }],
      },
    },
    {
      id: 'runner',
      label: 'CI Runner',
      kind: 'service',
      skillId: 'githubactions',
      col: 1,
      hld: 'Picks up the job, checks out the repo, and orchestrates the stages',
      detail: {
        ports: [
          { id: 'in', label: 'webhook', dir: 'in' },
          { id: 'out', label: 'dispatch', dir: 'out' },
        ],
        protocols: ['HTTPS'],
        config: [{ label: 'executor', value: 'container' }],
      },
    },
    {
      id: 'build',
      label: 'Build + Test',
      kind: 'service',
      accent: '#b8ff3a',
      abbr: 'BLD',
      col: 2,
      hld: 'Installs deps, runs tests, and produces a tagged container image',
      detail: {
        ports: [
          { id: 'in', label: 'dispatch', dir: 'in' },
          { id: 'out', label: 'push', dir: 'out' },
        ],
        protocols: ['OCI'],
        config: [{ label: 'cache', value: 'layer cache' }],
      },
    },
    {
      id: 'registry',
      label: 'Registry',
      kind: 'service',
      accent: '#3ae0ff',
      abbr: 'REG',
      col: 3,
      hld: 'Stores versioned container images that the deploy stage pulls from',
      detail: {
        ports: [
          { id: 'push', label: 'push', dir: 'in' },
          { id: 'pull', label: 'pull', dir: 'out' },
        ],
        protocols: ['OCI', 'HTTPS'],
        config: [{ label: 'retention', value: 'last 20 tags' }],
      },
    },
    {
      id: 'deploy',
      label: 'Deploy',
      kind: 'service',
      accent: '#ff3a8c',
      abbr: 'DEP',
      col: 4,
      hld: 'Pulls the new image and rolls it out to the target environment',
      detail: {
        ports: [{ id: 'in', label: 'pull', dir: 'in' }],
        protocols: ['HTTPS', 'OCI'],
        config: [{ label: 'strategy', value: 'rolling' }],
      },
    },
  ],
  edges: [
    { id: 'git->runner', from: 'git', to: 'runner', protocol: 'webhook', required: true },
    { id: 'runner->build', from: 'runner', to: 'build', protocol: 'dispatch', required: true },
    { id: 'build->registry', from: 'build', to: 'registry', protocol: 'OCI', required: true },
    { id: 'registry->deploy', from: 'registry', to: 'deploy', protocol: 'OCI', required: true },
  ],
};

export const architectures: Architecture[] = [stalwart, cockpit, webstack, ci];
export const architectureBySlug: Record<string, Architecture> = Object.fromEntries(
  architectures.map((a) => [a.slug, a]),
);
