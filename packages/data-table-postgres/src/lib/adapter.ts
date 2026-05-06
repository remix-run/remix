import type {
  DataManipulationRequest,
  DataManipulationResult,
  DataManipulationOperation,
  DatabaseAdapter,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'
import type {
  Client as PostgresClient,
  Pool as PostgresPool,
  PoolClient as PostgresPoolClient,
} from 'pg'

import { compilePostgresOperation } from './sql-compiler.ts'

type TransactionState = {
  client: PostgresClient | PostgresPoolClient
  releaseOnClose: boolean
}

type PostgresQueryable = PostgresClient | PostgresPool | PostgresPoolClient

/**
 * `DatabaseAdapter` implementation for postgres-compatible clients.
 */
export class PostgresDatabaseAdapter implements DatabaseAdapter {
  /**
   * The SQL dialect identifier reported by this adapter.
   */
  dialect = 'postgres'

  /**
   * Feature flags describing the postgres behaviors supported by this adapter.
   */
  capabilities

  #client: PostgresQueryable
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0

  constructor(client: PostgresQueryable) {
    this.#client = client
    this.capabilities = {
      returning: true,
      savepoints: true,
      upsert: true,
      transactionalDdl: true,
      migrationLock: true,
    }
  }

  /**
   * Compiles a data-manipulation operation to postgres SQL statements.
   * @param operation Operation to compile.
   * @returns Compiled SQL statements.
   */
  compileSql(operation: DataManipulationOperation): SqlStatement[] {
    let compiled = compilePostgresOperation(operation)
    return [{ text: compiled.text, values: compiled.values }]
  }

  /**
   * Executes a postgres data-manipulation request.
   * @param request Request to execute.
   * @returns Execution result.
   */
  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.operation.returning ? [] : undefined,
      }
    }

    let statement = compilePostgresOperation(request.operation)
    let client = this.#resolveClient(request.transaction)
    let result = await client.query(statement.text, statement.values)
    let rows = normalizeRows(result.rows)

    if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
      rows = normalizeCountRows(rows)
    }

    return {
      rows,
      affectedRows: normalizeAffectedRows(request.operation.kind, result.rowCount, rows),
      insertId: normalizeInsertId(request.operation.kind, request.operation, rows),
    }
  }

  /**
   * Executes a multi-statement postgres SQL script.
   *
   * Postgres natively supports multi-statement scripts when `query` is called
   * without a parameter array.
   * @param sql SQL script to execute.
   * @param transaction Optional transaction token.
   * @returns A promise that resolves once execution completes.
   */
  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    let client = this.#resolveClient(transaction)
    await client.query(sql)
  }

  /**
   * Checks whether a table exists in postgres.
   * @param table Table reference to inspect.
   * @param transaction Optional transaction token.
   * @returns `true` when the table exists.
   */
  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    let relation = toPostgresRelationName(table)
    let client = this.#resolveClient(transaction)
    let result = await client.query('select to_regclass($1) is not null as "exists"', [relation])
    let row = result.rows[0] as Record<string, unknown> | undefined
    return toBooleanExists(row?.exists)
  }

  /**
   * Checks whether a column exists in postgres.
   * @param table Table reference to inspect.
   * @param column Column name to look up.
   * @param transaction Optional transaction token.
   * @returns `true` when the column exists.
   */
  async hasColumn(
    table: TableRef,
    column: string,
    transaction?: TransactionToken,
  ): Promise<boolean> {
    let relation = toPostgresRelationName(table)
    let client = this.#resolveClient(transaction)
    let result = await client.query(
      'select exists (select 1 from pg_attribute where attrelid = to_regclass($1) and attname = $2 and attnum > 0 and not attisdropped) as "exists"',
      [relation, column],
    )
    let row = result.rows[0] as Record<string, unknown> | undefined
    return toBooleanExists(row?.exists)
  }

  /**
   * Starts a postgres transaction.
   * @param options Transaction options.
   * @returns Transaction token.
   */
  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    let releaseOnClose = false
    let transactionClient: PostgresClient | PostgresPoolClient

    if (isPostgresPool(this.#client)) {
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

  /**
   * Commits an open postgres transaction.
   * @param token Transaction token to commit.
   * @returns A promise that resolves when the transaction is committed.
   */
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
        releasePostgresClient(transaction.client)
      }
    }
  }

  /**
   * Rolls back an open postgres transaction.
   * @param token Transaction token to roll back.
   * @returns A promise that resolves when the transaction is rolled back.
   */
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
        releasePostgresClient(transaction.client)
      }
    }
  }

  /**
   * Creates a savepoint in an open postgres transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is created.
   */
  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('savepoint ' + quoteIdentifier(name))
  }

  /**
   * Rolls back to a savepoint in an open postgres transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the rollback completes.
   */
  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('rollback to savepoint ' + quoteIdentifier(name))
  }

  /**
   * Releases a savepoint in an open postgres transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is released.
   */
  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    let client = this.#transactionClient(token)
    await client.query('release savepoint ' + quoteIdentifier(name))
  }

  /**
   * Acquires the postgres migration lock.
   * @returns A promise that resolves when the lock is acquired.
   */
  async acquireMigrationLock(): Promise<void> {
    await this.#client.query('select pg_advisory_lock(hashtext($1))', ['data_table_migrations'])
  }

  /**
   * Releases the postgres migration lock.
   * @returns A promise that resolves when the lock is released.
   */
  async releaseMigrationLock(): Promise<void> {
    await this.#client.query('select pg_advisory_unlock(hashtext($1))', ['data_table_migrations'])
  }

  #resolveClient(token: TransactionToken | undefined): PostgresQueryable {
    if (!token) {
      return this.#client
    }

    return this.#transactionClient(token)
  }

  #transactionClient(token: TransactionToken): PostgresClient | PostgresPoolClient {
    let transaction = this.#transactions.get(token.id)

    if (!transaction) {
      throw new Error('Unknown transaction token: ' + token.id)
    }

    return transaction.client
  }
}

/**
 * Creates a postgres `DatabaseAdapter`.
 * @param client `pg` pool or pool client.
 * @param options Optional adapter capability overrides.
 * @returns A configured postgres adapter.
 * @example
 * ```ts
 * import { Pool } from 'pg'
 * import { createDatabase } from 'remix/data-table'
 * import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'
 *
 * let pool = new Pool({ connectionString: process.env.DATABASE_URL })
 * let adapter = createPostgresDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
 */
export function createPostgresDatabaseAdapter(client: PostgresQueryable): PostgresDatabaseAdapter {
  return new PostgresDatabaseAdapter(client)
}

function isPostgresPool(client: PostgresQueryable): client is PostgresPool {
  return 'connect' in client && typeof client.connect === 'function'
}

function releasePostgresClient(client: PostgresClient | PostgresPoolClient): void {
  let release = (client as { release?: () => void }).release
  release?.()
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
  kind: DataManipulationRequest['operation']['kind'],
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
  kind: DataManipulationRequest['operation']['kind'],
  operation: DataManipulationRequest['operation'],
  rows: Record<string, unknown>[],
): unknown {
  if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
    return undefined
  }

  let primaryKey = getTablePrimaryKey(operation.table)

  if (primaryKey.length !== 1) {
    return undefined
  }

  let key = primaryKey[0]
  let row = rows[rows.length - 1]

  return row ? row[key] : undefined
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function toPostgresRelationName(table: TableRef): string {
  if (table.schema) {
    return quoteIdentifier(table.schema) + '.' + quoteIdentifier(table.name)
  }

  return quoteIdentifier(table.name)
}

function toBooleanExists(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  if (typeof value === 'string') {
    return value === 't' || value === 'true' || value === '1'
  }

  return false
}

function isInsertOperationKind(kind: DataManipulationRequest['operation']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertOperation(
  operation: DataManipulationRequest['operation'],
): operation is Extract<
  DataManipulationRequest['operation'],
  { kind: 'insert' | 'insertMany' | 'upsert' }
> {
  return (
    operation.kind === 'insert' || operation.kind === 'insertMany' || operation.kind === 'upsert'
  )
}

