import { createHash } from 'node:crypto'
import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import { quoteTableRef } from '../sql-helpers.ts'
import { rawSql } from '../sql.ts'
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts'
import { toTableRef } from './helpers.ts'

/**
 * Returns a stable content-based checksum for a migration.
 *
 * If the descriptor already carries an explicit `checksum` (e.g. supplied by
 * a file-based registry that hashed the source on disk), that value is used
 * as-is.  Otherwise a SHA-256 digest of the `up` and `down` function source
 * text is computed.  This catches accidental edits to already-applied
 * migrations that would previously have gone undetected because the fallback
 * only used the migration `id` and `name`.
 * @param migration Migration descriptor to normalize.
 * @returns Stable checksum string.
 */
export function normalizeChecksum(migration: MigrationDescriptor): string {
  if (migration.checksum) {
    return migration.checksum
  }

  let content = migration.migration.up.toString() + '\n' + migration.migration.down.toString()
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Quotes an individual SQL identifier using ANSI double-quote syntax.
 * This is supported by SQLite, PostgreSQL, and MySQL (in ANSI mode).
 * @param value Identifier text to quote.
 * @returns Quoted SQL identifier.
 */
function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

/**
 * Returns a fully-quoted SQL table reference for use in raw journal SQL.
 * Handles optional schema-qualified names (e.g. "myschema.migrations").
 * @param tableName Journal table name, optionally schema-qualified.
 * @returns Fully quoted table reference.
 */
function quoteJournalTable(tableName: string): string {
  return quoteTableRef(toTableRef(tableName), quoteIdentifier)
}

export async function ensureMigrationJournal(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<void> {
  await adapter.migrate({
    operation: {
      kind: 'createTable',
      table: toTableRef(tableName),
      ifNotExists: true,
      columns: {
        id: { type: 'varchar', length: 64, nullable: false, primaryKey: true },
        name: { type: 'varchar', length: 255, nullable: false },
        checksum: { type: 'varchar', length: 128, nullable: false },
        batch: { type: 'integer', nullable: false },
        applied_at: { type: 'timestamp', nullable: false, default: { kind: 'now' } },
      },
    },
  })
}

export async function hasMigrationJournal(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<boolean> {
  return adapter.hasTable(toTableRef(tableName))
}

export async function loadJournalRows(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<MigrationJournalRow[]> {
  let quotedTable = quoteJournalTable(tableName)

  let result = await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql(
        'select id, name, checksum, batch, applied_at from ' + quotedTable + ' order by id asc',
      ),
    },
  })

  let rows = result.rows ?? []

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    checksum: String(row.checksum),
    batch: Number(row.batch),
    appliedAt: new Date(String(row.applied_at)),
  }))
}

export async function insertJournalRow(
  adapter: DatabaseAdapter,
  tableName: string,
  row: {
    id: string
    name: string
    checksum: string
    batch: number
  },
  transaction?: TransactionToken,
): Promise<void> {
  let quotedTable = quoteJournalTable(tableName)

  await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql(
        'insert into ' + quotedTable + ' (id, name, checksum, batch) values (?, ?, ?, ?)',
        [row.id, row.name, row.checksum, row.batch],
      ),
    },
    transaction,
  })
}

export async function deleteJournalRow(
  adapter: DatabaseAdapter,
  tableName: string,
  id: string,
  transaction?: TransactionToken,
): Promise<void> {
  let quotedTable = quoteJournalTable(tableName)

  await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql('delete from ' + quotedTable + ' where id = ?', [id]),
    },
    transaction,
  })
}

export function getBatch(rows: MigrationJournalRow[]): number {
  if (rows.length === 0) {
    return 1
  }

  let max = Math.max(...rows.map((row) => row.batch))
  return max + 1
}
