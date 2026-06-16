import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createDatabase, type Database, type DatabaseResource } from '@remix-run/data-table'

import {
  createSqliteDatabaseAdapter,
  SqliteDatabaseAdapter,
  type SqliteDatabase,
} from './adapter.ts'

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

export function createSqliteDatabase(options: {
  path: string
  pragmas?: Partial<Pragmas>
  now?: () => unknown
}): DatabaseResource {
  let closed = false
  let isInMemoryDatabase = false

  return {
    async create(): Promise<void> {
      if (options.path === ':memory:') {
        throw new Error('SQLite :memory: database resources do not support create()')
      }

      await fs.mkdir(path.dirname(options.path), { recursive: true })
      let conn = await createNativeSqliteDatabase(options.path)
      conn.close?.()
    },

    async connect(): Promise<Database> {
      if (closed) {
        throw new Error('Cannot connect to a closed SQLite database resource')
      }

      if (options.path === ':memory:') {
        if (isInMemoryDatabase) {
          throw new Error(
            'SQLite :memory: database resources only support one connection. Use a file-backed SQLite database when multiple connections need to share state.',
          )
        }

        isInMemoryDatabase = true
      }

      let conn = await createNativeSqliteDatabase(options.path)
      applyPragmas(conn, options.pragmas)

      let adapter = createSqliteDatabaseAdapter(conn) as SqliteDatabaseAdapter & {
        close(): Promise<void>
      }
      adapter.close = async () => conn.close?.()

      return createDatabase(adapter, { now: options.now })
    },

    async drop(): Promise<void> {
      if (options.path === ':memory:') {
        throw new Error('SQLite :memory: database resources do not support drop()')
      }

      await fs.rm(options.path, { force: true })
      await fs.rm(options.path + '-shm', { force: true })
      await fs.rm(options.path + '-wal', { force: true })
      await fs.rm(options.path + '-journal', { force: true })
    },

    async close(): Promise<void> {
      closed = true
    },

    async [Symbol.asyncDispose](): Promise<void> {
      await this.close()
    },
  }
}

async function createNativeSqliteDatabase(path: string): Promise<NativeSqliteDatabase> {
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
