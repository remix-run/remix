import type {
  ColumnDefinition,
  DataManipulationOperation,
  DataManipulationResult,
  DatabaseAdapter,
  TransactionOptions,
  TransactionToken,
} from './adapter.ts'
import type { ColumnBuilder } from './column.ts'
import { DataTableAdapterError, DataTableQueryError } from './errors.ts'
import { executeOperation, type QueryExecutionContext } from './database/execution-context.ts'
import {
  asQueryTableInput,
  getPrimaryKeyWhere,
  getPrimaryKeyWhereFromRow,
  normalizeOrderByInput,
  resolveCreateRowWhere,
  toWriteResult,
} from './database/helpers.ts'
import { executeQuery } from './database/query-execution.ts'
import type { AnyQuery, Query as QueryObject, QueryExecutionResult } from './query.ts'
import { bindQueryRuntime, query as createQuery } from './query.ts'
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts'
import type { SqlStatement } from './sql.ts'
import { isSqlStatement, rawSql } from './sql.ts'
import type {
  AnyRelation,
  AnyTable,
  LoadedRelationMap,
  OrderDirection,
  PrimaryKeyInput,
  TableName,
  TablePrimaryKey,
  TableRow,
  TableRowWith,
  TableValidate,
  tableMetadataKey,
  TimestampConfig,
} from './table.ts'
import { getTableName } from './table.ts'
import type { Pretty } from './types.ts'
import type { WhereInput } from './operators.ts'

export type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string
export type QualifiedTableColumnName<table extends AnyTable> =
  `${TableName<table>}.${TableColumnName<table>}`
export type QueryColumnName<table extends AnyTable> =
  | TableColumnName<table>
  | QualifiedTableColumnName<table>

type RowColumnName<row extends Record<string, unknown>> = keyof row & string
type QualifiedRowColumnName<
  tableName extends string,
  row extends Record<string, unknown>,
> = `${tableName}.${RowColumnName<row>}`

export type QueryColumnTypeMapFromRow<
  tableName extends string,
  row extends Record<string, unknown>,
> = {
  [column in
    | RowColumnName<row>
    | QualifiedRowColumnName<tableName, row>]: column extends RowColumnName<row>
    ? row[column]
    : column extends `${tableName}.${infer name extends RowColumnName<row>}`
      ? row[name]
      : never
}

export type QueryColumnTypeMap<table extends AnyTable> = Pretty<
  QueryColumnTypeMapFromRow<TableName<table>, TableRow<table>>
>

export type MergeColumnTypeMaps<
  left extends Record<string, unknown>,
  right extends Record<string, unknown>,
> = Pretty<{
  [column in Extract<keyof left | keyof right, string>]: column extends keyof right
    ? column extends keyof left
      ? left[column] | right[column]
      : right[column]
    : column extends keyof left
      ? left[column]
      : never
}>

export type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<
  keyof columnTypes,
  string
>

export type QueryColumnInput<columnTypes extends Record<string, unknown>> = ColumnInput<
  QueryColumns<columnTypes>
>

export type SelectedAliasRow<
  columnTypes extends Record<string, unknown>,
  selection extends Record<string, QueryColumnInput<columnTypes>>,
> = Pretty<{
  [alias in keyof selection]: NormalizeColumnInput<selection[alias]> extends keyof columnTypes
    ? columnTypes[NormalizeColumnInput<selection[alias]>]
    : never
}>

export type RelationMapForSourceName<tableName extends string> = Record<
  string,
  AnyRelation & {
    sourceTable: {
      [tableMetadataKey]: {
        name: tableName
      }
    }
  }
>

export type PrimaryKeyInputForRow<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
> = primaryKey extends readonly [infer column extends keyof row & string]
  ? row[column]
  : {
      [column in primaryKey[number] & keyof row]: row[column]
    }

export type ReturningInput<row extends Record<string, unknown>> = '*' | (keyof row & string)[]

/**
 * Table-like metadata accepted by `database.query()`.
 */
export type QueryTableInput<
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
> = TableMetadataLike<
  tableName,
  {
    [column in keyof row & string]: ColumnBuilder<row[column]>
  },
  primaryKey,
  TimestampConfig | null
> & {
  [tableMetadataKey]: {
    name: tableName
    columns: {
      [column in keyof row & string]: ColumnBuilder<row[column]>
    }
    primaryKey: primaryKey
    timestamps: TimestampConfig | null
    columnDefinitions: Record<string, ColumnDefinition>
    validate?: TableValidate<Record<string, unknown>>
  }
} & Record<string, unknown>

/**
 * Result metadata for write operations that do not return rows.
 */
export type WriteResult = {
  affectedRows: number
  insertId?: unknown
}

/**
 * Result metadata for write operations that return multiple rows.
 */
export type WriteRowsResult<row> = {
  affectedRows: number
  insertId?: unknown
  rows: row[]
}

/**
 * Result metadata for write operations that return a single row.
 */
export type WriteRowResult<row> = {
  affectedRows: number
  insertId?: unknown
  row: row | null
}

/**
 * Queryable column type map for a concrete table.
 */
export type QueryColumnTypesForTable<table extends AnyTable> = QueryColumnTypeMap<table>

/**
 * Query type produced for a concrete table.
 */
export type QueryForTable<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
> = QueryObject<
  QueryColumnTypesForTable<table>,
  TableRow<table>,
  loaded,
  TableName<table>,
  TablePrimaryKey<table>,
  'bound'
>

/**
 * Column names accepted in single-table queries.
 */
export type SingleTableColumn<table extends AnyTable> = QueryColumns<QueryColumnTypeMap<table>>

/**
 * `where` input accepted in single-table queries.
 */
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>

/**
 * Tuple form accepted by `orderBy` for a single table.
 */
export type OrderByTuple<table extends AnyTable> = [
  column: SingleTableColumn<table>,
  direction?: OrderDirection,
]

/**
 * `orderBy` input accepted in single-table queries.
 */
export type OrderByInput<table extends AnyTable> = OrderByTuple<table> | OrderByTuple<table>[]

/**
 * Options for loading many rows from a table.
 */
export type FindManyOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = {
  where?: SingleTableWhere<table>
  orderBy?: OrderByInput<table>
  limit?: number
  offset?: number
  with?: relations
}

/**
 * Options for loading a single row from a table.
 */
export type FindOneOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = Omit<FindManyOptions<table, relations>, 'limit' | 'offset'> & {
  where: SingleTableWhere<table>
}

/**
 * Options for updating a single row.
 */
export type UpdateOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = {
  touch?: boolean
  with?: relations
}

/**
 * Options for updating many rows.
 */
export type UpdateManyOptions<table extends AnyTable> = {
  where: SingleTableWhere<table>
  orderBy?: OrderByInput<table>
  limit?: number
  offset?: number
  touch?: boolean
}

/**
 * Options for deleting many rows.
 */
export type DeleteManyOptions<table extends AnyTable> = {
  where: SingleTableWhere<table>
  orderBy?: OrderByInput<table>
  limit?: number
  offset?: number
}

/**
 * Options for counting rows.
 */
export type CountOptions<table extends AnyTable> = {
  where?: SingleTableWhere<table>
}

/**
 * Options for create operations that return only write metadata.
 */
export type CreateResultOptions = {
  touch?: boolean
  returnRow?: false
}

/**
 * Options for create operations that return the inserted row.
 */
export type CreateRowOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = {
  touch?: boolean
  with?: relations
  returnRow: true
}

/**
 * Options for bulk-create operations that return only write metadata.
 */
export type CreateManyResultOptions = {
  touch?: boolean
  returnRows?: false
}

/**
 * Options for bulk-create operations that return inserted rows.
 */
export type CreateManyRowsOptions = {
  touch?: boolean
  returnRows: true
}

type SavepointCounter = {
  value: number
}

type DatabaseOptions = {
  now?: () => unknown
}

type DatabaseInternalState = {
  token?: TransactionToken
  savepointCounter: SavepointCounter
}

const createInternalDatabase = Symbol('createInternalDatabase')

/**
 * High-level database runtime used to build and execute data manipulation operations.
 *
 * Create instances directly with `new Database(adapter, options)` or use
 * `createDatabase(adapter, options)` as a thin wrapper.
 */
export class Database implements QueryExecutionContext {
  #adapter: DatabaseAdapter
  #token?: TransactionToken
  #now: () => unknown
  #savepointCounter: SavepointCounter

  constructor(adapter: DatabaseAdapter, options?: DatabaseOptions) {
    this.#adapter = adapter
    this.#now = options?.now ?? defaultNow
    this.#savepointCounter = { value: 0 }
  }

  static [createInternalDatabase](
    adapter: DatabaseAdapter,
    options: DatabaseOptions | undefined,
    internal: DatabaseInternalState,
  ): Database {
    let database = new Database(adapter, options)
    database.#token = internal.token
    database.#savepointCounter = internal.savepointCounter
    return database
  }

  get adapter(): DatabaseAdapter {
    return this.#adapter
  }

  now(): unknown {
    return this.#now()
  }

  query<
    tableName extends string,
    row extends Record<string, unknown>,
    primaryKey extends readonly (keyof row & string)[],
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
  ): QueryObject<
    Pretty<QueryColumnTypeMapFromRow<tableName, row>>,
    row,
    {},
    tableName,
    primaryKey,
    'bound'
  > {
    return createQuery(table)[bindQueryRuntime](this) as QueryObject<
      Pretty<QueryColumnTypeMapFromRow<tableName, row>>,
      row,
      {},
      tableName,
      primaryKey,
      'bound'
    >
  }

  create<table extends AnyTable>(
    table: table,
    values: Partial<TableRow<table>>,
    options?: CreateResultOptions,
  ): Promise<WriteResult>
  create<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(
    table: table,
    values: Partial<TableRow<table>>,
    options: CreateRowOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>>>
  async create<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    values: Partial<TableRow<table>>,
    options?: CreateResultOptions | CreateRowOptions<table, relations>,
  ): Promise<WriteResult | TableRowWith<table, LoadedRelationMap<relations>>> {
    let touch = options?.touch
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.returnRow !== true) {
      let result = await query.insert(values, { touch })
      return toWriteResult(result)
    }

    if (this.#adapter.capabilities.returning) {
      let result = (await query.insert(values, {
        returning: '*',
        touch,
      })) as { row: TableRow<table> | null }
      let row = result.row

      if (!row) {
        throw new DataTableQueryError(
          'create({ returnRow: true }) failed to return an inserted row',
        )
      }

      if (!options.with) {
        return row as TableRowWith<table, LoadedRelationMap<relations>>
      }

      let where = getPrimaryKeyWhereFromRow(table, row)
      let loaded = await this.findOne(table, {
        where,
        with: options.with,
      })

      if (!loaded) {
        throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row')
      }

      return loaded
    }

    let insertResult = await query.insert(values, { touch })
    let where = resolveCreateRowWhere(table, values, toWriteResult(insertResult).insertId)
    let loaded = await this.findOne(table, {
      where,
      with: options.with,
    })

    if (!loaded) {
      throw new DataTableQueryError('create({ returnRow: true }) failed to load inserted row')
    }

    return loaded
  }

  createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options?: CreateManyResultOptions,
  ): Promise<WriteResult>
  createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options: CreateManyRowsOptions,
  ): Promise<TableRow<table>[]>
  async createMany<table extends AnyTable>(
    table: table,
    values: Array<Partial<TableRow<table>>>,
    options?: CreateManyResultOptions | CreateManyRowsOptions,
  ): Promise<WriteResult | TableRow<table>[]> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.returnRows === true) {
      if (!this.#adapter.capabilities.returning) {
        throw new DataTableQueryError(
          'createMany({ returnRows: true }) is not supported by this adapter',
        )
      }

      let result = (await query.insertMany(values, {
        returning: '*',
        touch: options.touch,
      })) as { rows: TableRow<table>[] }

      return result.rows
    }

    let result = await query.insertMany(values, {
      touch: options?.touch,
    })

    return toWriteResult(result)
  }

  async find<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    value: PrimaryKeyInput<table>,
    options?: { with?: relations },
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null> {
    if (value == null) {
      return null
    }

    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.with) {
      return query.with(options.with).find(value as any) as Promise<TableRowWith<
        table,
        LoadedRelationMap<relations>
      > | null>
    }

    return query.find(value as any) as Promise<TableRowWith<
      table,
      LoadedRelationMap<relations>
    > | null>
  }

  async findOne<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options: FindOneOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.with) {
      return query.with(options.with).first() as Promise<TableRowWith<
        table,
        LoadedRelationMap<relations>
      > | null>
    }

    return query.first() as Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
  }

  async findMany<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options?: FindManyOptions<table, relations>,
  ): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.where) {
      query = query.where(options.where)
    }

    let orderBy = normalizeOrderByInput(options?.orderBy)
    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options?.offset !== undefined) {
      query = query.offset(options.offset)
    }

    if (options?.with) {
      return query.with(options.with).all() as Promise<
        Array<TableRowWith<table, LoadedRelationMap<relations>>>
      >
    }

    return query.all() as Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>>
  }

  async count<table extends AnyTable>(
    table: table,
    options?: CountOptions<table>,
  ): Promise<number> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table))

    if (options?.where) {
      query = query.where(options.where)
    }

    return query.count()
  }

  async update<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    value: PrimaryKeyInput<table>,
    changes: Partial<TableRow<table>>,
    options?: UpdateOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>>> {
    let where = getPrimaryKeyWhere(table, value)

    if (this.#adapter.capabilities.returning) {
      let updateResult = (await this.query(asQueryTableInput(table)).where(where).update(changes, {
        touch: options?.touch,
        returning: '*',
      })) as { rows: TableRow<table>[] }
      let updatedRow = updateResult.rows[0]

      if (!updatedRow) {
        throw new DataTableQueryError(
          'update() failed to find row for table "' + getTableName(table) + '"',
        )
      }

      if (!options?.with) {
        return updatedRow as TableRowWith<table, LoadedRelationMap<relations>>
      }

      let loaded = await this.findOne(table, {
        where: getPrimaryKeyWhereFromRow(table, updatedRow),
        with: options.with,
      })

      if (!loaded) {
        throw new DataTableQueryError(
          'update() failed to find row for table "' + getTableName(table) + '"',
        )
      }

      return loaded
    }

    await this.query(asQueryTableInput(table)).where(where).update(changes, {
      touch: options?.touch,
    })

    let loaded = await this.find(table, value, { with: options?.with })

    if (!loaded) {
      throw new DataTableQueryError(
        'update() failed to find row for table "' + getTableName(table) + '"',
      )
    }

    return loaded
  }

  async updateMany<table extends AnyTable>(
    table: table,
    changes: Partial<TableRow<table>>,
    options: UpdateManyOptions<table>,
  ): Promise<WriteResult> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset)
    }

    let result = await query.update(changes, { touch: options.touch })
    return toWriteResult(result)
  }

  async delete<table extends AnyTable>(
    table: table,
    value: PrimaryKeyInput<table>,
  ): Promise<boolean> {
    let where = getPrimaryKeyWhere(table, value)
    let result = await this.query(asQueryTableInput(table)).where(where).delete()
    return toWriteResult(result).affectedRows > 0
  }

  async deleteMany<table extends AnyTable>(
    table: table,
    options: DeleteManyOptions<table>,
  ): Promise<WriteResult> {
    let query: QueryForTable<table> = this.query(asQueryTableInput(table)).where(options.where)
    let orderBy = normalizeOrderByInput(options.orderBy)

    for (let [column, direction] of orderBy) {
      query = query.orderBy(column, direction)
    }

    if (options.limit !== undefined) {
      query = query.limit(options.limit)
    }

    if (options.offset !== undefined) {
      query = query.offset(options.offset)
    }

    let result = await query.delete()
    return toWriteResult(result)
  }

  async exec(statement: string | SqlStatement, values?: unknown[]): Promise<DataManipulationResult>
  async exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>
  async exec<input extends AnyQuery>(statementOrInput: string | SqlStatement | input,
    values: unknown[] = [],
  ): Promise<DataManipulationResult | QueryExecutionResult<input>> {
    if (typeof statementOrInput === 'string' || isSqlStatement(statementOrInput)) {
      let sqlStatement = isSqlStatement(statementOrInput)
        ? statementOrInput
        : rawSql(statementOrInput, values)

      return this[executeOperation]({
        kind: 'raw',
        sql: sqlStatement,
      })
    }

    return executeQuery(this, statementOrInput)
  }

  async transaction<result>(
    callback: (database: Database) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result> {
    if (!this.#token) {
      let token = await this.#adapter.beginTransaction(options)
      let tx = Database[createInternalDatabase](
        this.#adapter,
        { now: this.#now },
        {
          token,
          savepointCounter: this.#savepointCounter,
        },
      )

      try {
        let result = await callback(tx)
        await this.#adapter.commitTransaction(token)
        return result
      } catch (error) {
        await this.#adapter.rollbackTransaction(token)
        throw error
      }
    }

    if (!this.#adapter.capabilities.savepoints) {
      throw new DataTableQueryError('Nested transactions require adapter savepoint support')
    }

    let savepointName = 'sp_' + String(this.#savepointCounter.value)
    this.#savepointCounter.value += 1

    await this.#adapter.createSavepoint(this.#token, savepointName)

    try {
      let result = await callback(this)
      await this.#adapter.releaseSavepoint(this.#token, savepointName)
      return result
    } catch (error) {
      await this.#adapter.rollbackToSavepoint(this.#token, savepointName)
      await this.#adapter.releaseSavepoint(this.#token, savepointName)
      throw error
    }
  }

  async [executeOperation](operation: DataManipulationOperation): Promise<DataManipulationResult> {
    try {
      return await this.#adapter.execute({
        operation,
        transaction: this.#token,
      })
    } catch (error) {
      throw new DataTableAdapterError('Adapter execution failed', {
        cause: error,
        metadata: {
          dialect: this.#adapter.dialect,
          operationKind: operation.kind,
        },
      })
    }
  }
}

/**
 * Creates a database runtime from an adapter.
 * Thin wrapper around `new Database(adapter, options)`.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A {@link Database} API instance.
 * @example
 * ```ts
 * import { column as c, createDatabase, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 * })
 *
 * let db = createDatabase(adapter)
 * let rows = await db.query(users).where({ id: 1 }).all()
 * ```
 */
export function createDatabase(
  adapter: DatabaseAdapter,
  options?: { now?: () => unknown },
): Database {
  return new Database(adapter, options)
}

/**
 * Creates a database runtime bound to an existing adapter transaction token.
 * This is an internal helper used by the migration runner.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param token Active adapter transaction token.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A {@link Database} API instance bound to the provided transaction.
 */
export function createDatabaseWithTransaction(
  adapter: DatabaseAdapter,
  token: TransactionToken,
  options?: { now?: () => unknown },
): Database {
  return Database[createInternalDatabase](adapter, options, {
    token,
    savepointCounter: { value: 0 },
  })
}

function defaultNow(): Date {
  return new Date()
}
