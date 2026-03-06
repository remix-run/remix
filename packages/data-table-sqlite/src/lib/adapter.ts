import type {
  AdapterCapabilityOverrides,
  DataManipulationRequest,
  DataMigrationRequest,
  DataMigrationResult,
  DataMigrationOperation,
  DataManipulationResult,
  DataManipulationOperation,
  DatabaseAdapter,
  ColumnDefinition,
  SqlStatement,
  TableRef,
  TransactionOptions,
  TransactionToken,
} from '@remix-run/data-table'
import { getTablePrimaryKey } from '@remix-run/data-table'
import {
  isDataManipulationOperation as isDataManipulationOperationHelper,
  quoteLiteral as quoteLiteralHelper,
  quoteTableRef as quoteTableRefHelper,
} from '@remix-run/data-table/sql-helpers'
import type { Database as BetterSqliteDatabase, RunResult } from 'better-sqlite3'

import { compileSqliteOperation } from './sql-compiler.ts'

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
      transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
      migrationLock: options?.capabilities?.migrationLock ?? false,
    }
  }

  compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[] {
    if (isDataManipulationOperation(operation)) {
      let compiled = compileSqliteOperation(operation)
      return [{ text: compiled.text, values: compiled.values }]
    }

    return compileSqliteMigrationOperations(operation)
  }

  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.operation.returning ? [] : undefined,
      }
    }

    let statement = this.compileSql(request.operation)[0]
    let prepared = this.#database.prepare(statement.text)

    if (prepared.reader) {
      let rows = normalizeRows(prepared.all(...statement.values))

      if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
        rows = normalizeCountRows(rows)
      }

      return {
        rows,
        affectedRows: normalizeAffectedRowsForReader(request.operation.kind, rows),
        insertId: normalizeInsertIdForReader(request.operation.kind, request.operation, rows),
      }
    }

    let result = prepared.run(...statement.values)

    return {
      affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
      insertId: normalizeInsertIdForRun(request.operation.kind, request.operation, result),
    }
  }

  async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
    let statements = this.compileSql(request.operation)

    for (let statement of statements) {
      let prepared = this.#database.prepare(statement.text)
      prepared.run(...statement.values)
    }

    return {
      affectedOperations: statements.length,
    }
  }

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
 * @example
 * ```ts
 * import BetterSqlite3 from 'better-sqlite3'
 * import { createDatabase } from 'remix/data-table'
 * import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
 *
 * let sqlite = new BetterSqlite3('./data/app.db')
 * let adapter = createSqliteDatabaseAdapter(sqlite)
 * let db = createDatabase(adapter)
 * ```
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
  result: RunResult,
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  return result.changes
}

function normalizeInsertIdForRun(
  kind: DataManipulationRequest['operation']['kind'],
  operation: DataManipulationRequest['operation'],
  result: RunResult,
): unknown {
  if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
    return undefined
  }

  if (getTablePrimaryKey(operation.table).length !== 1) {
    return undefined
  }

  return result.lastInsertRowid
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function quoteTableRef(table: TableRef): string {
  return quoteTableRefHelper(table, quoteIdentifier)
}

function quoteLiteral(value: unknown): string {
  return quoteLiteralHelper(value, { booleansAsIntegers: true })
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

function isDataManipulationOperation(
  operation: DataManipulationOperation | DataMigrationOperation,
): operation is DataManipulationOperation {
  return isDataManipulationOperationHelper(operation)
}

function compileSqliteMigrationOperations(operation: DataMigrationOperation): SqlStatement[] {
  if (operation.kind === 'raw') {
    return [{ text: operation.sql.text, values: [...operation.sql.values] }]
  }

  if (operation.kind === 'createTable') {
    let columns = Object.keys(operation.columns).map(
      (columnName) =>
        quoteIdentifier(columnName) + ' ' + compileSqliteColumn(operation.columns[columnName]),
    )
    let constraints: string[] = []

    if (operation.primaryKey) {
      constraints.push(
        'constraint ' +
          quoteIdentifier(operation.primaryKey.name) +
          ' primary key (' +
          operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let unique of operation.uniques ?? []) {
      constraints.push(
        'constraint ' +
          quoteIdentifier(unique.name) +
          ' ' +
          'unique (' +
          unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let check of operation.checks ?? []) {
      constraints.push(
        'constraint ' + quoteIdentifier(check.name) + ' ' + 'check (' + check.expression + ')',
      )
    }

    for (let foreignKey of operation.foreignKeys ?? []) {
      let clause =
        'constraint ' +
        quoteIdentifier(foreignKey.name) +
        ' ' +
        'foreign key (' +
        foreignKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ') references ' +
        quoteTableRef(foreignKey.references.table) +
        ' (' +
        foreignKey.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
        ')'

      if (foreignKey.onDelete) {
        clause += ' on delete ' + foreignKey.onDelete
      }

      if (foreignKey.onUpdate) {
        clause += ' on update ' + foreignKey.onUpdate
      }

      constraints.push(clause)
    }

    return [
      {
        text:
          'create table ' +
          (operation.ifNotExists ? 'if not exists ' : '') +
          quoteTableRef(operation.table) +
          ' (' +
          [...columns, ...constraints].join(', ') +
          ')',
        values: [],
      },
    ]
  }

  if (operation.kind === 'alterTable') {
    let statements: SqlStatement[] = []

    for (let change of operation.changes) {
      let sql = 'alter table ' + quoteTableRef(operation.table) + ' '

      if (change.kind === 'addColumn') {
        sql +=
          'add column ' +
          quoteIdentifier(change.column) +
          ' ' +
          compileSqliteColumn(change.definition)
      } else if (change.kind === 'changeColumn') {
        sql +=
          'alter column ' +
          quoteIdentifier(change.column) +
          ' type ' +
          compileSqliteColumnType(change.definition)
      } else if (change.kind === 'renameColumn') {
        sql += 'rename column ' + quoteIdentifier(change.from) + ' to ' + quoteIdentifier(change.to)
      } else if (change.kind === 'dropColumn') {
        sql += 'drop column ' + quoteIdentifier(change.column)
      } else if (change.kind === 'addPrimaryKey') {
        sql +=
          'add primary key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropPrimaryKey') {
        sql += 'drop primary key'
      } else if (change.kind === 'addUnique') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'unique (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropUnique') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'addForeignKey') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'foreign key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ') references ' +
          quoteTableRef(change.constraint.references.table) +
          ' (' +
          change.constraint.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropForeignKey') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'addCheck') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'check (' +
          change.constraint.expression +
          ')'
      } else if (change.kind === 'dropCheck') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
      } else if (change.kind === 'setTableComment') {
        continue
      } else {
        continue
      }

      statements.push({ text: sql, values: [] })
    }

    return statements
  }

  if (operation.kind === 'renameTable') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.from) +
          ' rename to ' +
          quoteIdentifier(operation.to.name),
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropTable') {
    return [
      {
        text:
          'drop table ' + (operation.ifExists ? 'if exists ' : '') + quoteTableRef(operation.table),
        values: [],
      },
    ]
  }

  if (operation.kind === 'createIndex') {
    return [
      {
        text:
          'create ' +
          (operation.index.unique ? 'unique ' : '') +
          'index ' +
          (operation.ifNotExists ? 'if not exists ' : '') +
          quoteIdentifier(operation.index.name) +
          ' on ' +
          quoteTableRef(operation.index.table) +
          ' (' +
          operation.index.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')' +
          (operation.index.where ? ' where ' + operation.index.where : ''),
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropIndex') {
    return [
      {
        text:
          'drop index ' +
          (operation.ifExists ? 'if exists ' : '') +
          quoteIdentifier(operation.name),
        values: [],
      },
    ]
  }

  if (operation.kind === 'renameIndex') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' rename index ' +
          quoteIdentifier(operation.from) +
          ' to ' +
          quoteIdentifier(operation.to),
        values: [],
      },
    ]
  }

  if (operation.kind === 'addForeignKey') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' add ' +
          'constraint ' +
          quoteIdentifier(operation.constraint.name) +
          ' ' +
          'foreign key (' +
          operation.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ') references ' +
          quoteTableRef(operation.constraint.references.table) +
          ' (' +
          operation.constraint.references.columns
            .map((column) => quoteIdentifier(column))
            .join(', ') +
          ')' +
          (operation.constraint.onDelete ? ' on delete ' + operation.constraint.onDelete : '') +
          (operation.constraint.onUpdate ? ' on update ' + operation.constraint.onUpdate : ''),
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropForeignKey') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' drop constraint ' +
          quoteIdentifier(operation.name),
        values: [],
      },
    ]
  }

  if (operation.kind === 'addCheck') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' add ' +
          'constraint ' +
          quoteIdentifier(operation.constraint.name) +
          ' ' +
          'check (' +
          operation.constraint.expression +
          ')',
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropCheck') {
    return [
      {
        text:
          'alter table ' +
          quoteTableRef(operation.table) +
          ' drop constraint ' +
          quoteIdentifier(operation.name),
        values: [],
      },
    ]
  }

  throw new Error('Unsupported data migration operation kind')
}

function compileSqliteColumn(definition: ColumnDefinition): string {
  let parts = [compileSqliteColumnType(definition)]

  if (definition.nullable === false) {
    parts.push('not null')
  }

  if (definition.default) {
    if (definition.default.kind === 'now') {
      parts.push('default current_timestamp')
    } else if (definition.default.kind === 'sql') {
      parts.push('default ' + definition.default.expression)
    } else {
      parts.push('default ' + quoteLiteral(definition.default.value))
    }
  }

  if (definition.primaryKey) {
    parts.push('primary key')
  }

  if (definition.unique) {
    parts.push('unique')
  }

  if (definition.computed) {
    parts.push('generated always as (' + definition.computed.expression + ')')
    parts.push(definition.computed.stored ? 'stored' : 'virtual')
  }

  if (definition.references) {
    let clause =
      'references ' +
      quoteTableRef(definition.references.table) +
      ' (' +
      definition.references.columns.map((column) => quoteIdentifier(column)).join(', ') +
      ')'

    if (definition.references.onDelete) {
      clause += ' on delete ' + definition.references.onDelete
    }

    if (definition.references.onUpdate) {
      clause += ' on update ' + definition.references.onUpdate
    }

    parts.push(clause)
  }

  if (definition.checks && definition.checks.length > 0) {
    for (let check of definition.checks) {
      parts.push('check (' + check.expression + ')')
    }
  }

  return parts.join(' ')
}

function compileSqliteColumnType(definition: ColumnDefinition): string {
  if (definition.type === 'varchar') {
    return 'text'
  }

  if (definition.type === 'text') {
    return 'text'
  }

  if (definition.type === 'integer') {
    return 'integer'
  }

  if (definition.type === 'bigint') {
    return 'integer'
  }

  if (definition.type === 'decimal') {
    return 'numeric'
  }

  if (definition.type === 'boolean') {
    return 'integer'
  }

  if (definition.type === 'uuid') {
    return 'text'
  }

  if (definition.type === 'date') {
    return 'text'
  }

  if (definition.type === 'time') {
    return 'text'
  }

  if (definition.type === 'timestamp') {
    return 'text'
  }

  if (definition.type === 'json') {
    return 'text'
  }

  if (definition.type === 'binary') {
    return 'blob'
  }

  if (definition.type === 'enum') {
    return 'text'
  }

  return 'text'
}
