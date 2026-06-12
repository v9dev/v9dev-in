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
  hints: [
    'the proxy only fronts the web side - mail protocols hit the server directly',
    'metadata needs somewhere to live',
  ],
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
    {
      id: 'dovecot',
      label: 'Dovecot',
      kind: 'service',
      accent: '#2f7df6',
      abbr: 'DVC',
      col: 2,
      decoy: true,
      hld: 'Standalone IMAP/POP3 server - redundant here; Stalwart already speaks IMAP/JMAP',
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
  hints: [
    'everything public goes through one front door',
    'a couple of tools read the Docker socket directly, not via the proxy',
  ],
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
    {
      id: 'grafana',
      label: 'Grafana',
      kind: 'service',
      skillId: 'grafana',
      col: 2,
      decoy: true,
      hld: 'Dashboards for a metrics database - this lightweight fleet has no Prometheus to feed it',
    },
    {
      id: 'prometheus',
      label: 'Prometheus',
      kind: 'service',
      accent: '#e6522c',
      abbr: 'PRM',
      col: 2,
      decoy: true,
      hld: 'Time-series metrics store - not part of this Uptime-Kuma / Beszel stack',
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
  hints: [
    'the edge talks to the proxy, never straight to the app',
    'the app owns its data - the edge never touches a store',
  ],
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
    {
      id: 'mysql',
      label: 'MySQL',
      kind: 'datastore',
      skillId: 'mysql',
      col: 3,
      decoy: true,
      hld: 'A second relational store - Postgres is already the primary; not needed',
    },
    {
      id: 'memcached',
      label: 'Memcached',
      kind: 'datastore',
      accent: '#1d8fc9',
      abbr: 'MMC',
      col: 3,
      decoy: true,
      hld: 'A cache - Redis already covers caching + sessions here',
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
  hints: [
    'each stage hands off to exactly the next one',
    'images live somewhere between build and deploy',
  ],
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
    {
      id: 'sonarqube',
      label: 'SonarQube',
      kind: 'service',
      accent: '#4e9bcd',
      abbr: 'SQ',
      col: 2,
      decoy: true,
      hld: 'Static-analysis quality gate - optional; not part of this minimal push-to-deploy chain',
    },
    {
      id: 'slack',
      label: 'Slack',
      kind: 'external',
      accent: '#611f69',
      abbr: 'SLK',
      col: 4,
      decoy: true,
      hld: 'Deploy notifications - a nice add-on, but not required to ship',
    },
  ],
  edges: [
    { id: 'git->runner', from: 'git', to: 'runner', protocol: 'webhook', required: true },
    { id: 'runner->build', from: 'runner', to: 'build', protocol: 'dispatch', required: true },
    { id: 'build->registry', from: 'build', to: 'registry', protocol: 'OCI', required: true },
    { id: 'registry->deploy', from: 'registry', to: 'deploy', protocol: 'OCI', required: true },
  ],
};

const media: Architecture = {
  slug: 'media',
  title: 'Self-hosted Media Stack',
  subtitle: 'Jellyfin + an *arr downloader behind one proxy',
  objective: 'Stand up the self-hosted media stack',
  difficulty: 'hard',
  intro: 'A reverse proxy, a media server, a library manager, a downloader, and one big disk.',
  hints: [
    'the proxy fronts the user-facing apps, not the storage',
    'the library manager drives the downloader, and both write to the same disk',
    'the media server only reads from storage',
  ],
  nodes: [
    {
      id: 'internet',
      label: 'Internet',
      kind: 'external',
      accent: '#3ae0ff',
      abbr: 'NET',
      col: 0,
      hld: 'Public DNS + TLS in front of the stack',
    },
    {
      id: 'nginx',
      label: 'nginx',
      kind: 'edge',
      skillId: 'nginx',
      col: 1,
      hld: 'Reverse proxy + TLS for the web apps',
    },
    {
      id: 'jellyfin',
      label: 'Jellyfin',
      kind: 'service',
      accent: '#a85cc3',
      abbr: 'JFN',
      col: 2,
      hld: 'Media server - streams the library to clients',
    },
    {
      id: 'sonarr',
      label: 'Sonarr',
      kind: 'service',
      accent: '#3a8cff',
      abbr: 'SNR',
      col: 2,
      hld: 'Library manager - watches for releases and drives the downloader',
    },
    {
      id: 'qbittorrent',
      label: 'qBittorrent',
      kind: 'service',
      accent: '#2f67ba',
      abbr: 'QBT',
      col: 3,
      hld: 'Download client - fetches and saves to disk',
    },
    {
      id: 'nas',
      label: 'NAS Storage',
      kind: 'datastore',
      accent: '#b8ff3a',
      abbr: 'NAS',
      col: 4,
      hld: 'Bulk disk - the media library and downloads live here',
    },
    {
      id: 'plex',
      label: 'Plex',
      kind: 'service',
      accent: '#e5a00d',
      abbr: 'PLX',
      col: 2,
      decoy: true,
      hld: 'Alternative media server - Jellyfin already fills this role',
    },
    {
      id: 'mysql',
      label: 'MySQL',
      kind: 'datastore',
      skillId: 'mysql',
      col: 4,
      decoy: true,
      hld: 'A relational DB - the *arr apps keep their own state; media lives on the NAS',
    },
    {
      id: 'ftp',
      label: 'FTP',
      kind: 'client',
      accent: '#ff3a8c',
      abbr: 'FTP',
      col: 0,
      decoy: true,
      hld: 'Legacy file transfer - nothing in this stack speaks to it',
    },
  ],
  edges: [
    { id: 'internet->nginx', from: 'internet', to: 'nginx', protocol: 'HTTPS', required: true },
    { id: 'nginx->jellyfin', from: 'nginx', to: 'jellyfin', protocol: 'HTTP', required: true },
    { id: 'nginx->sonarr', from: 'nginx', to: 'sonarr', protocol: 'HTTP', required: true },
    { id: 'jellyfin->nas', from: 'jellyfin', to: 'nas', protocol: 'read', required: true },
    {
      id: 'sonarr->qbittorrent',
      from: 'sonarr',
      to: 'qbittorrent',
      protocol: 'control',
      required: true,
    },
    { id: 'sonarr->nas', from: 'sonarr', to: 'nas', protocol: 'write', required: true },
    { id: 'qbittorrent->nas', from: 'qbittorrent', to: 'nas', protocol: 'write', required: true },
  ],
};

const microservices: Architecture = {
  slug: 'microservices',
  title: 'Microservices + Queue',
  subtitle: 'Gateway, services, a broker, a worker, two stores',
  objective: 'Wire the microservices platform',
  difficulty: 'expert',
  intro: 'An API gateway fronts three services; orders go async via a broker to a worker.',
  hints: [
    'one front door routes to every service',
    'auth keeps its sessions hot; the business services persist to the relational store',
    'orders go async - through the broker to a worker, which writes the result',
  ],
  nodes: [
    {
      id: 'internet',
      label: 'Internet',
      kind: 'external',
      accent: '#3ae0ff',
      abbr: 'NET',
      col: 0,
      hld: 'Public traffic enters here',
    },
    {
      id: 'gateway',
      label: 'API Gateway',
      kind: 'edge',
      skillId: 'nginx',
      abbr: 'GW',
      col: 1,
      hld: 'Single entry - routes + TLS for every service',
    },
    {
      id: 'auth',
      label: 'Auth',
      kind: 'service',
      accent: '#b8ff3a',
      abbr: 'AUTH',
      col: 2,
      hld: 'Issues + validates sessions',
    },
    {
      id: 'orders',
      label: 'Orders',
      kind: 'service',
      accent: '#3a8cff',
      abbr: 'ORD',
      col: 2,
      hld: 'Order lifecycle - persists and enqueues work',
    },
    {
      id: 'payments',
      label: 'Payments',
      kind: 'service',
      accent: '#ffd43b',
      abbr: 'PAY',
      col: 2,
      hld: 'Charges + records payments',
    },
    {
      id: 'queue',
      label: 'RabbitMQ',
      kind: 'service',
      accent: '#ff6600',
      abbr: 'MQ',
      col: 3,
      hld: 'Message broker - decouples orders from the worker',
    },
    {
      id: 'worker',
      label: 'Worker',
      kind: 'service',
      accent: '#ff3a8c',
      abbr: 'WRK',
      col: 4,
      hld: 'Consumes jobs and writes results',
    },
    {
      id: 'postgres',
      label: 'PostgreSQL',
      kind: 'datastore',
      skillId: 'postgres',
      col: 5,
      hld: 'Relational store for business state',
    },
    {
      id: 'redis',
      label: 'Redis',
      kind: 'datastore',
      skillId: 'redis',
      col: 5,
      hld: 'Session + cache store for auth',
    },
    {
      id: 'mongodb',
      label: 'MongoDB',
      kind: 'datastore',
      skillId: 'mongodb',
      col: 5,
      decoy: true,
      hld: 'A document store - this platform standardizes on Postgres',
    },
    {
      id: 'memcached',
      label: 'Memcached',
      kind: 'datastore',
      accent: '#1d8fc9',
      abbr: 'MMC',
      col: 5,
      decoy: true,
      hld: 'A cache - Redis already covers caching here',
    },
    {
      id: 'graphql',
      label: 'GraphQL BFF',
      kind: 'service',
      skillId: 'graphql',
      abbr: 'GQL',
      col: 2,
      decoy: true,
      hld: 'A backend-for-frontend - the gateway already routes REST; not in this design',
    },
  ],
  edges: [
    { id: 'internet->gateway', from: 'internet', to: 'gateway', protocol: 'HTTPS', required: true },
    { id: 'gateway->auth', from: 'gateway', to: 'auth', protocol: 'HTTP', required: true },
    { id: 'gateway->orders', from: 'gateway', to: 'orders', protocol: 'HTTP', required: true },
    { id: 'gateway->payments', from: 'gateway', to: 'payments', protocol: 'HTTP', required: true },
    { id: 'auth->redis', from: 'auth', to: 'redis', protocol: 'RESP', required: true },
    { id: 'orders->postgres', from: 'orders', to: 'postgres', protocol: 'SQL', required: true },
    { id: 'payments->postgres', from: 'payments', to: 'postgres', protocol: 'SQL', required: true },
    { id: 'orders->queue', from: 'orders', to: 'queue', protocol: 'AMQP', required: true },
    { id: 'queue->worker', from: 'queue', to: 'worker', protocol: 'AMQP', required: true },
    { id: 'worker->postgres', from: 'worker', to: 'postgres', protocol: 'SQL', required: true },
  ],
};

export const architectures: Architecture[] = [
  stalwart,
  cockpit,
  webstack,
  ci,
  media,
  microservices,
];
export const architectureBySlug: Record<string, Architecture> = Object.fromEntries(
  architectures.map((a) => [a.slug, a]),
);
