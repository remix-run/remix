import type {
  AdapterCapabilityOverrides,
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'

import { compileMysqlStatement } from './sql-compiler.ts'

/**
 * Row-array response shape for mysql query calls.
 */
export type MysqlQueryRows = Record<string, unknown>[]

/**
 * Metadata shape for mysql write results.
 */
export type MysqlQueryResultHeader = {
  affectedRows: number
  insertId: unknown
}

/**
 * Supported mysql `query()` response tuple.
 */
export type MysqlQueryResponse = [result: unknown, fields?: unknown]

/**
 * Single mysql connection contract used by this adapter.
 */
export type MysqlDatabaseConnection = {
  query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release?: () => void
}

/**
 * Mysql pool contract used by this adapter.
 */
export type MysqlDatabasePool = {
  query(text: string, values?: unknown[]): Promise<MysqlQueryResponse>
  getConnection(): Promise<MysqlDatabaseConnection>
}

/**
 * Mysql adapter configuration.
 */
export type MysqlDatabaseAdapterOptions = {
  capabilities?: AdapterCapabilityOverrides
}

type TransactionState = {
  connection: MysqlDatabaseConnection
  releaseOnClose: boolean
}

type MysqlQueryable = MysqlDatabasePool | MysqlDatabaseConnection

/**
 * `DatabaseAdapter` implementation for mysql-compatible clients.
 */
export class MysqlDatabaseAdapter implements DatabaseAdapter {
  dialect = 'mysql'
  capabilities

  #client: MysqlQueryable
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0

  constructor(client: MysqlQueryable, options?: MysqlDatabaseAdapterOptions) {
    this.#client = client
    this.capabilities = {
      returning: options?.capabilities?.returning ?? false,
      savepoints: options?.capabilities?.savepoints ?? true,
      upsert: options?.capabilities?.upsert ?? true,
    }
  }

  async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
    if (request.statement.kind === 'insertMany' && request.statement.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.statement.returning ? [] : undefined,
      }
    }

    let statement = compileMysqlStatement(request.statement)
    let client = this.#resolveClient(request.transaction)
    let [result] = await client.query(statement.text, statement.values)

    if (isRowsResult(result)) {
      let rows = normalizeRows(result)

      if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
        rows = normalizeCountRows(rows)
      }

      return { rows }
    }

    let header = normalizeHeader(result)

    return {
      affectedRows: header.affectedRows,
      insertId: normalizeInsertId(request.statement.kind, request.statement, header),
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    let releaseOnClose = false
    let connection: MysqlDatabaseConnection

    if (isMysqlPool(this.#client)) {
      connection = await this.#client.getConnection()
      releaseOnClose = true
    } else {
      connection = this.#client
    }

    if (options?.isolationLevel) {
      await connection.query('set transaction isolation level ' + options.isolationLevel)
    }

    if (options?.readOnly !== undefined) {
      await connection.query(
        options.readOnly ? 'set transaction read only' : 'set transaction read write',
      )
    }

    await connection.beginTransaction()

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }

    this.#transactions.set(token.id, {
      connection,
      releaseOnClose,
    })

    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    try {
      await transaction.connection.commit()
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        transaction.connection.release?.()
      }
    }
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    try {
      await transaction.connection.rollback()
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        transaction.connection.release?.()
      }
    }
  }

  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('savepoint ' + quoteIdentifier(name))
  }

  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('rollback to savepoint ' + quoteIdentifier(name))
  }

  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    let connection = this.#transactionConnection(token)
    await connection.query('release savepoint ' + quoteIdentifier(name))
  }

  #resolveClient(token: TransactionToken | undefined): MysqlDatabaseConnection | MysqlDatabasePool {
    if (!token) {
      return this.#client
    }

    return this.#transactionConnection(token)
  }

  #transactionConnection(token: TransactionToken): MysqlDatabaseConnection {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    return transaction.connection
  }
}

/**
 * Creates a mysql `DatabaseAdapter`.
 * @param client Mysql pool or connection.
 * @param options Optional adapter capability overrides.
 * @returns A configured mysql adapter.
 */
export function createMysqlDatabaseAdapter(
  client: MysqlQueryable,
  options?: MysqlDatabaseAdapterOptions,
): MysqlDatabaseAdapter {
  return new MysqlDatabaseAdapter(client, options)
}

function isMysqlPool(client: MysqlQueryable): client is MysqlDatabasePool {
  return typeof (client as MysqlDatabasePool).getConnection === 'function'
}

function isRowsResult(result: unknown): result is MysqlQueryRows {
  return Array.isArray(result) && (result.length === 0 || !Array.isArray(result[0]))
}

function normalizeRows(rows: MysqlQueryRows): Record<string, unknown>[] {
  return rows.map((row) => ({ ...row }))
}

function normalizeHeader(result: unknown): MysqlQueryResultHeader {
  if (typeof result === 'object' && result !== null) {
    let header = result as { affectedRows?: unknown; insertId?: unknown }

    return {
      affectedRows: typeof header.affectedRows === 'number' ? header.affectedRows : 0,
      insertId: header.insertId,
    }
  }

  return {
    affectedRows: 0,
    insertId: undefined,
  }
}

function normalizeCountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    let count = row.count

    if (typeof count === 'string') {
      let numeric = Number(count)

      if (!Number.isNaN(numeric)) {
        return {
          ...row,
          count: numeric,
        }
      }
    }

    if (typeof count === 'bigint') {
      return {
        ...row,
        count: Number(count),
      }
    }

    return row
  })
}

function normalizeInsertId(
  kind: AdapterExecuteRequest['statement']['kind'],
  statement: AdapterExecuteRequest['statement'],
  header: MysqlQueryResultHeader,
): unknown {
  if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
    return undefined
  }

  if (getTablePrimaryKey(statement.table).length !== 1) {
    return undefined
  }

  return header.insertId
}

function quoteIdentifier(value: string): string {
  return '`' + value.replace(/`/g, '``') + '`'
}

function isInsertStatementKind(kind: AdapterExecuteRequest['statement']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertStatement(
  statement: AdapterExecuteRequest['statement'],
): statement is Extract<AdapterExecuteRequest['statement'], { kind: 'insert' | 'insertMany' | 'upsert' }> {
  return statement.kind === 'insert' || statement.kind === 'insertMany' || statement.kind === 'upsert'
}
