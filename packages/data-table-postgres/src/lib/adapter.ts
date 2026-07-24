import type {
  DataManipulationResult,
  SqlStatement,
  TableRef,
  TransactionOptions,
} from '@remix-run/data-table'
import {
  DatabaseImplementation,
  type DataManipulationOperation,
  type DataManipulationRequest,
  type DatabaseOptions,
  type MigrationLockContext,
  type TransactionToken,
} from '@remix-run/data-table/database-implementation'
import { AsyncLocalStorage } from 'node:async_hooks'

import { getTablePrimaryKey } from '@remix-run/data-table'
import pg from 'pg'
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

type PostgresPoolConfig = ConstructorParameters<typeof pg.Pool>[0]
type PostgresClientConfig = ConstructorParameters<typeof pg.Client>[0]

/** Database recreation options for a config-backed PostgreSQL implementation. */
export interface PostgresDatabaseImplementationOptions extends DatabaseOptions {
  /** Database used while dropping and recreating the configured database (`postgres` by default). */
  maintenanceDatabase?: string
  /** Template used to recreate the configured database (`template0` by default). */
  template?: string
}

type PostgresQueryable = PostgresClient | PostgresPool | PostgresPoolClient

const postgresCapabilities = Object.freeze({
  returning: true,
  savepoints: true,
  upsert: true,
  transactionalDdl: true,
  migrationLock: true,
})

export type PostgresDatabaseInput = PostgresPoolConfig | PostgresQueryable

/**
 * PostgreSQL database implementation for postgres-compatible clients.
 */
export class PostgresDatabaseImplementation extends DatabaseImplementation {
  /**
   * The SQL dialect identifier reported by this database.
   */
  override get dialect(): 'postgres' {
    return 'postgres'
  }

  /**
   * Feature flags describing the PostgreSQL behaviors supported by this database.
   */
  override get capabilities() {
    return postgresCapabilities
  }

  #config?: PostgresPoolConfig
  #client: PostgresQueryable
  #maintenanceDatabase: string
  #template: string
  #transactions = new Map<string, TransactionState>()
  #transactionCounter = 0
  #migrationLockQueue = Promise.resolve()
  #migrationLockStore = new AsyncLocalStorage<boolean>()
  #poolClosed = false

  constructor(config: PostgresDatabaseInput, options: PostgresDatabaseImplementationOptions = {}) {
    super(options)
    if (isPostgresQueryable(config)) {
      this.#client = config
    } else {
      this.#config = config
      this.#client = new pg.Pool(config)
    }

    this.#maintenanceDatabase = options.maintenanceDatabase ?? 'postgres'
    this.#template = options.template ?? 'template0'
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

    try {
      await transactionClient.query('begin')

      if (options?.isolationLevel || options?.readOnly !== undefined) {
        await transactionClient.query(buildSetTransactionStatement(options))
      }
    } catch (error) {
      if (releaseOnClose) {
        destroyPostgresClient(transactionClient, error)
      }
      throw error
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

    let failure: unknown
    try {
      await transaction.client.query('commit')
    } catch (error) {
      failure = error
      throw error
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        if (failure === undefined) {
          releasePostgresClient(transaction.client)
        } else {
          destroyPostgresClient(transaction.client, failure)
        }
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

    let failure: unknown
    try {
      await transaction.client.query('rollback')
    } catch (error) {
      failure = error
      throw error
    } finally {
      this.#transactions.delete(token.id)

      if (transaction.releaseOnClose) {
        if (failure === undefined) {
          releasePostgresClient(transaction.client)
        } else {
          destroyPostgresClient(transaction.client, failure)
        }
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
   * Destructively recreates the configured PostgreSQL database.
   * @returns A promise that resolves when the database is ready for use.
   */
  async wipe(): Promise<void> {
    let config = this.#configOrThrow('wipe')
    this.#assertNoOpenTransactions('wipe')
    let database = resolvePostgresDatabaseName(config)
    // Resolve the maintenance config before closing the pool so a config
    // error cannot leave the database without a usable pool.
    let maintenanceConfig = this.#maintenanceConfig(database)
    await this.#closePool()
    let maintenance: PostgresClient | undefined

    try {
      maintenance = new pg.Client(maintenanceConfig)
      await maintenance.connect()
      await maintenance.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
        [database],
      )
      await maintenance.query('drop database if exists ' + quoteIdentifier(database))
      await maintenance.query(
        'create database ' +
          quoteIdentifier(database) +
          ' template ' +
          quoteIdentifier(this.#template),
      )
    } finally {
      try {
        await maintenance?.end()
      } finally {
        await this.#replacePool()
      }
    }
  }

  /** Closes a pool created from configuration. Supplied clients and pools remain caller-owned. */
  async close(): Promise<void> {
    this.#assertNoOpenTransactions('close')
    if (this.#config) {
      await this.#closePool()
    }
  }

  /**
   * Runs migration work on the postgres connection that owns the advisory lock.
   *
   * Lock acquisition waits up to 60 seconds and throws when the lock cannot
   * be acquired. Re-entering this method from inside `run` throws instead of
   * deadlocking, and a failed run destroys the reserved connection instead of
   * returning it to the pool.
   * @param name Logical migration lock name.
   * @param run Migration work to run with a connection-bound adapter.
   * @returns The callback result.
   */
  async withMigrationLock<result>(
    name: string,
    run: (database: MigrationLockContext) => Promise<result>,
  ): Promise<result> {
    if (this.#migrationLockStore.getStore()) {
      throw new Error('Postgres migration lock is already held by this database')
    }

    let waitForPreviousLock = this.#migrationLockQueue
    let releaseQueue: () => void = () => undefined
    this.#migrationLockQueue = new Promise((resolve) => {
      releaseQueue = resolve
    })

    await waitForPreviousLock

    try {
      let releaseOnClose = false
      let client: PostgresClient | PostgresPoolClient

      if (isPostgresPool(this.#client)) {
        client = await this.#client.connect()
        releaseOnClose = true
      } else {
        client = this.#client
      }

      let adapter = releaseOnClose ? new PostgresDatabaseImplementation(client) : this

      try {
        let value = await this.#migrationLockStore.run(true, () =>
          runWithPostgresMigrationLock(client, name, adapter, run),
        )

        if (releaseOnClose) {
          releasePostgresClient(client)
        }

        return value
      } catch (error) {
        // A failed run can leave the reserved session dirty (aborted
        // transaction, still-held advisory lock), so destroy the connection
        // instead of returning it to the pool.
        if (releaseOnClose) {
          destroyPostgresClient(client, error)
        }

        throw error
      }
    } finally {
      releaseQueue()
    }
  }

  async #closePool(): Promise<void> {
    this.#transactions.clear()
    // pg pools reject end() when called twice, so ending must be tracked to
    // keep close() idempotent.
    if (isPostgresPool(this.#client) && !this.#poolClosed) {
      this.#poolClosed = true
      await this.#client.end()
    }
  }

  #configOrThrow(method: string): PostgresPoolConfig {
    if (!this.#config) {
      throw new Error('Postgres database ' + method + '() requires config-based construction')
    }

    return this.#config
  }

  #assertNoOpenTransactions(method: string): void {
    if (this.#transactions.size > 0) {
      throw new Error('Postgres database cannot ' + method + ' while transactions are open')
    }
  }

  #maintenanceConfig(targetDatabase: string): PostgresClientConfig {
    let maintenanceDatabase = this.#maintenanceDatabase

    if (maintenanceDatabase === targetDatabase) {
      maintenanceDatabase = targetDatabase === 'postgres' ? 'template1' : 'postgres'
    }

    let config = this.#configOrThrow('maintenance')
    let connectionString = replaceDatabaseInConnectionString(
      config?.connectionString,
      maintenanceDatabase,
    )

    return { ...config, connectionString, database: maintenanceDatabase }
  }

  async #replacePool(): Promise<void> {
    await this.#closePool().catch(() => undefined)
    if (this.#config) {
      this.#client = new pg.Pool(this.#config)
      this.#poolClosed = false
    }
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

function isPostgresQueryable(value: unknown): value is PostgresQueryable {
  return typeof value === 'object' && value !== null && 'query' in value
}

function isPostgresPool(client: PostgresQueryable): client is PostgresPool {
  if (client instanceof pg.Client) {
    return false
  }

  return 'connect' in client && typeof client.connect === 'function' && !('release' in client)
}

function resolvePostgresDatabaseName(config: PostgresPoolConfig): string {
  let database =
    resolveDatabaseNameFromConnectionString(config?.connectionString) ??
    config?.database ??
    process.env.PGDATABASE

  if (!database) {
    throw new Error('Postgres database config requires a database name')
  }

  return database
}

function replaceDatabaseInConnectionString(
  connectionString: string | undefined,
  database: string,
): string | undefined {
  if (!connectionString) {
    return undefined
  }

  let url: URL

  try {
    url = new URL(connectionString)
  } catch (cause) {
    throw new Error(
      'Postgres connection string must be a valid URL to resolve the maintenance database',
      { cause },
    )
  }

  url.pathname = '/' + encodeURIComponent(database)
  return url.toString()
}

function resolveDatabaseNameFromConnectionString(
  connectionString: string | undefined,
): string | undefined {
  if (!connectionString) {
    return undefined
  }

  try {
    let url = new URL(connectionString)
    let database = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return database || undefined
  } catch {
    return undefined
  }
}

function releasePostgresClient(client: PostgresClient | PostgresPoolClient): void {
  let release = (client as { release?: () => void }).release
  release?.()
}

function destroyPostgresClient(client: PostgresClient | PostgresPoolClient, error: unknown): void {
  let release = (client as { release?: (destroy?: Error | boolean) => void }).release

  if (typeof release === 'function') {
    // A truthy argument tells pg to destroy the client instead of pooling it.
    release.call(client, error instanceof Error ? error : true)
    return
  }

  void (client as PostgresClient).end().catch(() => undefined)
}

// Matches the 60 second wait bound used by the MySQL adapter's get_lock().
const MIGRATION_LOCK_TIMEOUT_MS = 60_000

async function runWithPostgresMigrationLock<result>(
  client: PostgresClient | PostgresPoolClient,
  name: string,
  adapter: PostgresDatabaseImplementation,
  run: (database: MigrationLockContext) => Promise<result>,
): Promise<result> {
  await client.query('set lock_timeout to ' + String(MIGRATION_LOCK_TIMEOUT_MS))

  try {
    await client.query('select pg_advisory_lock(hashtext($1))', [name])
  } catch (cause) {
    await client.query('set lock_timeout to default').catch(() => undefined)
    throw new Error('Postgres migration lock could not be acquired', { cause })
  }

  await client.query('set lock_timeout to default')

  let outcome: { status: 'success'; value: result } | { status: 'failure'; error: unknown }

  try {
    outcome = { status: 'success', value: await run(adapter) }
  } catch (error) {
    outcome = { status: 'failure', error }
  }

  let unlockFailed = false
  let unlockError: unknown

  try {
    let result = await client.query('select pg_advisory_unlock(hashtext($1)) as "released"', [name])
    let row = result.rows[0] as Record<string, unknown> | undefined

    if (!toBooleanExists(row?.released)) {
      throw new Error('Postgres migration lock was not held by the reserved connection')
    }
  } catch (error) {
    unlockFailed = true
    unlockError = error
  }

  if (outcome.status === 'failure') {
    throw outcome.error
  }

  if (unlockFailed) {
    throw unlockError
  }

  return outcome.value
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
