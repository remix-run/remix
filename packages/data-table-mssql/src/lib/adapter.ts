import type {
  AdapterCapabilityOverrides,
  ColumnDefinition,
  DataManipulationOperation,
  DataManipulationRequest,
  DataManipulationResult,
  DataMigrationOperation,
  DataMigrationRequest,
  DataMigrationResult,
  DatabaseAdapter,
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

import { compileMssqlOperation } from './sql-compiler.ts'

type Pretty<value> = {
  [key in keyof value]: value[key]
} & {}

/**
 * Result shape returned by mssql `query()` calls.
 */
export type MssqlQueryResult = {
  recordset?: unknown[]
  rowsAffected?: number[]
}

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
export type MssqlTransactionClient = Pretty<
  MssqlDatabaseClient & {
    begin(): Promise<unknown>
    commit(): Promise<void>
    rollback(): Promise<void>
  }
>

/**
 * Mssql pool-like client contract used by this adapter.
 */
export type MssqlDatabasePool = Pretty<
  MssqlDatabaseClient & {
    transaction(): MssqlTransactionClient
  }
>

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
  #transactions = new Map<string, MssqlTransactionClient>()
  #isolatedTransactions = new Set<string>()
  #transactionCounter = 0

  constructor(client: MssqlDatabasePool, options?: MssqlDatabaseAdapterOptions) {
    this.#client = client
    this.capabilities = {
      returning: options?.capabilities?.returning ?? false,
      savepoints: options?.capabilities?.savepoints ?? true,
      upsert: options?.capabilities?.upsert ?? true,
      transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
      migrationLock: options?.capabilities?.migrationLock ?? true,
    }
  }

  compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[] {
    if (isDataManipulationOperation(operation)) {
      let compiled = compileMssqlOperation(operation)
      return [{ text: compiled.text, values: compiled.values }]
    }

    return compileMssqlMigrationOperations(operation)
  }

  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    if (request.operation.kind === 'insertMany' && request.operation.values.length === 0) {
      return {
        affectedRows: 0,
        insertId: undefined,
        rows: request.operation.returning ? [] : undefined,
      }
    }

    let statement = compileMssqlOperation(request.operation)
    let client = this.#resolveClient(request.transaction)
    let result = await runMssqlQuery(client, statement.text, statement.values)
    let rows = normalizeRows(result.recordset ?? [])

    if (request.operation.kind === 'count' || request.operation.kind === 'exists') {
      rows = normalizeCountRows(rows)
    }

    return {
      rows,
      affectedRows: normalizeAffectedRows(request.operation.kind, result.rowsAffected, rows),
      insertId: normalizeInsertId(request.operation.kind, request.operation, rows),
    }
  }

  async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
    let statements = this.compileSql(request.operation)
    let client = this.#resolveClient(request.transaction)

    for (let statement of statements) {
      await runMssqlQuery(client, statement.text, statement.values)
    }

    return {
      affectedOperations: statements.length,
    }
  }

  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    let client = this.#resolveClient(transaction)
    let objectName = toMssqlObjectName(table)
    let result = await runMssqlQuery(
      client,
      "select case when object_id(@dt_p1, N'U') is not null then 1 else 0 end as [exists]",
      [objectName],
    )
    let row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined
    return toBooleanExists(row?.exists)
  }

  async hasColumn(
    table: TableRef,
    column: string,
    transaction?: TransactionToken,
  ): Promise<boolean> {
    let client = this.#resolveClient(transaction)
    let sql = table.schema
      ? 'select case when exists(select 1 from information_schema.columns where table_schema = @dt_p1 and table_name = @dt_p2 and column_name = @dt_p3) then 1 else 0 end as [exists]'
      : 'select case when exists(select 1 from information_schema.columns where table_name = @dt_p1 and column_name = @dt_p2) then 1 else 0 end as [exists]'
    let values = table.schema ? [table.schema, table.name, column] : [table.name, column]
    let result = await runMssqlQuery(client, sql, values)
    let row = (result.recordset ?? [])[0] as Record<string, unknown> | undefined
    return toBooleanExists(row?.exists)
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

    if (options?.isolationLevel) {
      this.#isolatedTransactions.add(token.id)
    }

    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactionClient(token)

    try {
      if (this.#isolatedTransactions.has(token.id)) {
        await runMssqlQuery(transaction, 'set transaction isolation level read committed')
      }
      await transaction.commit()
    } finally {
      this.#transactions.delete(token.id)
      this.#isolatedTransactions.delete(token.id)
    }
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    let transaction = this.#transactionClient(token)

    try {
      if (this.#isolatedTransactions.has(token.id)) {
        try {
          await runMssqlQuery(transaction, 'set transaction isolation level read committed')
        } catch {
          // Best-effort: transaction may be in a failed state
        }
      }
      await transaction.rollback()
    } finally {
      this.#transactions.delete(token.id)
      this.#isolatedTransactions.delete(token.id)
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

  async acquireMigrationLock(): Promise<void> {
    let result = await runMssqlQuery(
      this.#client,
      "declare @dt_lock_result int; exec @dt_lock_result = sp_getapplock @Resource = 'data_table_migrations', @LockMode = 'Exclusive', @LockTimeout = 60000, @LockOwner = 'Session'; select @dt_lock_result as [returnValue]",
    )

    let row = result.recordset?.[0] as Record<string, unknown> | undefined
    let returnValue = row?.returnValue

    if (typeof returnValue === 'number' && returnValue < 0) {
      throw new Error(
        'Failed to acquire migration lock (sp_getapplock returned ' + returnValue + ')',
      )
    }
  }

  async releaseMigrationLock(): Promise<void> {
    await runMssqlQuery(
      this.#client,
      "exec sp_releaseapplock @Resource = 'data_table_migrations', @LockOwner = 'Session'",
    )
  }

  #resolveClient(token: TransactionToken | undefined): MssqlDatabaseClient {
    if (!token) {
      return this.#client
    }

    return this.#transactionClient(token)
  }

  #transactionClient(token: TransactionToken): MssqlTransactionClient {
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
 * @example
 * ```ts
 * import mssql from 'mssql'
 * import { createDatabase } from 'remix/data-table'
 * import { createMssqlDatabaseAdapter } from 'remix/data-table-mssql'
 *
 * let pool = await mssql.connect(process.env.DATABASE_URL)
 * let adapter = createMssqlDatabaseAdapter(pool)
 * let db = createDatabase(adapter)
 * ```
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
    request.input('dt_p' + String(index + 1), values[index])
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
  kind: DataManipulationRequest['operation']['kind'],
  rowsAffected: number[] | undefined,
  rows: Record<string, unknown>[],
): number | undefined {
  if (kind === 'select' || kind === 'count' || kind === 'exists') {
    return undefined
  }

  if (rowsAffected && rowsAffected.length > 0) {
    let total = 0

    for (let amount of rowsAffected) {
      total += amount
    }

    return total
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
  return '[' + value.replace(/]/g, ']]') + ']'
}

function quoteTableRef(table: TableRef): string {
  return quoteTableRefHelper(table, quoteIdentifier)
}

function quoteLiteral(value: unknown): string {
  return quoteLiteralHelper(value, { booleansAsIntegers: true })
}

function toMssqlObjectName(table: TableRef): string {
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
    return value === '1' || value.toLowerCase() === 'true'
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

function isDataManipulationOperation(
  operation: DataManipulationOperation | DataMigrationOperation,
): operation is DataManipulationOperation {
  return isDataManipulationOperationHelper(operation)
}

function compileMssqlMigrationOperations(operation: DataMigrationOperation): SqlStatement[] {
  if (operation.kind === 'raw') {
    return [{ text: operation.sql.text, values: [...operation.sql.values] }]
  }

  if (operation.kind === 'createTable') {
    let columns = Object.keys(operation.columns).map(
      (columnName) =>
        quoteIdentifier(columnName) + ' ' + compileMssqlColumn(operation.columns[columnName]),
    )
    let tableConstraints: string[] = []

    if (operation.primaryKey) {
      tableConstraints.push(
        'constraint ' +
          quoteIdentifier(operation.primaryKey.name) +
          ' primary key (' +
          operation.primaryKey.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let unique of operation.uniques ?? []) {
      tableConstraints.push(
        'constraint ' +
          quoteIdentifier(unique.name) +
          ' ' +
          'unique (' +
          unique.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')',
      )
    }

    for (let check of operation.checks ?? []) {
      tableConstraints.push(
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

      tableConstraints.push(clause)
    }

    let tableName = quoteTableRef(operation.table)
    let body = [...columns, ...tableConstraints].join(', ')
    let statements: SqlStatement[] = []

    if (operation.ifNotExists) {
      statements.push({
        text:
          'if object_id(N' +
          quoteLiteral(toMssqlObjectName(operation.table)) +
          ", N'U') is null " +
          'create table ' +
          tableName +
          ' (' +
          body +
          ')',
        values: [],
      })
    } else {
      statements.push({
        text: 'create table ' + tableName + ' (' + body + ')',
        values: [],
      })
    }

    if (operation.comment) {
      statements.push({
        text: compileSetTableComment(operation.table, operation.comment),
        values: [],
      })
    }

    return statements
  }

  if (operation.kind === 'alterTable') {
    let sqlStatements: SqlStatement[] = []

    for (let change of operation.changes) {
      let sql = 'alter table ' + quoteTableRef(operation.table) + ' '

      if (change.kind === 'addColumn') {
        sql += 'add ' + quoteIdentifier(change.column) + ' ' + compileMssqlColumn(change.definition)
      } else if (change.kind === 'changeColumn') {
        let typeSql = compileMssqlColumnType(change.definition)
        sql += 'alter column ' + quoteIdentifier(change.column) + ' ' + typeSql
        if (change.definition.nullable === false) {
          sql += ' not null'
        } else if (change.definition.nullable === true) {
          sql += ' null'
        }
      } else if (change.kind === 'renameColumn') {
        sqlStatements.push({
          text:
            'exec sp_rename ' +
            quoteLiteral(toMssqlObjectName(operation.table) + '.' + change.from) +
            ', ' +
            quoteLiteral(change.to) +
            ", N'COLUMN'",
          values: [],
        })
        continue
      } else if (change.kind === 'dropColumn') {
        sql +=
          'drop column ' + (change.ifExists ? 'if exists ' : '') + quoteIdentifier(change.column)
      } else if (change.kind === 'addPrimaryKey') {
        sql +=
          'add ' +
          'constraint ' +
          quoteIdentifier(change.constraint.name) +
          ' ' +
          'primary key (' +
          change.constraint.columns.map((column) => quoteIdentifier(column)).join(', ') +
          ')'
      } else if (change.kind === 'dropPrimaryKey') {
        sql += 'drop constraint ' + quoteIdentifier(change.name)
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
        sqlStatements.push({
          text: compileSetTableComment(operation.table, change.comment),
          values: [],
        })
        continue
      } else {
        continue
      }

      sqlStatements.push({ text: sql, values: [] })
    }

    return sqlStatements
  }

  if (operation.kind === 'renameTable') {
    return [
      {
        text:
          'exec sp_rename ' +
          quoteLiteral(toMssqlObjectName(operation.from)) +
          ', ' +
          quoteLiteral(operation.to.name),
        values: [],
      },
    ]
  }

  if (operation.kind === 'dropTable') {
    if (operation.ifExists) {
      return [
        {
          text:
            'if object_id(N' +
            quoteLiteral(toMssqlObjectName(operation.table)) +
            ", N'U') is not null " +
            'drop table ' +
            quoteTableRef(operation.table),
          values: [],
        },
      ]
    }

    return [
      {
        text: 'drop table ' + quoteTableRef(operation.table),
        values: [],
      },
    ]
  }

  if (operation.kind === 'createIndex') {
    let createIndexSql =
      'create ' +
      (operation.index.unique ? 'unique ' : '') +
      'index ' +
      quoteIdentifier(operation.index.name) +
      ' on ' +
      quoteTableRef(operation.index.table) +
      ' (' +
      operation.index.columns.map((column) => quoteIdentifier(column)).join(', ') +
      ')' +
      (operation.index.where ? ' where ' + operation.index.where : '')

    if (operation.ifNotExists) {
      createIndexSql =
        'if not exists (select 1 from sys.indexes where name = ' +
        quoteLiteral(operation.index.name) +
        ' and object_id = object_id(N' +
        quoteLiteral(toMssqlObjectName(operation.index.table)) +
        ')) ' +
        createIndexSql
    }

    return [
      {
        text: createIndexSql,
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
          quoteIdentifier(operation.name) +
          ' on ' +
          quoteTableRef(operation.table),
        values: [],
      },
    ]
  }

  if (operation.kind === 'renameIndex') {
    return [
      {
        text:
          'exec sp_rename ' +
          quoteLiteral(toMssqlObjectName(operation.table) + '.' + operation.from) +
          ', ' +
          quoteLiteral(operation.to) +
          ", N'INDEX'",
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

function compileSetTableComment(table: TableRef, comment: string): string {
  let schema = quoteLiteral(table.schema ?? 'dbo')
  let name = quoteLiteral(table.name)
  let value = 'N' + quoteLiteral(comment)

  return (
    'if exists (select 1 from fn_listextendedproperty(' +
    "N'MS_Description', N'SCHEMA', N" +
    schema +
    ", N'TABLE', N" +
    name +
    ', null, null)) ' +
    "exec sp_updateextendedproperty @name = N'MS_Description', @value = " +
    value +
    ", @level0type = N'SCHEMA', @level0name = N" +
    schema +
    ", @level1type = N'TABLE', @level1name = N" +
    name +
    ' else ' +
    "exec sp_addextendedproperty @name = N'MS_Description', @value = " +
    value +
    ", @level0type = N'SCHEMA', @level0name = N" +
    schema +
    ", @level1type = N'TABLE', @level1name = N" +
    name
  )
}

function compileMssqlColumn(definition: ColumnDefinition): string {
  // MSSQL computed columns use `AS (expression)` without a data type
  if (definition.computed) {
    let parts = ['as (' + definition.computed.expression + ')']
    if (definition.computed.stored) {
      parts.push('persisted')
    }
    return parts.join(' ')
  }

  let parts = [compileMssqlColumnType(definition)]

  if (definition.nullable === false) {
    parts.push('not null')
  }

  if (definition.default) {
    if (definition.default.kind === 'now') {
      parts.push('default getdate()')
    } else if (definition.default.kind === 'sql') {
      parts.push('default ' + definition.default.expression)
    } else {
      parts.push('default ' + quoteLiteral(definition.default.value))
    }
  }

  if (definition.autoIncrement && !definition.identity) {
    parts.push('identity(1,1)')
  }

  if (definition.identity) {
    let start = definition.identity.start ?? 1
    let increment = definition.identity.increment ?? 1
    parts.push('identity(' + String(start) + ',' + String(increment) + ')')
  }

  if (definition.primaryKey) {
    parts.push('primary key')
  }

  if (definition.unique) {
    parts.push('unique')
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

function compileMssqlColumnType(definition: ColumnDefinition): string {
  if (definition.type === 'varchar') {
    return 'varchar(' + String(definition.length ?? 255) + ')'
  }

  if (definition.type === 'text') {
    return 'varchar(max)'
  }

  if (definition.type === 'integer') {
    return 'int'
  }

  if (definition.type === 'bigint') {
    return 'bigint'
  }

  if (definition.type === 'decimal') {
    if (definition.precision !== undefined && definition.scale !== undefined) {
      return 'decimal(' + String(definition.precision) + ', ' + String(definition.scale) + ')'
    }

    return 'decimal'
  }

  if (definition.type === 'boolean') {
    return 'bit'
  }

  if (definition.type === 'uuid') {
    return 'uniqueidentifier'
  }

  if (definition.type === 'date') {
    return 'date'
  }

  if (definition.type === 'time') {
    return 'time'
  }

  if (definition.type === 'timestamp') {
    return definition.withTimezone ? 'datetimeoffset' : 'datetime2'
  }

  if (definition.type === 'json') {
    return 'nvarchar(max)'
  }

  if (definition.type === 'binary') {
    return 'varbinary(max)'
  }

  if (definition.type === 'enum') {
    return 'varchar(255)'
  }

  return 'varchar(max)'
}
