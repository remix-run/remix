import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import { rawSql } from '../sql.ts'
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts'

export async function computeChecksum(migration: MigrationDescriptor): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(migration.up))
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
      'name varchar(255) not null, ' +
      'checksum varchar(128) not null, ' +
      'batch integer not null, ' +
      'applied_at timestamp not null default current_timestamp' +
      ')',
  )
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
