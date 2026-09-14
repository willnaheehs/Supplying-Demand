import type { CatalogEntry } from '../lib/catalog.ts';

export async function seedCatalog(
  db: D1Database,
  records: CatalogEntry[],
  revision: string,
) {
  const previous = await db
    .prepare('SELECT value FROM catalog_meta WHERE key = ?')
    .bind('seed_revision')
    .first<{ value: string }>();
  if (previous?.value === revision) return;
  const now = new Date().toISOString();
  // Each chunk is transactional. Mark the revision only after every chunk succeeds;
  // retries update immutable seed ids and never touch the user's manual records.
  for (let offset = 0; offset < records.length; offset += 50) {
    await db.batch(
      records.slice(offset, offset + 50).map((record) =>
        db
          .prepare(
            `INSERT INTO catalog_records (id, system_id, origin, created_by, body, updated_at)
       VALUES (?, ?, 'seed', NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET system_id=excluded.system_id, body=excluded.body, updated_at=excluded.updated_at
       WHERE catalog_records.origin = 'seed'`,
          )
          .bind(record.id, record.systemId, JSON.stringify(record), now),
      ),
    );
  }
  // Remove records withdrawn by the next source snapshot, without touching manual data.
  const existing = await db
    .prepare("SELECT id FROM catalog_records WHERE origin = 'seed'")
    .all<{ id: string }>();
  const ids = new Set(records.map((r) => r.id));
  const retired = existing.results.filter((r) => !ids.has(r.id));
  for (let offset = 0; offset < retired.length; offset += 50) {
    await db.batch(
      retired
        .slice(offset, offset + 50)
        .map((r) =>
          db
            .prepare(
              "DELETE FROM catalog_records WHERE id = ? AND origin = 'seed'",
            )
            .bind(r.id),
        ),
    );
  }
  await db
    .prepare(
      'INSERT INTO catalog_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .bind('seed_revision', revision)
    .run();
}

export async function readCatalog(db: D1Database, userId: string) {
  const rows = await db
    .prepare(
      "SELECT body FROM catalog_records WHERE origin = 'seed' OR created_by = ? ORDER BY updated_at DESC, id",
    )
    .bind(userId)
    .all<{ body: string }>();
  return rows.results.map((row) => JSON.parse(row.body) as CatalogEntry);
}

export async function addCatalogEntry(
  db: D1Database,
  entry: CatalogEntry,
  userId: string,
) {
  await db
    .prepare(
      "INSERT INTO catalog_records (id, system_id, origin, created_by, body, updated_at) VALUES (?, ?, 'manual', ?, ?, ?)",
    )
    .bind(
      entry.id,
      entry.systemId,
      userId,
      JSON.stringify(entry),
      entry.updatedAt!,
    )
    .run();
}

export async function updateCatalogEntry(
  db: D1Database,
  entry: CatalogEntry,
  userId: string,
) {
  const result = await db
    .prepare(
      "UPDATE catalog_records SET system_id = ?, body = ?, updated_at = ? WHERE id = ? AND origin = 'manual' AND created_by = ?",
    )
    .bind(
      entry.systemId,
      JSON.stringify(entry),
      entry.updatedAt!,
      entry.id,
      userId,
    )
    .run();
  return result.meta.changes === 1;
}
