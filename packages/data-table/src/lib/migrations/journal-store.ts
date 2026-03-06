import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import { rawSql } from '../sql.ts'
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts'

export function normalizeChecksum(migration: MigrationDescriptor): string {
  if (migration.checksum) {
    return migration.checksum
  }

  return migration.id + ':' + migration.name
}

export async function ensureMigrationJournal(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<void> {
  await adapter.migrate({
    operation: {
      kind: 'createTable',
      table: { name: tableName },
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
  try {
    await adapter.execute({
      operation: {
        kind: 'raw',
        sql: rawSql('select 1 from ' + tableName + ' limit 1'),
      },
    })

    return true
  } catch {
    return false
  }
}

export async function loadJournalRows(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<MigrationJournalRow[]> {
  let result = await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql(
        'select id, name, checksum, batch, applied_at from ' + tableName + ' order by id asc',
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
  await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql('insert into ' + tableName + ' (id, name, checksum, batch) values (?, ?, ?, ?)', [
        row.id,
        row.name,
        row.checksum,
        row.batch,
      ]),
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
  await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql('delete from ' + tableName + ' where id = ?', [id]),
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
