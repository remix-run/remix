import { dirname } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'

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

import { compileSqliteOperation } from './sql-compiler.ts'

/**
 * Synchronous SQLite database client accepted by the sqlite adapter.
 *
 * This matches the shared surface of Node's `node:sqlite` `DatabaseSync`, Bun's `bun:sqlite`
 * `Database`, and compatible synchronous SQLite clients.
 */
export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  exec(sql: string): unknown
  close?: () => void
}

type SqliteDatabaseConstructor = {
  new (path: string): SqliteDatabase
}

type SqliteDriverModule = {
  Database?: SqliteDatabaseConstructor
  DatabaseSync?: SqliteDatabaseConstructor
}

let loadedDriverConstructor: SqliteDatabaseConstructor | undefined

// The runtime driver loads lazily on config-backed construction so client-backed adapters
// keep working in environments that cannot resolve node:sqlite or bun:sqlite at import time,
// and so bundlers never try to resolve those specifiers statically.
function loadSqliteDatabaseConstructor(): SqliteDatabaseConstructor {
  if (!loadedDriverConstructor) {
    if ('Bun' in globalThis) {
      // import.meta.require is Bun's synchronous require for ES modules; Bun does not
      // implement process.getBuiltinModule
      let importMeta = import.meta as ImportMeta & { require?: (id: string) => unknown }
      let driver = importMeta.require?.('bun:sqlite') as SqliteDriverModule | undefined
      loadedDriverConstructor = driver?.Database
    } else {
      // process.getBuiltinModule loads node:sqlite synchronously (Node.js 22.3+)
      let driver = globalThis.process?.getBuiltinModule?.('node:sqlite') as
        | SqliteDriverModule
        | undefined
      loadedDriverConstructor = driver?.DatabaseSync
    }

    if (!loadedDriverConstructor) {
      throw new Error(
        'SQLite adapter config-based construction requires node:sqlite (Node.js 22.5+) or bun:sqlite; pass a SQLite database client instead',
      )
    }
  }

  return loadedDriverConstructor
}

/** Configuration for an adapter-owned SQLite database. */
export interface SqliteDatabaseAdapterConfig {
  /** SQLite database filename or `:memory:` for an in-memory database. */
  filename: string
  /**
   * Enables SQLite foreign key enforcement whenever the adapter opens the database.
   * Defaults to `false` (enforcement off) on every runtime, including Node.js where
   * `node:sqlite` would otherwise enable it by default.
   */
  foreignKeys?: boolean
  /**
   * SQLite `busy_timeout` in milliseconds, applied whenever the adapter opens the database.
   * Defaults to `5000`. Set `0` to fail immediately when another process holds a write lock.
   */
  busyTimeout?: number
}

/**
 * Prepared statement shape used by {@link SqliteDatabase}.
 */
export interface SqliteStatement {
  all(...values: unknown[]): unknown[]
  get(...values: unknown[]): unknown
  run(...values: unknown[]): SqliteRunResult
  reader?: boolean
  columns?: () => unknown[]
  columnNames?: string[]
}

/**
 * SQLite write execution metadata.
 */
export interface SqliteRunResult {
  changes: number | bigint
  lastInsertRowid: unknown
}

/**
 * `DatabaseAdapter` implementation for synchronous SQLite clients.
 */
export class SqliteDatabaseAdapter implements DatabaseAdapter {
  /**
   * The SQL dialect identifier reported by this adapter.
   */
  dialect = 'sqlite'

  /**
   * Feature flags describing the sqlite behaviors supported by this adapter.
   */
  capabilities

  #config?: SqliteDatabaseAdapterConfig
  #database: SqliteDatabase
  #transactions = new Set<string>()
  #transactionCounter = 0

  constructor(input: SqliteDatabase | SqliteDatabaseAdapterConfig) {
    if (isSqliteDatabase(input)) {
      this.#database = input
    } else {
      this.#config = input
      this.#database = openSqliteDatabase(input)
    }
    this.capabilities = {
      returning: true,
      savepoints: true,
      upsert: true,
      transactionalDdl: true,
      migrationLock: false,
    }
  }

  /**
   * Compiles a data-manipulation operation to sqlite SQL statements.
   * @param operation Operation to compile.
   * @returns Compiled SQL statements.
   */
  compileSql(operation: DataManipulationOperation): SqlStatement[] {
    let compiled = compileSqliteOperation(operation)
    return [{ text: compiled.text, values: compiled.values }]
  }

  /**
   * Executes a sqlite data-manipulation request.
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

    if (request.transaction) {
      this.#assertTransaction(request.transaction)
    }

    let statement = this.compileSql(request.operation)[0]
    let prepared = this.#database.prepare(statement.text)
    let values = normalizeStatementValues(statement.values)

    if (shouldReadStatement(request.operation, prepared)) {
      let rows = normalizeRows(prepared.all(...values))

      if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
        rows = normalizeCountRows(rows)
      }

      return {
        rows,
        affectedRows: normalizeAffectedRowsForReader(request.operation.kind, rows),
        insertId: normalizeInsertIdForReader(request.operation.kind, request.operation, rows),
      }
    }

    let result = prepared.run(...values)

    return {
      affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
      insertId: normalizeInsertIdForRun(request.operation.kind, request.operation, result),
    }
  }

  /**
   * Executes a multi-statement sqlite SQL script.
   * @param sql SQL script to execute.
   * @param transaction Optional transaction token (asserted when present).
   * @returns A promise that resolves once execution completes.
   */
  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    if (transaction) {
      this.#assertTransaction(transaction)
    }

    this.#database.exec(sql)
  }

  /**
   * Checks whether a table exists in sqlite.
   * @param table Table reference to inspect.
   * @param transaction Optional transaction token.
   * @returns `true` when the table exists.
   */
  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    if (transaction) {
      this.#assertTransaction(transaction)
    }

    let masterTable = table.schema
      ? quoteIdentifier(table.schema) + '.sqlite_master'
      : 'sqlite_master'
    let statement = this.#database.prepare(
      'select 1 from ' + masterTable + ' where type = ? and name = ? limit 1',
    )
    // node:sqlite returns `undefined` for a missing row while bun:sqlite returns `null`
    let row = statement.get('table', table.name)
    return row != null
  }

  /**
   * Checks whether a column exists in sqlite.
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
    if (transaction) {
      this.#assertTransaction(transaction)
    }

    let schemaPrefix = table.schema ? quoteIdentifier(table.schema) + '.' : ''
    let statement = this.#database.prepare(
      'pragma ' + schemaPrefix + 'table_info(' + quoteIdentifier(table.name) + ')',
    )
    let rows = statement.all() as Array<Record<string, unknown>>

    return rows.some((row) => row.name === column)
  }

  /**
   * Destructively recreates the configured SQLite database.
   * @returns A promise that resolves when the database is ready for use.
   */
  async wipe(): Promise<void> {
    let config = this.#configOrThrow('wipe')
    this.#assertNoOpenTransactions('wipe')
    this.#database.close?.()

    if (config.filename === ':memory:') {
      this.#replaceDatabase()
      return
    }

    try {
      await mkdir(dirname(config.filename), { recursive: true })
      await rm(config.filename, { force: true })
      // SQLite associates a database file with -wal/-shm/-journal sidecars by path, so
      // stale sidecars left next to a freshly created database are a corruption vector
      await rm(config.filename + '-wal', { force: true })
      await rm(config.filename + '-shm', { force: true })
      await rm(config.filename + '-journal', { force: true })
    } finally {
      this.#replaceDatabase()
    }
  }

  /**
   * Starts a sqlite transaction.
   * @param options Transaction options.
   * @returns Transaction token.
   */
  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    if (options?.isolationLevel === 'read uncommitted') {
      this.#database.exec('pragma read_uncommitted = true')
    }

    this.#database.exec('begin')

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }
    this.#transactions.add(token.id)

    return token
  }

  /**
   * Commits an open sqlite transaction.
   * @param token Transaction token to commit.
   * @returns A promise that resolves when the transaction is committed.
   */
  async commitTransaction(token: TransactionToken): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('commit')
    this.#transactions.delete(token.id)
  }

  /**
   * Rolls back an open sqlite transaction.
   * @param token Transaction token to roll back.
   * @returns A promise that resolves when the transaction is rolled back.
   */
  async rollbackTransaction(token: TransactionToken): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('rollback')
    this.#transactions.delete(token.id)
  }

  /**
   * Creates a savepoint in an open sqlite transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is created.
   */
  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('savepoint ' + quoteIdentifier(name))
  }

  /**
   * Rolls back to a savepoint in an open sqlite transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the rollback completes.
   */
  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('rollback to savepoint ' + quoteIdentifier(name))
  }

  /**
   * Releases a savepoint in an open sqlite transaction.
   * @param token Transaction token to use.
   * @param name Savepoint name.
   * @returns A promise that resolves when the savepoint is released.
   */
  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('release savepoint ' + quoteIdentifier(name))
  }

  #replaceDatabase(): void {
    if (this.#config) {
      this.#database = openSqliteDatabase(this.#config)
    }
  }

  #configOrThrow(method: string): SqliteDatabaseAdapterConfig {
    if (!this.#config) {
      throw new Error('SQLite adapter ' + method + '() requires config-based construction')
    }

    return this.#config
  }

  #assertNoOpenTransactions(method: string): void {
    if (this.#transactions.size > 0) {
      throw new Error('SQLite adapter cannot ' + method + ' while transactions are open')
    }
  }

  #assertTransaction(token: TransactionToken): void {
    if (!this.#transactions.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}

function openSqliteDatabase(config: SqliteDatabaseAdapterConfig): SqliteDatabase {
  let SqliteDatabaseConstructor = loadSqliteDatabaseConstructor()
  let database = new SqliteDatabaseConstructor(config.filename)

  // node:sqlite enables foreign keys by default while bun:sqlite follows SQLite's default
  // (off), so set the pragma explicitly to make the option authoritative on both runtimes
  database.exec('pragma foreign_keys = ' + (config.foreignKeys ? 'on' : 'off'))
  // node:sqlite defaults to busy_timeout 0, which fails immediately with SQLITE_BUSY when
  // another process holds a write lock
  database.exec('pragma busy_timeout = ' + String(config.busyTimeout ?? 5000))

  return database
}

/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param input SQLite adapter configuration or synchronous database client.
 * @returns A configured sqlite adapter.
 * @example
 * ```ts
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'
 *
 * let adapter = createSqliteDatabaseAdapter({ filename: './data/app.db' })
 * let db = createDatabase(adapter)
 * ```
 */
export function createSqliteDatabaseAdapter(
  input: SqliteDatabase | SqliteDatabaseAdapterConfig,
): SqliteDatabaseAdapter {
  return new SqliteDatabaseAdapter(input)
}

function isSqliteDatabase(
  input: SqliteDatabase | SqliteDatabaseAdapterConfig,
): input is SqliteDatabase {
  return (
    'prepare' in input &&
    typeof input.prepare === 'function' &&
    'exec' in input &&
    typeof input.exec === 'function'
  )
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) {
      return {}
    }

    return { ...(row as Record<string, unknown>) }
  })
}

function normalizeStatementValues(values: unknown[]): unknown[] {
  return values.map((value) => (value === undefined ? null : value))
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

function normalizeAffectedRowsForReader(
  kind: DataManipulationRequest['operation']['kind'],
  rows: Record<string, unknown>[],
): number | undefined {
  if (isWriteOperationKind(kind)) {
    return rows.length
  }

  return undefined
}

function normalizeInsertIdForReader(
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

function normalizeAffectedRowsForRun(
  kind: DataManipulationRequest['operation']['kind'],
  result: SqliteRunResult,
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  return Number(result.changes)
}

function normalizeInsertIdForRun(
  kind: DataManipulationRequest['operation']['kind'],
  operation: DataManipulationRequest['operation'],
  result: SqliteRunResult,
): unknown {
  if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
    return undefined
  }

  if (getTablePrimaryKey(operation.table).length !== 1) {
    return undefined
  }

  return result.lastInsertRowid
}

function shouldReadStatement(
  operation: DataManipulationRequest['operation'],
  statement: SqliteStatement,
): boolean {
  if (operation.kind === 'select' || operation.kind === 'count' || operation.kind === 'exists') {
    return true
  }

  if (operation.kind !== 'raw') {
    return operation.returning !== undefined
  }

  if (typeof statement.reader === 'boolean') {
    return statement.reader
  }

  if (statement.columns) {
    return statement.columns().length > 0
  }

  try {
    return statement.columnNames !== undefined && statement.columnNames.length > 0
  } catch {
    return false
  }
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function isWriteOperationKind(kind: DataManipulationRequest['operation']['kind']): boolean {
  return (
    kind === 'insert' ||
    kind === 'insertMany' ||
    kind === 'update' ||
    kind === 'delete' ||
    kind === 'upsert'
  )
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
