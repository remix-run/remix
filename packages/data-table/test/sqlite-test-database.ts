import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { DatabaseAdapter } from '../src/lib/adapter.ts'
import type { SqliteDatabaseAdapterOptions } from './sqlite-adapter.ts'
import { createSqliteDatabaseAdapter } from './sqlite-adapter.ts'

export type SqliteTestSeed = Record<string, Array<Record<string, unknown>>>

export type SqliteTestAdapterOptions = {
  returning?: boolean
  savepoints?: boolean
  upsert?: boolean
}

export function createSqliteTestAdapter(
  seed: SqliteTestSeed = {},
  options?: SqliteTestAdapterOptions,
): {
  adapter: DatabaseAdapter
  close(): void
} {
  let sqlite = new BetterSqlite3(':memory:')
  initializeSchema(sqlite)
  seedDatabase(sqlite, seed)

  let adapterOptions: SqliteDatabaseAdapterOptions | undefined = options
    ? {
        capabilities: {
          returning: options.returning,
          savepoints: options.savepoints,
          upsert: options.upsert,
        },
      }
    : undefined

  let adapter = createSqliteDatabaseAdapter(sqlite, adapterOptions)

  return {
    adapter,
    close() {
      sqlite.close()
    },
  }
}

function initializeSchema(database: BetterSqliteDatabase): void {
  database.exec(
    [
      'create table accounts (',
      '  id integer primary key,',
      '  email text not null,',
      '  status text not null,',
      '  created_at text,',
      '  updated_at text',
      ')',
    ].join('\n'),
  )
  database.exec(
    [
      'create table projects (',
      '  id integer primary key,',
      '  account_id integer not null,',
      '  name text,',
      '  archived boolean not null',
      ')',
    ].join('\n'),
  )
  database.exec(
    [
      'create table profiles (',
      '  id integer primary key,',
      '  account_id integer not null,',
      '  display_name text not null',
      ')',
    ].join('\n'),
  )
  database.exec(
    [
      'create table tasks (',
      '  id integer primary key,',
      '  project_id integer not null,',
      '  title text not null,',
      '  state text not null',
      ')',
    ].join('\n'),
  )
  database.exec(
    [
      'create table memberships (',
      '  organization_id integer not null,',
      '  account_id integer not null,',
      '  role text not null,',
      '  primary key (organization_id, account_id)',
      ')',
    ].join('\n'),
  )

  database.exec(`attach database '' as billing`)
  database.exec(
    [
      'create table billing.invoices (',
      '  id integer primary key,',
      '  account_id integer not null,',
      '  total integer not null',
      ')',
    ].join('\n'),
  )
}

function seedDatabase(database: BetterSqliteDatabase, seed: SqliteTestSeed): void {
  for (let tableName in seed) {
    if (!Object.prototype.hasOwnProperty.call(seed, tableName)) {
      continue
    }

    let rows = seed[tableName]

    if (!rows || rows.length === 0) {
      continue
    }

    for (let row of rows) {
      let columns = Object.keys(row)

      if (columns.length === 0) {
        continue
      }

      let placeholders = columns.map(() => '?').join(', ')
      let values = columns.map((column) => normalizeValue(row[column]))
      let statement = database.prepare(
        'insert into ' +
          quoteIdentifier(tableName) +
          ' (' +
          columns.map((column) => quoteIdentifier(column)).join(', ') +
          ') values (' +
          placeholders +
          ')',
      )

      statement.run(...values)
    }
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}
