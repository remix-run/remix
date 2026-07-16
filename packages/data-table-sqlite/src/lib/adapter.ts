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

const SqliteDatabaseConstructor: SqliteDatabaseConstructor =
  'Bun' in globalThis
    ? // @ts-expect-error TypeScript does not resolve Bun built-in modules in this repo yet.
      (await import('bun:sqlite')).Database
    : (await import('node:sqlite')).DatabaseSync

type SqliteAdapterConfig = {
  filename: string
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

  #config?: SqliteAdapterConfig
  #database: SqliteDatabase
  #transactions = new Set<string>()
  #transactionCounter = 0

  constructor(input: SqliteDatabase | SqliteAdapterConfig) {
    if (isSqliteAdapterConfig(input)) {
      this.#config = input
      this.#database = new SqliteDatabaseConstructor(input.filename)
    } else {
      this.#database = input
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
    let row = statement.get('table', table.name)
    return row !== undefined
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
   * Starts a sqlite transaction.
   * @param options Transaction options.
   * @returns Transaction token.
   */
  async create(): Promise<void> {
    if (!this.#config) {
      return
    }

    await mkdir(dirname(this.#config.filename), { recursive: true })
    let database = new SqliteDatabaseConstructor(this.#config.filename)
    database.close?.()
    this.#replaceDatabase()
  }

  async drop(): Promise<void> {
    this.#transactions.clear()
    this.#database.close?.()

    if (!this.#config) {
      return
    }

    await rm(this.#config.filename, { force: true })
    this.#replaceDatabase()
  }

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
      this.#database = new SqliteDatabaseConstructor(this.#config.filename)
    }
  }

  #assertTransaction(token: TransactionToken): void {
    if (!this.#transactions.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}

/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param input SQLite adapter configuration.
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
export function createSqliteDatabaseAdapter(input: SqliteAdapterConfig): SqliteDatabaseAdapter {
  return new SqliteDatabaseAdapter(input)
}

function isSqliteAdapterConfig(input: SqliteDatabase | SqliteAdapterConfig): input is SqliteAdapterConfig {
  return 'filename' in input && typeof input.filename === 'string'
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
