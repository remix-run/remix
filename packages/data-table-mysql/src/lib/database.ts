import { createDatabase, type Database, type DatabaseResource } from '@remix-run/data-table'
import { createConnection, createPool } from 'mysql2/promise'

import { createMysqlDatabaseAdapter, type MysqlDatabaseAdapter } from './adapter.ts'

type MysqlDatabaseOptions = (UrlConnectionOptions | SplitConnectionOptions) & {
  ssl?:
    | string
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
  timezone?: string
  decimalNumbers?: boolean
  multipleStatements?: boolean
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

export function createMysqlDatabase(options: MysqlDatabaseOptions): DatabaseResource {
  let pool = createPool(toPoolConfig(options))

  return {
    async create(): Promise<void> {
      let database = getDatabaseName(options)
      let connection = await createConnection(toMaintenanceConnectionConfig(options))

      try {
        await connection.query('create database ' + quoteIdentifier(database))
      } finally {
        await connection.end()
      }
    },

    async connect(): Promise<Database> {
      let connection = await pool.getConnection()
      let adapter = createMysqlDatabaseAdapter(connection) as MysqlDatabaseAdapter & {
        release(): Promise<void>
      }
      adapter.release = async () => {
        connection.release()
      }
      return createDatabase(adapter, { now: options.now })
    },

    async drop(): Promise<void> {
      let database = getDatabaseName(options)
      let connection = await createConnection(toMaintenanceConnectionConfig(options))

      try {
        await connection.query('drop database if exists ' + quoteIdentifier(database))
      } finally {
        await connection.end()
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

function toPoolConfig(options: MysqlDatabaseOptions) {
  return {
    uri: options.url,
    host: options.host,
    port: options.port,
    database: options.database,
    user: options.user,
    password: options.password,
    ssl: options.ssl,
    connectionLimit: options.pool?.max,
    idleTimeout: options.pool?.idleTimeoutMs,
    connectTimeout: options.pool?.connectTimeoutMs,
    timezone: options.timezone,
    decimalNumbers: options.decimalNumbers,
    multipleStatements: options.multipleStatements,
  }
}

function toMaintenanceConnectionConfig(options: MysqlDatabaseOptions) {
  if (options.url) {
    let url = new URL(options.url)
    url.pathname = ''
    return {
      uri: url.toString(),
      ssl: options.ssl,
      connectTimeout: options.pool?.connectTimeoutMs,
      timezone: options.timezone,
      decimalNumbers: options.decimalNumbers,
      multipleStatements: options.multipleStatements,
    }
  }

  return {
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    ssl: options.ssl,
    connectTimeout: options.pool?.connectTimeoutMs,
    timezone: options.timezone,
    decimalNumbers: options.decimalNumbers,
    multipleStatements: options.multipleStatements,
  }
}

function getDatabaseName(options: MysqlDatabaseOptions): string {
  if (options.url === undefined) {
    return options.database
  }

  let database = decodeURIComponent(new URL(options.url).pathname.slice(1))

  if (!database) {
    throw new Error('MySQL database URL must include a database name')
  }

  return database
}

function quoteIdentifier(identifier: string): string {
  return '`' + identifier.replaceAll('`', '``') + '`'
}
