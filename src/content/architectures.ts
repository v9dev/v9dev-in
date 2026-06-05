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
  projectSlug?: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

const stalwart: Architecture = {
  slug: 'stalwart-mail',
  title: 'Stalwart Mail Server',
  subtitle: 'A full SMTP/IMAP/JMAP mail stack on a single VPS',
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

export const architectures: Architecture[] = [stalwart];
export const architectureBySlug: Record<string, Architecture> = Object.fromEntries(
  architectures.map((a) => [a.slug, a]),
);
