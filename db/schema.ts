import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const catalogRecords = sqliteTable(
  'catalog_records',
  {
    id: text('id').primaryKey(),
    systemId: text('system_id').notNull(),
    origin: text('origin').notNull(),
    createdBy: text('created_by'),
    body: text('body').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_catalog_origin_owner').on(table.origin, table.createdBy),
  ],
);

export const catalogMeta = sqliteTable('catalog_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
