import type {
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'

import { compilePostgresStatement } from './sql-compiler.ts'

export type PostgresQueryResult = {
  rows: unknown[]
  rowCount: number | null
}

export type PostgresDatabaseClient = {
  query(text: string, values?: unknown[]): Promise<PostgresQueryResult>
}

export type PostgresTransactionClient = PostgresDatabaseClient & {
  release?: () => void
}

export type PostgresDatabasePool = PostgresDatabaseClient & {
  connect?: () => Promise<PostgresTransactionClient>
}

export type PostgresDatabaseAdapterOptions = {
  capabilities?: {
    returning?: boolean
    savepoints?: boolean
    upsert?: boolean
  }
}

type TransactionState = {
  client: PostgresTransactionClient
  releaseOnClose: boolean
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  dialect = 'postgres'
  capabilities

  #client: PostgresDatabasePool
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0

  constructor(client: PostgresDatabasePool, options?: PostgresDatabaseAdapterOptions) {
    this.#client = client
    this.capabilities = {
      returning: options?.capabilities?.returning ?? true,
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

    let statement = compilePostgresStatement(request.statement)
    let client = this.#resolveClient(request.transaction)
    let result = await client.query(statement.text, statement.values)
    let rows = normalizeRows(result.rows)

    if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
      rows = normalizeCountRows(rows)
    }

    return {
      rows,
      affectedRows: normalizeAffectedRows(request.statement.kind, result.rowCount, rows),
      insertId: normalizeInsertId(request.statement.kind, request.statement, rows),
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    let releaseOnClose = false
    let transactionClient: PostgresTransactionClient

    if (this.#client.connect) {
      transactionClient = await this.#client.connect()
      releaseOnClose = true
    } else {
      transactionClient = this.#client
    }

    await transactionClient.query('begin')

    if (options?.isolationLevel || options?.readOnly !== undefined) {
      await transactionClient.query(buildSetTransactionStatement(options))
    }

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }

    this.#transactions.set(token.id, {
      client: transactionClient,
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
      await transaction.client.query('commit')
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        transaction.client.release?.()
      }
    }
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    try {
      await transaction.client.query('rollback')
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        transaction.client.release?.()
      }
    }
  }

  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('savepoint ' + quoteIdentifier(name))
  }

  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('rollback to savepoint ' + quoteIdentifier(name))
  }

  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('release savepoint ' + quoteIdentifier(name))
  }

  #resolveClient(token: TransactionToken | undefined): PostgresDatabaseClient {
    if (!token) {
      return this.#client
    }

    return this.#transactionClient(token)
  }

  #transactionClient(token: TransactionToken): PostgresTransactionClient {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    return transaction.client
  }
}

export function createPostgresDatabaseAdapter(
  client: PostgresDatabasePool,
  options?: PostgresDatabaseAdapterOptions,
): PostgresDatabaseAdapter {
  return new PostgresDatabaseAdapter(client, options)
}

function buildSetTransactionStatement(options: TransactionOptions): string {
  let parts = ['set transaction']

  if (options.isolationLevel) {
    parts.push('isolation level ' + options.isolationLevel)
  }

  if (options.readOnly !== undefined) {
    parts.push(options.readOnly ? 'read only' : 'read write')
  }

  return parts.join(' ')
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) {
      return {}
    }

    return { ...(row as Record<string, unknown>) }
  })
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

function normalizeAffectedRows(
  kind: AdapterExecuteRequest['statement']['kind'],
  rowCount: number | null,
  rows: Record<string, unknown>[],
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  if (rowCount !== null) {
    return rowCount
  }

  if (kind === 'raw') {
    return undefined
  }

  return rows.length
}

function normalizeInsertId(
  kind: AdapterExecuteRequest['statement']['kind'],
  statement: AdapterExecuteRequest['statement'],
  rows: Record<string, unknown>[],
): unknown {
  if (kind !== 'insert' && kind !== 'insertMany' && kind !== 'upsert') {
    return undefined
  }

  if (
    statement.kind !== 'insert' &&
    statement.kind !== 'insertMany' &&
    statement.kind !== 'upsert'
  ) {
    return undefined
  }

  if (statement.table.primaryKey.length !== 1) {
    return undefined
  }

  let key = statement.table.primaryKey[0]
  let row = rows[rows.length - 1]

  return row ? row[key] : undefined
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}
