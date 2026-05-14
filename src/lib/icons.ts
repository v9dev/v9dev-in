/**
 * Maps each Skill.id to a simple-icons SVG path string + title.
 * Tree-shakes per-icon imports so we don't pull in the whole 3000-icon set.
 *
 * NB: simple-icons does not ship AWS or Azure logos (brand restrictions).
 * For those two we use hand-written paths defined below.
 */
import {
  siTypescript,
  siJavascript,
  siPython,
  siC,
  siGnubash,
  siReact,
  siNextdotjs,
  siTailwindcss,
  siAstro,
  siNodedotjs,
  siBun,
  siExpress,
  siFlask,
  siGraphql,
  siFirebase,
  siPostgresql,
  siMysql,
  siSqlite,
  siMongodb,
  siRedis,
  siPrisma,
  siGooglecloud,
  siDigitalocean,
  siCloudflare,
  siHetzner,
  siLinux,
  siDocker,
  siKubernetes,
  siTerraform,
  siNginx,
  siApache,
  siGit,
  siGithubactions,
  siJenkins,
  siGrafana,
} from 'simple-icons';

// Generic outlined cloud silhouettes for AWS / Azure (no brand marks).
const awsGeneric = {
  path: 'M19.5 14.5a4 4 0 0 0-1.6-7.6h-.3a6 6 0 0 0-11.6 1.7A4.5 4.5 0 0 0 6 17h12a3.5 3.5 0 0 0 1.5-2.5z M7 19l1.5 2 M12 19l1.5 2 M17 19l1.5 2',
  title: 'AWS',
  hex: 'FF9900',
};
const azureGeneric = {
  path: 'M11 3l-7 12h6l1 4 9-16h-9z',
  title: 'Azure',
  hex: '0078D4',
};

const map: Record<string, { path: string; title: string; hex: string }> = {
  typescript: siTypescript,
  javascript: siJavascript,
  python: siPython,
  c: siC,
  bash: siGnubash,
  react: siReact,
  nextjs: siNextdotjs,
  tailwind: siTailwindcss,
  astro: siAstro,
  node: siNodedotjs,
  bun: siBun,
  express: siExpress,
  flask: siFlask,
  graphql: siGraphql,
  firebase: siFirebase,
  postgres: siPostgresql,
  mysql: siMysql,
  sqlite: siSqlite,
  mongodb: siMongodb,
  redis: siRedis,
  prisma: siPrisma,
  aws: awsGeneric,
  gcp: siGooglecloud,
  azure: azureGeneric,
  digitalocean: siDigitalocean,
  cloudflare: siCloudflare,
  hetzner: siHetzner,
  linux: siLinux,
  docker: siDocker,
  kubernetes: siKubernetes,
  terraform: siTerraform,
  nginx: siNginx,
  apache: siApache,
  git: siGit,
  githubactions: siGithubactions,
  jenkins: siJenkins,
  grafana: siGrafana,
};

export function getIconPath(id: string): string | undefined {
  return map[id]?.path;
}

export function getIconHex(id: string): string | undefined {
  return map[id]?.hex ? `#${map[id].hex}` : undefined;
}
