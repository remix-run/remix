import type {
  AdapterCapabilityOverrides,
  AdapterExecuteRequest,
  AdapterResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'
import type { Database as BetterSqliteDatabase, RunResult } from 'better-sqlite3'

import { compileSqliteStatement } from './sql-compiler.ts'

/**
 * Better SQLite3 database handle accepted by the sqlite adapter.
 */
export type SqliteDatabaseConnection = BetterSqliteDatabase

/**
 * Sqlite adapter configuration.
 */
export type SqliteDatabaseAdapterOptions = {
  capabilities?: AdapterCapabilityOverrides
}

/**
 * `DatabaseAdapter` implementation for Better SQLite3.
 */
export class SqliteDatabaseAdapter implements DatabaseAdapter {
  dialect = 'sqlite'
  capabilities

  #database: SqliteDatabaseConnection
  #transactions = new Set<string>()
  #transactionCounter = 0

  constructor(database: SqliteDatabaseConnection, options?: SqliteDatabaseAdapterOptions) {
    this.#database = database
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

    let statement = compileSqliteStatement(request.statement)
    let prepared = this.#database.prepare(statement.text)

    if (prepared.reader) {
      let rows = normalizeRows(prepared.all(...statement.values))

      if (request.statement.kind === 'count' || request.statement.kind === 'exists') {
        rows = normalizeCountRows(rows)
      }

      return {
        rows,
        affectedRows: normalizeAffectedRowsForReader(request.statement.kind, rows),
        insertId: normalizeInsertIdForReader(request.statement.kind, request.statement, rows),
      }
    }

    let result = prepared.run(...statement.values)

    return {
      affectedRows: normalizeAffectedRowsForRun(request.statement.kind, result),
      insertId: normalizeInsertIdForRun(request.statement.kind, request.statement, result),
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
    if (options?.isolationLevel === 'read uncommitted') {
      this.#database.pragma('read_uncommitted = true')
    }

    this.#database.exec('begin')

    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }
    this.#transactions.add(token.id)

    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('commit')
    this.#transactions.delete(token.id)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('rollback')
    this.#transactions.delete(token.id)
  }

  async createSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('savepoint ' + quoteIdentifier(name))
  }

  async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('rollback to savepoint ' + quoteIdentifier(name))
  }

  async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
    this.#assertTransaction(token)
    this.#database.exec('release savepoint ' + quoteIdentifier(name))
  }

  #assertTransaction(token: TransactionToken): void {
    if (!this.#transactions.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}

/**
 * Creates a sqlite `DatabaseAdapter`.
 * @param database Better SQLite3 database instance.
 * @param options Optional adapter capability overrides.
 * @returns A configured sqlite adapter.
 */
export function createSqliteDatabaseAdapter(
  database: SqliteDatabaseConnection,
  options?: SqliteDatabaseAdapterOptions,
): SqliteDatabaseAdapter {
  return new SqliteDatabaseAdapter(database, options)
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

function normalizeAffectedRowsForReader(
  kind: AdapterExecuteRequest['statement']['kind'],
  rows: Record<string, unknown>[],
): number | undefined {
  if (isWriteStatementKind(kind)) {
    return rows.length
  }

  return undefined
}

function normalizeInsertIdForReader(
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

function normalizeAffectedRowsForRun(
  kind: AdapterExecuteRequest['statement']['kind'],
  result: RunResult,
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  return result.changes
}

function normalizeInsertIdForRun(
  kind: AdapterExecuteRequest['statement']['kind'],
  statement: AdapterExecuteRequest['statement'],
  result: RunResult,
): unknown {
  if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
    return undefined
  }

  if (getTablePrimaryKey(statement.table).length !== 1) {
    return undefined
  }

  return result.lastInsertRowid
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function isWriteStatementKind(kind: AdapterExecuteRequest['statement']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'update' || kind === 'delete' || kind === 'upsert'
}

function isInsertStatementKind(kind: AdapterExecuteRequest['statement']['kind']): boolean {
  return kind === 'insert' || kind === 'insertMany' || kind === 'upsert'
}

function isInsertStatement(
  statement: AdapterExecuteRequest['statement'],
): statement is Extract<AdapterExecuteRequest['statement'], { kind: 'insert' | 'insertMany' | 'upsert' }> {
  return statement.kind === 'insert' || statement.kind === 'insertMany' || statement.kind === 'upsert'
}
