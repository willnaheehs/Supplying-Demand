import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = join(root, '.wrangler/catalog-local.json');
mkdirSync(join(root, '.wrangler'), { recursive: true });
writeFileSync(
  config,
  JSON.stringify(
    {
      name: 'supplying-demand',
      compatibility_date: '2026-05-15',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'site-creator-d1',
          database_id: '00000000-0000-4000-8000-000000000000',
          migrations_dir: join(root, 'drizzle'),
        },
      ],
    },
    null,
    2,
  ),
);
const result = spawnSync(
  join(root, 'node_modules/.bin/wrangler'),
  [
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    config,
    '--persist-to',
    join(root, '.wrangler/state'),
  ],
  { cwd: root, stdio: ['pipe', 'inherit', 'inherit'], input: 'y\n' },
);
process.exit(result.status ?? 1);
