import type {
  AdapterCapabilityOverrides,
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'

import { compileMssqlStatement } from './sql-compiler.ts'

/**
 * Result shape returned by mssql `query()` calls.
 */
export type MssqlQueryResult = {
  recordset?: unknown[]
  rowsAffected?: number[]
}

/**
 * Minimal mssql request contract used internally by this adapter.
 */
type MssqlDatabaseRequest = {
  input(name: string, value: unknown): MssqlDatabaseRequest
  query(text: string): Promise<MssqlQueryResult>
}

/**
 * Minimal mssql client contract used by this adapter.
 */
export type MssqlDatabaseClient = {
  request(): MssqlDatabaseRequest
}

/**
 * Mssql transaction client with begin/commit/rollback lifecycle.
 */
export type MssqlDatabaseTransaction = MssqlDatabaseClient & {
  begin(): Promise<unknown>
  commit(): Promise<void>
  rollback(): Promise<void>
}

/**
 * Mssql pool-like client contract used by this adapter.
 */
export type MssqlDatabasePool = MssqlDatabaseClient & {
  query(command: string): Promise<MssqlQueryResult>
  transaction(): MssqlDatabaseTransaction
}

/**
 * Mssql adapter configuration.
 */
export type MssqlDatabaseAdapterOptions = {
  capabilities?: AdapterCapabilityOverrides
}

/**
 * `DatabaseAdapter` implementation for mssql-compatible pools.
 */
export class MssqlDatabaseAdapter implements DatabaseAdapter {
  dialect = 'mssql'
  capabilities

  #client: MssqlDatabasePool
  #transactions = new Map<string, MssqlDatabaseTransaction>()
  #transactionCounter = 0

  constructor(client: MssqlDatabasePool, options?: MssqlDatabaseAdapterOptions) {
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

    let statement = compileMssqlStatement(request.statement)
    let client = this.#resolveClient(request.transaction)
    let result = await runMssqlQuery(client, statement.text, statement.values)
    let rows = normalizeRows(result.recordset ?? [])

    if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
      rows = normalizeCountRows(rows)
    }

    return {
      rows,
      affectedRows: normalizeAffectedRows(request.statement.kind, result.rowsAffected),
      insertId: normalizeInsertId(request.statement.kind, request.statement, rows),
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    let transaction = this.#client.transaction()
    await transaction.begin()

    if (options?.isolationLevel) {
      await runMssqlQuery(transaction, 'set transaction isolation level ' + options.isolationLevel)
    }

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }

    this.#transactions.set(token.id, transaction)

    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactionClient(token)

    try {
      await transaction.commit()
    } finally {
      this.#transactions.delete(token.id)
    }
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactionClient(token)

    try {
      await transaction.rollback()
    } finally {
      this.#transactions.delete(token.id)
    }
  }

  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let transaction = this.#transactionClient(token)
    await runMssqlQuery(transaction, 'save transaction ' + quoteIdentifier(name))
  }

  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let transaction = this.#transactionClient(token)
    await runMssqlQuery(transaction, 'rollback transaction ' + quoteIdentifier(name))
  }

  // MSSQL does not support RELEASE SAVEPOINT — this is intentionally a no-op.
  async releaseSavepoint(token: TransactionToken, _name: string): Promise<void> {
    this.#transactionClient(token)
  }

  #resolveClient(token: TransactionToken | undefined): MssqlDatabaseClient {
    if (!token) {
      return this.#client
    }

    return this.#transactionClient(token)
  }

  #transactionClient(token: TransactionToken): MssqlDatabaseTransaction {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    return transaction
  }
}

/**
 * Creates a mssql `DatabaseAdapter`.
 * @param client Mssql connection pool.
 * @param options Optional adapter capability overrides.
 * @returns A configured mssql adapter.
 */
export function createMssqlDatabaseAdapter(
  client: MssqlDatabasePool,
  options?: MssqlDatabaseAdapterOptions,
): MssqlDatabaseAdapter {
  return new MssqlDatabaseAdapter(client, options)
}

async function runMssqlQuery(
  client: MssqlDatabaseClient,
  text: string,
  values: unknown[] = [],
): Promise<MssqlQueryResult> {
  let request = client.request()

  for (let index = 0; index < values.length; index += 1) {
    request.input('p' + String(index + 1), values[index])
  }

  return request.query(text)
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
  rowsAffected: number[] | undefined,
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists' || kind === 'raw') {
    return undefined
  }

  if (!rowsAffected || rowsAffected.length === 0) {
    return undefined
  }

  let total = 0

  for (let amount of rowsAffected) {
    total += amount
  }

  return total
}

function normalizeInsertId(
  kind: AdapterExecuteRequest['statement']['kind'],
  statement: AdapterExecuteRequest['statement'],
  rows: Record<string, unknown>[],
): unknown {
  if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
    return undefined
  }

  let primaryKey = getTablePrimaryKey(statement.table)

  if (primaryKey.length !== 1) {
    return undefined
  }

  let key = primaryKey[0]
  let row = rows[rows.length - 1]

  return row ? row[key] : undefined
}

function quoteIdentifier(value: string): string {
  return '[' + value.replace(/]/g, ']]') + ']'
}

function isInsertStatementKind(kind: AdapterExecuteRequest['statement']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertStatement(
  statement: AdapterExecuteRequest['statement'],
): statement is Extract<
  AdapterExecuteRequest['statement'],
  { kind: 'insert' | 'insertMany' | 'upsert' }
> {
  return (
    statement.kind === 'insert' || statement.kind === 'insertMany' || statement.kind === 'upsert'
  )
}
