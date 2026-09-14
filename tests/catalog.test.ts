import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  catalogStats,
  filterCatalog,
  validateManualEntry,
  emptyHardware,
  type CatalogEntry,
} from '../lib/catalog.ts';
import {
  seedCatalog,
  readCatalog,
  addCatalogEntry,
  updateCatalogEntry,
} from '../db/catalog-store.ts';
import { catalogUser, sameOriginMutation } from '../lib/catalog-access.ts';

const seed: CatalogEntry[] = JSON.parse(
  readFileSync(
    new URL('../data/cluster-catalog.json', import.meta.url),
    'utf8',
  ),
);
const manifest = JSON.parse(
  readFileSync(
    new URL('../data/catalog-manifest.json', import.meta.url),
    'utf8',
  ),
);
const now = '2026-09-14T12:00:00.000Z';
const draft = {
  name: "Client's cluster; DROP TABLE catalog_records;",
  operator: 'Example provider',
  hardware: { ...emptyHardware, accelerator: 'H100', acceleratorCount: 8 },
  model: 'client-model-r1',
  workloadKind: 'inference',
  evidenceKind: 'benchmark',
  scenario: 'Server',
  metric: {
    name: 'Completed output throughput',
    value: 123,
    unit: 'Tokens/s',
    direction: 'higher',
  },
  conditions: 'Batch 4; 1,024 input tokens; 256 output tokens; sample test.',
  outcome: '123 output tokens/s in the supplied test.',
  limitation: 'Illustrative local test only.',
  sources: [{ title: 'Local test source', url: 'https://example.com/results' }],
  date: '2026-09-13',
};

void test('the research snapshot has unique provenance, real metric units, and distinct systems', () => {
  assert.equal(seed.length, manifest.recordCount);
  assert.ok(seed.length >= 600);
  assert.equal(new Set(seed.map((r) => r.id)).size, seed.length);
  assert.equal(catalogStats(seed).systems, manifest.systemCount);
  assert.ok(catalogStats(seed).systems < seed.length);
  assert.ok(new Set(seed.map((r) => r.model)).size >= 40);
  assert.ok(
    seed.filter(
      (r) => r.evidenceKind === 'deployment' || r.evidenceKind === 'research',
    ).length >= 15,
  );
  for (const record of seed) {
    assert.equal(record.origin, 'seed');
    assert.ok(
      record.sources.length &&
        record.conditions &&
        record.limitation &&
        record.hardware.accelerator,
    );
    for (const s of record.sources) assert.match(s.url, /^https:\/\//);
    if (record.metric) {
      assert.ok(
        Number.isFinite(record.metric.value) && record.metric.value >= 0,
      );
      assert.ok(record.metric.unit);
    }
    if (
      record.evidenceKind === 'benchmark' ||
      record.evidenceKind === 'training-trial'
    ) {
      assert.ok(record.metric);
      assert.match(record.sources[0].url, /\/blob\/[a-f0-9]{40}\//);
    }
    if (record.evidenceKind === 'training-trial') {
      assert.equal(record.metric!.unit, 'minutes');
      assert.match(record.limitation, /not the official MLPerf aggregate/);
    }
  }
  assert.ok(seed.some((r) => r.hardware.acceleratorCount === null));
  assert.ok(seed.some((r) => r.metric === null));
});

void test('filters retain model and scenario identity and never compare rates without units', () => {
  const model = 'llama2-70b-99';
  const result = filterCatalog(seed, {
    model,
    workload: 'inference',
    scenario: 'Server',
    unit: 'Tokens/s',
    minimum: '1000',
  });
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (r) =>
        r.model === model &&
        r.scenario === 'Server' &&
        r.metric!.unit === 'Tokens/s' &&
        r.metric!.value >= 1000,
    ),
  );
  assert.equal(filterCatalog(seed, { minimum: '100' }).length, 0);
  assert.equal(
    filterCatalog(seed, { minimum: 'NaN', unit: 'Tokens/s' }).length,
    0,
  );
  assert.ok(
    filterCatalog(seed, { query: 'H100 RoCE', workload: 'training' }).length >
      0,
  );
  assert.ok(
    filterCatalog(seed, { unit: 'Samples/s' }).every(
      (r) => r.metric!.unit === 'Samples/s',
    ),
  );
});

void test('manual validation preserves unknowns and cannot promote user claims to curated evidence', () => {
  const entry = validateManualEntry(
    { ...draft, origin: 'seed', createdBy: 'another-person' },
    'manual-test',
    now,
  );
  assert.equal(entry.origin, 'manual');
  assert.equal(entry.hardware.nodes, null);
  assert.equal(entry.hardware.sharedStorage, null);
  assert.equal(entry.hardware.acceleratorCount, 8);
  assert.equal(entry.updatedAt, now);
  assert.equal('createdBy' in entry, false);
  const report = validateManualEntry(
    { ...draft, evidenceKind: 'deployment', metric: null },
    'manual-report',
    now,
  );
  assert.equal(report.metric, null);
});

void test('manual records reject unsafe URLs, ambiguous measurements, invalid counts and dates', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://user:secret@example.com/x',
    'not-a-url',
  ]) {
    assert.throws(() =>
      validateManualEntry(
        { ...draft, sources: [{ title: 'Source', url }] },
        'manual-test',
        now,
      ),
    );
  }
  for (const value of [Infinity, NaN, -1, '123'])
    assert.throws(() =>
      validateManualEntry(
        { ...draft, metric: { ...draft.metric, value } },
        'manual-test',
        now,
      ),
    );
  for (const value of [0, -1, 2.5])
    assert.throws(() =>
      validateManualEntry(
        { ...draft, hardware: { ...draft.hardware, nodes: value } },
        'manual-test',
        now,
      ),
    );
  for (const date of ['2026-02-30', '2027-01-01', '09/13/2026'])
    assert.throws(() =>
      validateManualEntry({ ...draft, date }, 'manual-test', now),
    );
  assert.throws(() =>
    validateManualEntry({ ...draft, metric: null }, 'manual-test', now),
  );
  assert.throws(() =>
    validateManualEntry(
      { ...draft, metric: { ...draft.metric, unit: '' } },
      'manual-test',
      now,
    ),
  );
  assert.throws(() =>
    validateManualEntry(
      { ...draft, workloadKind: 'training' },
      'manual-test',
      now,
    ),
  );
});

void test('catalog access rejects anonymous production reads and cross-site writes', () => {
  assert.equal(
    catalogUser(new Request('https://example.com/api/catalog')),
    null,
  );
  assert.equal(catalogUser(new Request('http://localhost/api/catalog')), null);
  assert.equal(
    catalogUser(new Request('http://localhost/api/catalog'), true),
    'local-development',
  );
  assert.equal(
    catalogUser(new Request('https://example.com/api/catalog'), true),
    null,
  );
  assert.equal(
    catalogUser(
      new Request('https://example.com/api/catalog', {
        headers: { 'oai-authenticated-user-id': 'owner' },
      }),
    ),
    'owner',
  );
  assert.equal(
    sameOriginMutation(
      new Request('https://example.com/api/catalog', {
        headers: {
          Origin: 'https://attacker.example',
          'Content-Type': 'application/json',
        },
      }),
    ),
    false,
  );
  assert.equal(
    sameOriginMutation(
      new Request('https://example.com/api/catalog', {
        headers: {
          Origin: 'https://example.com',
          'Content-Type': 'text/plain',
        },
      }),
    ),
    false,
  );
  assert.equal(
    sameOriginMutation(
      new Request('https://example.com/api/catalog', {
        headers: {
          Origin: 'https://example.com',
          'Content-Type': 'application/json',
        },
      }),
    ),
    true,
  );
});

// Exercise the actual prepared SQL against SQLite, with a thin D1 API adapter.
function sqliteD1(sqlite: DatabaseSync): D1Database {
  function prepare(sql: string, args: SQLInputValue[] = []): unknown {
    const statement = sqlite.prepare(sql);
    return {
      bind: (...values: SQLInputValue[]) => prepare(sql, values),
      first: async () => statement.get(...args) || null,
      all: async () => ({ results: statement.all(...args) }),
      run: async () => ({
        meta: { changes: Number(statement.run(...args).changes) },
      }),
    };
  }
  return {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
}

void test('schema, seed refresh, ownership and manual edits survive closing the database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sd-catalog-test-')),
    file = join(dir, 'catalog.sqlite');
  let sqlite = new DatabaseSync(file);
  try {
    sqlite.exec(
      readFileSync(
        new URL('../drizzle/0000_ancient_chamber.sql', import.meta.url),
        'utf8',
      ),
    );
    let db = sqliteD1(sqlite);
    await seedCatalog(db, seed, manifest.revision);
    await seedCatalog(db, seed, manifest.revision);
    assert.equal((await readCatalog(db, 'owner')).length, seed.length);
    const entry = validateManualEntry(draft, 'manual-test', now);
    await addCatalogEntry(db, entry, 'owner');
    assert.equal(
      (await readCatalog(db, 'other')).some((r) => r.id === entry.id),
      false,
    );
    assert.equal(
      await updateCatalogEntry(
        db,
        { ...entry, outcome: 'Stolen edit' },
        'other',
      ),
      false,
    );
    assert.equal(
      await updateCatalogEntry(db, { ...entry, id: seed[0].id }, 'owner'),
      false,
    );
    assert.equal(
      await updateCatalogEntry(
        db,
        { ...entry, outcome: 'Corrected result' },
        'owner',
      ),
      true,
    );
    await seedCatalog(db, seed.slice(1), 'second-revision');
    sqlite.close();
    sqlite = new DatabaseSync(file);
    db = sqliteD1(sqlite);
    const saved = await readCatalog(db, 'owner');
    assert.equal(saved.length, seed.length);
    assert.equal(
      saved.find((r) => r.id === entry.id)?.outcome,
      'Corrected result',
    );
    assert.equal(saved.find((r) => r.id === entry.id)?.name, draft.name);
    assert.equal(
      saved.some((r) => r.id === seed[0].id),
      false,
    );
    assert.equal((await readCatalog(db, 'other')).length, seed.length - 1);
  } finally {
    sqlite.close();
    rmSync(dir, { recursive: true });
  }
});
