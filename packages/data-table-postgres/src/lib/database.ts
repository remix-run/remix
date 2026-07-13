import { createDatabase, type Database, type DatabaseResource } from '@remix-run/data-table'
import { Client, Pool } from 'pg'

import { createPostgresDatabaseAdapter, type PostgresDatabaseAdapter } from './adapter.ts'

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
    async create(): Promise<void> {
      let database = getDatabaseName(options)
      let client = new Client(toMaintenanceClientConfig(options))

      try {
        await client.connect()
        await client.query('create database ' + quoteIdentifier(database))
      } finally {
        await client.end()
      }
    },

    async connect(): Promise<Database> {
      let client = await pool.connect()
      let adapter = createPostgresDatabaseAdapter(client) as PostgresDatabaseAdapter & {
        release(): Promise<void>
      }
      adapter.release = async () => {
        client.release()
      }
      return createDatabase(adapter, { now: options.now })
    },

    async drop(): Promise<void> {
      let database = getDatabaseName(options)
      let client = new Client(toMaintenanceClientConfig(options))

      try {
        await client.connect()
        await client.query('drop database if exists ' + quoteIdentifier(database) + ' with (force)')
      } finally {
        await client.end()
      }
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

function toMaintenanceClientConfig(options: PostgresDatabaseOptions) {
  if (options.url) {
    let url = new URL(options.url)
    url.pathname = '/postgres'
    return {
      connectionString: url.toString(),
      ssl: options.ssl,
      statement_timeout: options.statementTimeoutMs,
    }
  }

  return {
    host: options.host,
    port: options.port,
    database: 'postgres',
    user: options.user,
    password: options.password,
    ssl: options.ssl,
    statement_timeout: options.statementTimeoutMs,
  }
}

function getDatabaseName(options: PostgresDatabaseOptions): string {
  if (options.url === undefined) {
    return options.database
  }

  let database = decodeURIComponent(new URL(options.url).pathname.slice(1))

  if (!database) {
    throw new Error('Postgres database URL must include a database name')
  }

  return database
}

function quoteIdentifier(identifier: string): string {
  return '"' + identifier.replaceAll('"', '""') + '"'
}
