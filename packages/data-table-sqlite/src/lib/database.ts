import { createDatabase, type Database, type DatabaseResource } from '@remix-run/data-table'

import { createSqliteDatabaseAdapter, type SqliteDatabase } from './adapter.ts'

const IS_BUN = typeof process.versions.bun === 'string'

type Pragmas = {
  foreignKeys: boolean
  journalMode: 'delete' | 'truncate' | 'persist' | 'memory' | 'wal' | 'off'
  synchronous: 'off' | 'normal' | 'full' | 'extra'
  busyTimeoutMs: number
}

type NativeSqliteDatabase = SqliteDatabase & {
  close?: () => void
}

type NativeSqliteDatabaseConstructor = {
  new (path: string): NativeSqliteDatabase
}

export function createSqliteDatabase(options: {
  path: string
  pragmas?: Partial<Pragmas>
  now?: () => unknown
}): DatabaseResource {
  let database: NativeSqliteDatabase | undefined
  let connected: Database | undefined

  return {
    async connect(): Promise<Database> {
      if (connected) {
        return connected
      }

      let database = await createNativeSqliteDatabase(options.path)
      applyPragmas(database, options.pragmas)
      connected = createDatabase(createSqliteDatabaseAdapter(database), { now: options.now })
      return connected
    },

    async close(): Promise<void> {
      database?.close?.()
      database = undefined
      connected = undefined
    },

    async [Symbol.asyncDispose](): Promise<void> {
      await this.close()
    },
  }
}

async function createNativeSqliteDatabase(path: string): Promise<SqliteDatabase> {
  if (IS_BUN) {
    // @ts-expect-error TypeScript does not resolve Bun built-in modules in this repo yet.
    let { Database } = await import('bun:sqlite')
    return new Database(path)
  }

  let { DatabaseSync } = await import('node:sqlite')
  return new DatabaseSync(path)
}

function applyPragmas(database: SqliteDatabase, pragmas: Partial<Pragmas> = {}): void {
  let foreignKeys = pragmas.foreignKeys ?? true
  let journalMode = pragmas.journalMode ?? 'wal'
  let synchronous = pragmas.synchronous ?? 'normal'

  database.exec('PRAGMA foreign_keys = ' + formatBooleanPragma(foreignKeys))
  database.exec('PRAGMA journal_mode = ' + journalMode.toUpperCase())
  database.exec('PRAGMA synchronous = ' + synchronous.toUpperCase())

  if (pragmas.busyTimeoutMs !== undefined) {
    database.exec('PRAGMA busy_timeout = ' + String(pragmas.busyTimeoutMs))
  }
}

function formatBooleanPragma(value: boolean): string {
  return value ? 'ON' : 'OFF'
}
