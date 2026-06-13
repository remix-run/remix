import { createDatabase, type Database, type DatabaseResource } from '@remix-run/data-table'
import { Pool } from 'pg'

import { createPostgresDatabaseAdapter } from './adapter.ts'

type PostgresDatabaseOptions = (UrlConnectionOptions | SplitConnectionOptions) & {
  ssl?:
    | boolean
    | {
        ca?: string
        cert?: string
        key?: string
        rejectUnauthorized?: boolean
      }
  pool?: {
    max?: number
    idleTimeoutMs?: number
    connectTimeoutMs?: number
  }
  statementTimeoutMs?: number
  now?: () => unknown
}

type UrlConnectionOptions = {
  url: string
  host?: never
  port?: never
  database?: never
  user?: never
  password?: never
}

type SplitConnectionOptions = {
  url?: never
  host: string
  port?: number
  database: string
  user: string
  password?: string
}

export function createPostgresDatabase(options: PostgresDatabaseOptions): DatabaseResource {
  let pool = new Pool(toPoolConfig(options))

  return {
    async connect(): Promise<Database> {
      let client = await pool.connect()
      return createDatabase(createPostgresDatabaseAdapter(client), { now: options.now })
    },

    async close(): Promise<void> {
      await pool.end()
    },

    async [Symbol.asyncDispose](): Promise<void> {
      await this.close()
    },
  }
}

function toPoolConfig(options: PostgresDatabaseOptions) {
  return {
    connectionString: options.url,
    host: options.host,
    port: options.port,
    database: options.database,
    user: options.user,
    password: options.password,
    ssl: options.ssl,
    max: options.pool?.max,
    idleTimeoutMillis: options.pool?.idleTimeoutMs,
    connectionTimeoutMillis: options.pool?.connectTimeoutMs,
    statement_timeout: options.statementTimeoutMs,
  }
}
