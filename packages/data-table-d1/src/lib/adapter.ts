import type {
  DataManipulationOperation,
  DataManipulationRequest,
  DataManipulationResult,
  DatabaseAdapter,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'

import { compileD1Operation } from './sql-compiler.ts'

export type D1Value = ArrayBuffer | number | string | null

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<row = unknown>(statements: D1PreparedStatement[]): Promise<Array<D1Result<row>>>
  exec(query: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<row = unknown>(colName: string): Promise<row | null>
  first<row = Record<string, unknown>>(): Promise<row | null>
  run<row = Record<string, unknown>>(): Promise<D1Result<row>>
  all<row = Record<string, unknown>>(): Promise<D1Result<row>>
}

export interface D1Result<row = unknown> {
  results?: row[]
  meta: D1Meta
}

export interface D1Meta {
  changes?: number
  last_row_id?: number
}

export interface D1ExecResult {
  count: number
  duration: number
}

/**
 * `DatabaseAdapter` implementation for Cloudflare D1 database bindings.
 */
export class D1DatabaseAdapter implements DatabaseAdapter {
  /**
   * The SQL dialect identifier reported by this adapter.
   */
  dialect = 'd1'

  /**
   * Feature flags describing the D1 behaviors supported by this adapter.
   */
  capabilities

  #database: D1Database

  constructor(database: D1Database) {
    this.#database = database
    this.capabilities = {
      returning: true,
      savepoints: false,
      upsert: true,
      transactionalDdl: false,
      migrationLock: false,
    }
  }

  /**
   * Compiles a data-manipulation operation to D1 SQL statements.
   * @param operation Operation to compile.
   * @returns Compiled SQL statements.
   */
  compileSql(operation: DataManipulationOperation): SqlStatement[] {
    let compiled = compileD1Operation(operation)
    return [{ text: compiled.text, values: compiled.values }]
  }

  /**
   * Executes a D1 data-manipulation request.
   * @param request Request to execute.
   * @returns Execution result.
   */
  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.transaction) {
      throwUnknownTransaction(request.transaction)
    }

    if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.operation.returning ? [] : undefined,
      }
    }

    let statement = this.compileSql(request.operation)[0]
    let result = await this.#database
      .prepare(statement.text)
      .bind(...normalizeStatementValues(statement.values))
      .run<Record<string, unknown>>()
    let rows = normalizeRows(result.results ?? [])

    if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
      rows = normalizeCountRows(rows)
    }

    return {
      rows: shouldReturnRows(request.operation, rows) ? rows : undefined,
      affectedRows: normalizeAffectedRows(request.operation.kind, result, rows),
      insertId: normalizeInsertId(request.operation, result, rows),
    }
  }

  /**
   * Executes a multi-statement D1 SQL script.
   * @param sql SQL script to execute.
   * @param transaction Optional transaction token (unsupported by D1).
   * @returns A promise that resolves once execution completes.
   */
  async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
    if (transaction) {
      throwUnknownTransaction(transaction)
    }

    await this.#database.exec(sql)
  }

  /**
   * Checks whether a table exists in D1.
   * @param table Table reference to inspect.
   * @param transaction Optional transaction token (unsupported by D1).
   * @returns `true` when the table exists.
   */
  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    if (transaction) {
      throwUnknownTransaction(transaction)
    }

    let masterTable = table.schema
      ? quoteIdentifier(table.schema) + '.sqlite_master'
      : 'sqlite_master'
    let result = await this.#database
      .prepare('select 1 from ' + masterTable + ' where type = ? and name = ? limit 1')
      .bind('table', table.name)
      .run<Record<string, unknown>>()

    return normalizeRows(result.results ?? []).length > 0
  }

  async hasColumn(
    table: TableRef,
    column: string,
    transaction?: TransactionToken,
  ): Promise<boolean> {
    if (transaction) {
      throwUnknownTransaction(transaction)
    }

    let schemaPrefix = table.schema ? quoteIdentifier(table.schema) + '.' : ''
    let result = await this.#database
      .prepare('pragma ' + schemaPrefix + 'table_info(' + quoteIdentifier(table.name) + ')')
      .run<Record<string, unknown>>()

    return normalizeRows(result.results ?? []).some((row) => row.name === column)
  }

  async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
    throw new Error('D1DatabaseAdapter does not support data-table interactive transactions')
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    throwUnknownTransaction(token)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    throwUnknownTransaction(token)
  }

  async createSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throwUnknownTransaction(token)
  }

  async rollbackToSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throwUnknownTransaction(token)
  }

  async releaseSavepoint(token: TransactionToken, _name: string): Promise<void> {
    throwUnknownTransaction(token)
  }
}

/**
 * Creates a Cloudflare D1 `DatabaseAdapter`.
 * @param database Cloudflare D1 database binding.
 * @returns A configured D1 adapter.
 * @example
 * ```ts
 * import { createDatabase } from 'remix/data-table'
 * import { createD1DatabaseAdapter } from 'remix/data-table/d1'
 *
 * let db = createDatabase(createD1DatabaseAdapter(env.DB))
 * ```
 */
export function createD1DatabaseAdapter(database: D1Database): D1DatabaseAdapter {
  return new D1DatabaseAdapter(database)
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (typeof row !== 'object' || row === null) {
      return {}
    }

    return { ...(row as Record<string, unknown>) }
  })
}

function normalizeStatementValues(values: unknown[]): D1Value[] {
  return values.map(normalizeStatementValue)
}

function normalizeStatementValue(value: unknown): D1Value {
  if (value === undefined) {
    return null
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value === null || typeof value === 'number' || typeof value === 'string') {
    return value
  }

  if (value instanceof ArrayBuffer) {
    return value
  }

  throw new TypeError('Unsupported D1 bound value: ' + String(value))
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

    return row
  })
}

function shouldReturnRows(
  operation: DataManipulationRequest['operation'],
  rows: Record<string, unknown>[],
): boolean {
  if (operation.kind === 'select' || operation.kind === 'count' || operation.kind === 'exists') {
    return true
  }

  if (operation.kind === 'raw') {
    return rows.length > 0
  }

  return operation.returning !== undefined
}

function normalizeAffectedRows(
  kind: DataManipulationRequest['operation']['kind'],
  result: D1Result<Record<string, unknown>>,
  rows: Record<string, unknown>[],
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  if (isWriteOperationKind(kind) && rows.length > 0) {
    return rows.length
  }

  return result.meta.changes
}

function normalizeInsertId(
  operation: DataManipulationRequest['operation'],
  result: D1Result<Record<string, unknown>>,
  rows: Record<string, unknown>[],
): unknown {
  if (!isInsertOperation(operation)) {
    return undefined
  }

  let primaryKey = getTablePrimaryKey(operation.table)

  if (primaryKey.length !== 1) {
    return undefined
  }

  let key = primaryKey[0]
  let row = rows[rows.length - 1]

  if (row) {
    return row[key]
  }

  return result.meta.last_row_id
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function throwUnknownTransaction(token: TransactionToken): never {
  throw new Error('Unknown transaction token: ' + token.id)
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
