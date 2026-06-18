import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import { rawSql } from '../sql.ts'
import type { Migration } from '../migrations.ts'

export type MigrationJournalRow = {
  id: string
  hash: string
  batch: number
  appliedAt: Date
}

export async function computeMigrationHash(migration: Migration): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(migration.sql))
  return bytesToHex(new Uint8Array(digest))
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''

  for (let byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }

  return hex
}

export async function ensureMigrationJournal(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<void> {
  await adapter.executeScript(
    'create table if not exists ' +
      tableName +
      ' (' +
      'id varchar(64) not null primary key, ' +
      'hash varchar(128) not null, ' +
      'batch integer not null, ' +
      'applied_at timestamp not null default current_timestamp' +
      ')',
  )
}

export async function loadJournalRows(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<MigrationJournalRow[]> {
  let result = await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql('select id, hash, batch, applied_at from ' + tableName + ' order by id asc'),
    },
  })

  let rows = result.rows ?? []

  return rows.map((row) => ({
    id: String(row.id),
    hash: String(row.hash),
    batch: Number(row.batch),
    appliedAt: new Date(String(row.applied_at)),
  }))
}

export async function insertJournalRow(
  adapter: DatabaseAdapter,
  tableName: string,
  row: {
    id: string
    hash: string
    batch: number
  },
  transaction?: TransactionToken,
): Promise<void> {
  await adapter.execute({
    operation: {
      kind: 'raw',
      sql: rawSql('insert into ' + tableName + ' (id, hash, batch) values (?, ?, ?)', [
        row.id,
        row.hash,
        row.batch,
      ]),
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
