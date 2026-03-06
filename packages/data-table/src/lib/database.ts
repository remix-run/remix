import type {
  DataManipulationResult,
  CountOperation,
  ColumnDefinition,
  DatabaseAdapter,
  DeleteOperation,
  ExistsOperation,
  InsertManyOperation,
  InsertOperation,
  JoinClause,
  JoinType,
  ReturningSelection,
  SelectColumn,
  SelectOperation,
  TransactionOptions,
  TransactionToken,
  UpdateOperation,
  UpsertOperation,
} from './adapter.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import type {
  AnyRelation,
  AnyTable,
  LoadedRelationMap,
  OrderByClause,
  OrderDirection,
  PrimaryKeyInput,
  Relation,
  TableAfterDeleteContext,
  TableAfterWriteContext,
  TableBeforeDeleteContext,
  TableLifecycleOperation,
  TableName,
  TablePrimaryKey,
  TableRow,
  TableRowWith,
  TableWriteOperation,
  TableValidate,
  TimestampConfig,
  ValidationIssue,
  tableMetadataKey,
} from './table.ts'
import {
  getCompositeKey,
  getTableAfterDelete,
  getTableAfterRead,
  getTableAfterWrite,
  getTableBeforeDelete,
  getPrimaryKeyObject,
  getTableColumns,
  getTableName,
  getTableBeforeWrite,
  getTablePrimaryKey,
  getTableTimestamps,
  getTableValidator,
} from './table.ts'
import type { Predicate, WhereInput } from './operators.ts'
import { and, eq, inList, normalizeWhereInput, or } from './operators.ts'
import type { SqlStatement } from './sql.ts'
import { rawSql, isSqlStatement } from './sql.ts'
import type { DataManipulationOperation } from './adapter.ts'
import type { Pretty } from './types.ts'
import { normalizeColumnInput } from './references.ts'
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts'
import type { ColumnBuilder } from './column.ts'

type QueryState = {
  select: '*' | SelectColumn[]
  distinct: boolean
  joins: JoinClause[]
  where: Predicate<string>[]
  groupBy: string[]
  having: Predicate<string>[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
  with: Record<string, AnyRelation>
}

type TableColumnName<table extends AnyTable> = keyof TableRow<table> & string
type QualifiedTableColumnName<table extends AnyTable> =
  `${TableName<table>}.${TableColumnName<table>}`
type QueryColumnName<table extends AnyTable> =
  | TableColumnName<table>
  | QualifiedTableColumnName<table>

type RowColumnName<row extends Record<string, unknown>> = keyof row & string
type QualifiedRowColumnName<
  tableName extends string,
  row extends Record<string, unknown>,
> = `${tableName}.${RowColumnName<row>}`

type QueryColumnTypeMapFromRow<tableName extends string, row extends Record<string, unknown>> = {
  [column in
    | RowColumnName<row>
    | QualifiedRowColumnName<tableName, row>]: column extends RowColumnName<row>
    ? row[column]
    : column extends `${tableName}.${infer name extends RowColumnName<row>}`
      ? row[name]
      : never
}

type QueryColumnTypeMap<table extends AnyTable> = Pretty<
  QueryColumnTypeMapFromRow<TableName<table>, TableRow<table>>
>

type MergeColumnTypeMaps<
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

type QueryColumns<columnTypes extends Record<string, unknown>> = Extract<keyof columnTypes, string>

type QueryColumnInput<columnTypes extends Record<string, unknown>> = ColumnInput<
  QueryColumns<columnTypes>
>

type SelectedAliasRow<
  columnTypes extends Record<string, unknown>,
  selection extends Record<string, QueryColumnInput<columnTypes>>,
> = Pretty<{
  [alias in keyof selection]: NormalizeColumnInput<selection[alias]> extends keyof columnTypes
    ? columnTypes[NormalizeColumnInput<selection[alias]>]
    : never
}>

type SavepointCounter = {
  value: number
}

const executeOperation = Symbol('executeOperation')
const loadRowsWithRelations = Symbol('loadRowsWithRelations')

type LifecycleCallbackSource =
  | 'beforeWrite'
  | 'validate'
  | 'afterWrite'
  | 'beforeDelete'
  | 'afterDelete'
  | 'afterRead'

type RelationMapForSourceName<tableName extends string> = Record<
  string,
  AnyRelation & {
    sourceTable: {
      [tableMetadataKey]: {
        name: tableName
      }
    }
  }
>

type PrimaryKeyInputForRow<
  row extends Record<string, unknown>,
  primaryKey extends readonly string[],
> = primaryKey extends readonly [infer column extends keyof row & string]
  ? row[column]
  : {
      [column in primaryKey[number] & keyof row]: row[column]
    }

type ReturningInput<row extends Record<string, unknown>> = '*' | (keyof row & string)[]

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

export type QueryBuilderFor<
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
  loaded extends Record<string, unknown> = {},
> = QueryBuilder<
  Pretty<QueryColumnTypeMapFromRow<tableName, row>>,
  row,
  loaded,
  tableName,
  primaryKey
>

export type QueryMethod = <
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
>(
  table: QueryTableInput<tableName, row, primaryKey>,
) => QueryBuilderFor<tableName, row, primaryKey>

export type WriteResult = {
  affectedRows: number
  insertId?: unknown
}

export type WriteRowsResult<row> = {
  affectedRows: number
  insertId?: unknown
  rows: row[]
}

export type WriteRowResult<row> = {
  affectedRows: number
  insertId?: unknown
  row: row | null
}

export type QueryColumnTypesForTable<table extends AnyTable> = QueryColumnTypeMap<table>

export type QueryForTable<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
> = QueryBuilder<
  QueryColumnTypesForTable<table>,
  TableRow<table>,
  loaded,
  TableName<table>,
  TablePrimaryKey<table>
>

export type SingleTableColumn<table extends AnyTable> = QueryColumns<QueryColumnTypeMap<table>>

export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>

export type OrderByTuple<table extends AnyTable> = [
  column: SingleTableColumn<table>,
  direction?: OrderDirection,
]

export type OrderByInput<table extends AnyTable> = OrderByTuple<table> | OrderByTuple<table>[]

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

export type FindOneOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = Omit<FindManyOptions<table, relations>, 'limit' | 'offset'> & {
  where: SingleTableWhere<table>
}

export type UpdateOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = {
  touch?: boolean
  with?: relations
}

export type UpdateManyOptions<table extends AnyTable> = {
  where: SingleTableWhere<table>
  orderBy?: OrderByInput<table>
  limit?: number
  offset?: number
  touch?: boolean
}

export type DeleteManyOptions<table extends AnyTable> = {
  where: SingleTableWhere<table>
  orderBy?: OrderByInput<table>
  limit?: number
  offset?: number
}

export type CountOptions<table extends AnyTable> = {
  where?: SingleTableWhere<table>
}

export type CreateResultOptions = {
  touch?: boolean
  returnRow?: false
}

export type CreateRowOptions<
  table extends AnyTable,
  relations extends RelationMapForSourceName<TableName<table>> = {},
> = {
  touch?: boolean
  with?: relations
  returnRow: true
}

export type CreateManyResultOptions = {
  touch?: boolean
  returnRows?: false
}

export type CreateManyRowsOptions = {
  touch?: boolean
  returnRows: true
}

/**
 * High-level database runtime used to build and execute data manipulation operations.
 *
 * Create instances with {@link createDatabase}.
 */
export type Database = {
  adapter: DatabaseAdapter
  now(): unknown
  query: QueryMethod
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
  find<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(
    table: table,
    value: PrimaryKeyInput<table>,
    options?: { with?: relations },
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
  findOne<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options: FindOneOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
  findMany<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options?: FindManyOptions<table, relations>,
  ): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>>
  count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>
  update<table extends AnyTable, relations extends RelationMapForSourceName<TableName<table>> = {}>(
    table: table,
    value: PrimaryKeyInput<table>,
    changes: Partial<TableRow<table>>,
    options?: UpdateOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>>>
  updateMany<table extends AnyTable>(
    table: table,
    changes: Partial<TableRow<table>>,
    options: UpdateManyOptions<table>,
  ): Promise<WriteResult>
  delete<table extends AnyTable>(table: table, value: PrimaryKeyInput<table>): Promise<boolean>
  deleteMany<table extends AnyTable>(
    table: table,
    options: DeleteManyOptions<table>,
  ): Promise<WriteResult>
  exec(statement: string | SqlStatement, values?: unknown[]): Promise<DataManipulationResult>
  transaction<result>(
    callback: (database: Database) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result>
}

class DatabaseRuntime implements Database {
  #adapter: DatabaseAdapter
  #token?: TransactionToken
  #now: () => unknown
  #savepointCounter: SavepointCounter

  constructor(options: {
    adapter: DatabaseAdapter
    token?: TransactionToken
    now: () => unknown
    savepointCounter: SavepointCounter
  }) {
    this.#adapter = options.adapter
    this.#token = options.token
    this.#now = options.now
    this.#savepointCounter = options.savepointCounter
  }

  get adapter(): DatabaseAdapter {
    return this.#adapter
  }

  now(): unknown {
    return this.#now()
  }

  query: QueryMethod = <
    tableName extends string,
    row extends Record<string, unknown>,
    primaryKey extends readonly (keyof row & string)[],
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
  ): QueryBuilderFor<tableName, row, primaryKey> =>
    new QueryBuilder(this, table, createInitialQueryState())

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
      })) as WriteRowResult<TableRow<table>>
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
      })) as WriteRowsResult<TableRow<table>>

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
      return query
        .with(options.with)
        .find(
          value as PrimaryKeyInputForRow<TableRow<table>, TablePrimaryKey<table>>,
        ) as Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
    }

    return query.find(
      value as PrimaryKeyInputForRow<TableRow<table>, TablePrimaryKey<table>>,
    ) as Promise<TableRowWith<table, LoadedRelationMap<relations>> | null>
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
      })) as WriteRowsResult<TableRow<table>>
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

  async exec(
    statement: string | SqlStatement,
    values: unknown[] = [],
  ): Promise<DataManipulationResult> {
    let sqlStatement = isSqlStatement(statement) ? statement : rawSql(statement, values)

    return this[executeOperation]({
      kind: 'raw',
      sql: sqlStatement,
    })
  }

  async transaction<result>(
    callback: (database: Database) => Promise<result>,
    options?: TransactionOptions,
  ): Promise<result> {
    if (!this.#token) {
      let token = await this.#adapter.beginTransaction(options)
      let tx = new DatabaseRuntime({
        adapter: this.#adapter,
        token,
        now: this.#now,
        savepointCounter: this.#savepointCounter,
      })

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
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A `Database` API instance.
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
  let now = options?.now ?? defaultNow

  return new DatabaseRuntime({
    adapter,
    token: undefined,
    now,
    savepointCounter: { value: 0 },
  })
}

/**
 * Creates a database runtime bound to an existing adapter transaction token.
 * This is an internal helper used by the migration runner.
 * @param adapter Adapter implementation responsible for SQL execution.
 * @param token Active adapter transaction token.
 * @param options Optional runtime options.
 * @param options.now Clock function used for auto-managed timestamps.
 * @returns A `Database` API instance bound to the provided transaction.
 */
export function createDatabaseWithTransaction(
  adapter: DatabaseAdapter,
  token: TransactionToken,
  options?: { now?: () => unknown },
): Database {
  let now = options?.now ?? defaultNow

  return new DatabaseRuntime({
    adapter,
    token,
    now,
    savepointCounter: { value: 0 },
  })
}

/**
 * Immutable query builder used by `db.query(table)`.
 */
export class QueryBuilder<
  columnTypes extends Record<string, unknown>,
  row extends Record<string, unknown>,
  loaded extends Record<string, unknown> = {},
  tableName extends string = string,
  primaryKey extends readonly string[] = readonly string[],
> {
  #database: DatabaseRuntime
  #table: AnyTable
  #state: QueryState

  constructor(database: DatabaseRuntime, table: AnyTable, state: QueryState) {
    this.#database = database
    this.#table = table
    this.#state = state
  }

  /**
   * Narrows selected columns, optionally with aliases.
   */
  select<selection extends (keyof row & string)[]>(
    ...columns: selection
  ): QueryBuilder<columnTypes, Pick<row, selection[number]>, loaded, tableName, primaryKey>
  select<selection extends Record<string, QueryColumnInput<columnTypes>>>(
    selection: selection,
  ): QueryBuilder<
    columnTypes,
    SelectedAliasRow<columnTypes, selection>,
    loaded,
    tableName,
    primaryKey
  >
  select(
    ...input: [Record<string, QueryColumnInput<columnTypes>>] | (keyof row & string)[]
  ): QueryBuilder<columnTypes, any, loaded, tableName, primaryKey> {
    if (
      input.length === 1 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      !Array.isArray(input[0])
    ) {
      let selection = input[0] as Record<string, QueryColumnInput<columnTypes>>
      let aliases = Object.keys(selection)
      let select = aliases.map((alias) => ({
        column: normalizeColumnInput(selection[alias]),
        alias,
      }))

      return this.#clone({ select }) as QueryBuilder<
        columnTypes,
        any,
        loaded,
        tableName,
        primaryKey
      >
    }

    let columns = input as (keyof row & string)[]

    return this.#clone({
      select: columns.map((column) => ({ column, alias: column })),
    }) as QueryBuilder<columnTypes, any, loaded, tableName, primaryKey>
  }

  /**
   * Toggles `distinct` selection.
   * @param value When `true`, eliminates duplicate rows.
   * @returns A cloned query builder with updated distinct state.
   */
  distinct(value = true): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ distinct: value })
  }

  /**
   * Adds a where predicate.
   * @param input Predicate expression or column-value shorthand.
   * @returns A cloned query builder with the appended where predicate.
   */
  where(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      where: [...this.#state.where, normalizedPredicate],
    })
  }

  /**
   * Adds a having predicate.
   * @param input Predicate expression or aggregate filter shorthand.
   * @returns A cloned query builder with the appended having predicate.
   */
  having(
    input: WhereInput<QueryColumns<columnTypes>>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    let predicate = normalizeWhereInput(input)
    let normalizedPredicate = normalizePredicateValues(
      predicate,
      createPredicateColumnResolver([this.#table, ...this.#state.joins.map((join) => join.table)]),
    )

    return this.#clone({
      having: [...this.#state.having, normalizedPredicate],
    })
  }

  /**
   * Adds a join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @param type Join type.
   * @returns A query builder whose column map includes joined table columns.
   */
  join<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
    type: JoinType = 'inner',
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
  > {
    let normalizedOn = normalizePredicateValues(
      on,
      createPredicateColumnResolver([
        this.#table,
        ...this.#state.joins.map((join) => join.table),
        target,
      ]),
    ) as Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>

    return new QueryBuilder(this.#database, this.#table, {
      select: cloneSelection(this.#state.select),
      distinct: this.#state.distinct,
      joins: [...this.#state.joins, { type, table: target, on: normalizedOn }],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
      with: { ...this.#state.with },
    }) as QueryBuilder<
      MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
      row,
      loaded,
      tableName,
      primaryKey
    >
  }

  /**
   * Adds a left join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @returns A query builder whose column map includes joined table columns.
   */
  leftJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
  > {
    return this.join(target, on, 'left')
  }

  /**
   * Adds a right join clause.
   * @param target Target table to join.
   * @param on Join predicate.
   * @returns A query builder whose column map includes joined table columns.
   */
  rightJoin<target extends AnyTable>(
    target: target,
    on: Predicate<QueryColumns<columnTypes> | QueryColumnName<target>>,
  ): QueryBuilder<
    MergeColumnTypeMaps<columnTypes, QueryColumnTypeMap<target>>,
    row,
    loaded,
    tableName,
    primaryKey
  > {
    return this.join(target, on, 'right')
  }

  /**
   * Appends an order-by clause.
   * @param column Column to sort by.
   * @param direction Sort direction.
   * @returns A cloned query builder with the appended order-by clause.
   */
  orderBy(
    column: QueryColumnInput<columnTypes>,
    direction: OrderDirection = 'asc',
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({
      orderBy: [...this.#state.orderBy, { column: normalizeColumnInput(column), direction }],
    })
  }

  /**
   * Appends group-by columns.
   * @param columns Columns to include in the grouping set.
   * @returns A cloned query builder with appended group-by columns.
   */
  groupBy(
    ...columns: QueryColumnInput<columnTypes>[]
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({
      groupBy: [...this.#state.groupBy, ...columns.map((column) => normalizeColumnInput(column))],
    })
  }

  /**
   * Limits returned rows.
   * @param value Maximum number of rows to return.
   * @returns A cloned query builder with a row limit.
   */
  limit(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ limit: value })
  }

  /**
   * Skips returned rows.
   * @param value Number of rows to skip.
   * @returns A cloned query builder with a row offset.
   */
  offset(value: number): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return this.#clone({ offset: value })
  }

  /**
   * Configures eager-loaded relations.
   * @param relations Relation map describing nested eager-load behavior.
   * @returns A cloned query builder with relation loading configuration.
   */
  with<relations extends RelationMapForSourceName<tableName>>(
    relations: relations,
  ): QueryBuilder<columnTypes, row, loaded & LoadedRelationMap<relations>, tableName, primaryKey> {
    return this.#clone({
      with: {
        ...this.#state.with,
        ...relations,
      },
    }) as QueryBuilder<
      columnTypes,
      row,
      loaded & LoadedRelationMap<relations>,
      tableName,
      primaryKey
    >
  }

  /**
   * Executes the query and returns all rows.
   * @returns All matching rows with requested eager-loaded relations.
   */
  async all(): Promise<Array<row & loaded>> {
    let rows = await this[loadRowsWithRelations]()
    return applyAfterReadHooksToLoadedRows(this.#table, rows, this.#state.with) as Array<
      row & loaded
    >
  }

  async [loadRowsWithRelations](): Promise<Record<string, unknown>[]> {
    let operation = this.#toSelectOperation()
    let result = await this.#database[executeOperation](operation)
    let rows = normalizeRows(result.rows)

    if (Object.keys(this.#state.with).length === 0) {
      return rows
    }

    return loadRelationsForRows(this.#database, this.#table, rows, this.#state.with)
  }

  /**
   * Executes the query and returns the first row.
   * @returns The first matching row, or `null` when no rows match.
   */
  async first(): Promise<(row & loaded) | null> {
    let rows = await this.limit(1).all()
    return rows[0] ?? null
  }

  /**
   * Loads a single row by primary key.
   * @param value Primary-key value or composite-key object.
   * @returns The matching row, or `null` when no row exists.
   */
  async find(value: PrimaryKeyInputForRow<row, primaryKey>): Promise<(row & loaded) | null> {
    let where = getPrimaryKeyObject(this.#table, value as any)
    return this.where(where as WhereInput<QueryColumns<columnTypes>>).first()
  }

  /**
   * Executes a count query.
   * @returns Number of rows that match the current query scope.
   */
  async count(): Promise<number> {
    let operation: CountOperation<AnyTable> = {
      kind: 'count',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database[executeOperation](operation)

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return result.rows[0].count as number
    }

    if (result.rows) {
      return result.rows.length
    }

    return 0
  }

  /**
   * Executes an existence query.
   * @returns `true` when at least one row matches the current query scope.
   */
  async exists(): Promise<boolean> {
    let operation: ExistsOperation<AnyTable> = {
      kind: 'exists',
      table: this.#table,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
    }

    let result = await this.#database[executeOperation](operation)

    if (result.rows && result.rows[0] && typeof result.rows[0].exists === 'boolean') {
      return result.rows[0].exists as boolean
    }

    if (result.rows && result.rows[0] && typeof result.rows[0].count === 'number') {
      return Number(result.rows[0].count) > 0
    }

    return Boolean(result.rows && result.rows.length > 0)
  }

  /**
   * Inserts one row.
   * @param values Values to insert.
   * @param options Insert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @returns Insert metadata, and optionally the returned row.
   */
  async insert(
    values: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowResult<row>> {
    assertWriteState(this.#state, 'insert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let preparedValues = prepareInsertValues(
      this.#table,
      values,
      this.#database.now(),
      options?.touch ?? true,
    )
    let returning = options?.returning

    assertReturningCapability(this.#database.adapter, 'insert', returning)

    if (returning) {
      let operation: InsertOperation<AnyTable> = {
        kind: 'insert',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
        null) as row | null
      let affectedRows = result.affectedRows ?? 0
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: [preparedValues as Partial<row>],
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        row,
      }
    }

    let operation: InsertOperation<AnyTable> = {
      kind: 'insert',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: [preparedValues as Partial<row>],
      affectedRows,
      insertId: result.insertId,
    })
    let metadata: WriteResult = {
      affectedRows,
      insertId: result.insertId,
    }

    return metadata
  }

  /**
   * Inserts many rows.
   * @param values Values to insert.
   * @param options Insert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @returns Insert metadata, and optionally the returned rows.
   */
  async insertMany(
    values: Partial<row>[],
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'insertMany', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    let preparedValues = values.map((value) =>
      prepareInsertValues(this.#table, value, this.#database.now(), options?.touch ?? true),
    )

    if (
      preparedValues.length > 0 &&
      preparedValues.every((preparedValue) => Object.keys(preparedValue).length === 0)
    ) {
      throw new DataTableQueryError(
        'insertMany() requires at least one explicit value across the batch',
      )
    }

    let returning = options?.returning

    assertReturningCapability(this.#database.adapter, 'insertMany', returning)

    if (returning) {
      let operation: InsertManyOperation<AnyTable> = {
        kind: 'insertMany',
        table: this.#table,
        values: preparedValues,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let affectedRows = result.affectedRows ?? 0
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: preparedValues as Array<Partial<row>>,
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
      }
    }

    let operation: InsertManyOperation<AnyTable> = {
      kind: 'insertMany',
      table: this.#table,
      values: preparedValues,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: preparedValues as Array<Partial<row>>,
      affectedRows,
      insertId: result.insertId,
    })
    let metadata: WriteResult = {
      affectedRows,
      insertId: result.insertId,
    }

    return metadata
  }

  /**
   * Updates scoped rows.
   * @param changes Column changes to apply.
   * @param options Update options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, updates timestamp columns automatically.
   * @returns Update metadata, and optionally the returned rows.
   */
  async update(
    changes: Partial<row>,
    options?: { returning?: ReturningInput<row>; touch?: boolean },
  ): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'update', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'update', returning)
    let preparedChanges = prepareUpdateValues(
      this.#table,
      changes,
      this.#database.now(),
      options?.touch ?? true,
    )

    if (Object.keys(preparedChanges).length === 0) {
      throw new DataTableQueryError('update() requires at least one change')
    }

    let result: DataManipulationResult

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      result = await this.#database.transaction(async (tx: Database) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, queryState)
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          return {
            affectedRows: 0,
            insertId: undefined,
            rows: returning ? [] : undefined,
          }
        }

        let txRuntime = tx as unknown as DatabaseRuntime
        return txRuntime[executeOperation]({
          kind: 'update',
          table,
          changes: preparedChanges,
          where: [primaryKeyPredicate],
          returning: returning ? normalizeReturningSelection(returning) : undefined,
        })
      })
    } else {
      let operation: UpdateOperation<AnyTable> = {
        kind: 'update',
        table: this.#table,
        changes: preparedChanges,
        where: [...this.#state.where],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      }

      result = await this.#database[executeOperation](operation)
    }

    let affectedRows = result.affectedRows ?? 0
    runAfterWriteHook(this.#table, {
      operation: 'update',
      tableName: getTableName(this.#table),
      values: [preparedChanges as Partial<row>],
      affectedRows,
      insertId: result.insertId,
    })

    if (!returning) {
      return {
        affectedRows,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows,
      insertId: result.insertId,
      rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
    }
  }

  /**
   * Deletes scoped rows.
   * @param options Delete options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @returns Delete metadata, and optionally the returned rows.
   */
  async delete(options?: {
    returning?: ReturningInput<row>
  }): Promise<WriteResult | WriteRowsResult<row>> {
    assertWriteState(this.#state, 'delete', {
      where: true,
      orderBy: true,
      limit: true,
      offset: true,
    })

    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'delete', returning)
    let tableName = getTableName(this.#table)
    let deleteContext: TableBeforeDeleteContext = {
      tableName,
      where: [...this.#state.where],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
    }

    runBeforeDeleteHook(this.#table, deleteContext)
    let result: DataManipulationResult

    if (hasScopedWriteModifiers(this.#state)) {
      let table = this.#table
      let queryState = this.#state

      result = await this.#database.transaction(async (tx: Database) => {
        let primaryKeys = await loadPrimaryKeyRowsForScope(tx, table, queryState)
        let primaryKeyPredicate = buildPrimaryKeyPredicate(table, primaryKeys)

        if (!primaryKeyPredicate) {
          return {
            affectedRows: 0,
            insertId: undefined,
            rows: returning ? [] : undefined,
          }
        }

        let txRuntime = tx as unknown as DatabaseRuntime
        return txRuntime[executeOperation]({
          kind: 'delete',
          table,
          where: [primaryKeyPredicate],
          returning: returning ? normalizeReturningSelection(returning) : undefined,
        })
      })
    } else {
      let operation: DeleteOperation<AnyTable> = {
        kind: 'delete',
        table: this.#table,
        where: [...this.#state.where],
        returning: returning ? normalizeReturningSelection(returning) : undefined,
      }

      result = await this.#database[executeOperation](operation)
    }

    let affectedRows = result.affectedRows ?? 0
    runAfterDeleteHook(this.#table, {
      tableName,
      where: deleteContext.where,
      orderBy: deleteContext.orderBy,
      limit: deleteContext.limit,
      offset: deleteContext.offset,
      affectedRows,
    })

    if (!returning) {
      return {
        affectedRows,
        insertId: result.insertId,
      }
    }

    return {
      affectedRows,
      insertId: result.insertId,
      rows: applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows)) as row[],
    }
  }

  /**
   * Performs an upsert operation.
   * @param values Values to insert.
   * @param options Upsert options.
   * @param options.returning Optional return selection for adapters that support returning.
   * @param options.touch When `true`, manages timestamp columns automatically.
   * @param options.conflictTarget Conflict target columns for adapters that require them.
   * @param options.update Optional update payload used when a conflict occurs.
   * @returns Upsert metadata, and optionally the returned row.
   */
  async upsert(
    values: Partial<row>,
    options?: {
      returning?: ReturningInput<row>
      touch?: boolean
      conflictTarget?: (keyof row & string)[]
      update?: Partial<row>
    },
  ): Promise<WriteResult | WriteRowResult<row>> {
    assertWriteState(this.#state, 'upsert', {
      where: false,
      orderBy: false,
      limit: false,
      offset: false,
    })

    if (!this.#database.adapter.capabilities.upsert) {
      throw new DataTableQueryError('Adapter does not support upsert')
    }

    let preparedValues = prepareInsertValues(
      this.#table,
      values,
      this.#database.now(),
      options?.touch ?? true,
    )
    let updateChanges = options?.update
      ? prepareUpdateValues(
          this.#table,
          options.update,
          this.#database.now(),
          options?.touch ?? true,
          'create',
        )
      : undefined
    let returning = options?.returning
    assertReturningCapability(this.#database.adapter, 'upsert', returning)

    if (returning) {
      let operation: UpsertOperation<AnyTable> = {
        kind: 'upsert',
        table: this.#table,
        values: preparedValues,
        conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
        update: updateChanges,
        returning: normalizeReturningSelection(returning),
      }

      let result = await this.#database[executeOperation](operation)
      let row = (applyAfterReadHooksToRows(this.#table, normalizeRows(result.rows))[0] ??
        null) as row | null
      let affectedRows = result.affectedRows ?? 0
      let preparedWriteValues = updateChanges
        ? ([preparedValues, updateChanges] as Array<Partial<row>>)
        : ([preparedValues] as Array<Partial<row>>)
      runAfterWriteHook(this.#table, {
        operation: 'create',
        tableName: getTableName(this.#table),
        values: preparedWriteValues,
        affectedRows,
        insertId: result.insertId,
      })

      return {
        affectedRows,
        insertId: result.insertId,
        row,
      }
    }

    let operation: UpsertOperation<AnyTable> = {
      kind: 'upsert',
      table: this.#table,
      values: preparedValues,
      conflictTarget: options?.conflictTarget ? [...options.conflictTarget] : undefined,
      update: updateChanges,
    }

    let result = await this.#database[executeOperation](operation)
    let affectedRows = result.affectedRows ?? 0
    let preparedWriteValues = updateChanges
      ? ([preparedValues, updateChanges] as Array<Partial<row>>)
      : ([preparedValues] as Array<Partial<row>>)
    runAfterWriteHook(this.#table, {
      operation: 'create',
      tableName: getTableName(this.#table),
      values: preparedWriteValues,
      affectedRows,
      insertId: result.insertId,
    })
    let metadata: WriteResult = {
      affectedRows,
      insertId: result.insertId,
    }

    return metadata
  }

  #toSelectOperation(): SelectOperation<AnyTable> {
    return {
      kind: 'select',
      table: this.#table,
      select: cloneSelection(this.#state.select),
      distinct: this.#state.distinct,
      joins: [...this.#state.joins],
      where: [...this.#state.where],
      groupBy: [...this.#state.groupBy],
      having: [...this.#state.having],
      orderBy: [...this.#state.orderBy],
      limit: this.#state.limit,
      offset: this.#state.offset,
    }
  }

  #clone(
    patch: Partial<QueryState>,
  ): QueryBuilder<columnTypes, row, loaded, tableName, primaryKey> {
    return new QueryBuilder(this.#database, this.#table, {
      select: patch.select ?? cloneSelection(this.#state.select),
      distinct: patch.distinct ?? this.#state.distinct,
      joins: patch.joins ? [...patch.joins] : [...this.#state.joins],
      where: patch.where ? [...patch.where] : [...this.#state.where],
      groupBy: patch.groupBy ? [...patch.groupBy] : [...this.#state.groupBy],
      having: patch.having ? [...patch.having] : [...this.#state.having],
      orderBy: patch.orderBy ? [...patch.orderBy] : [...this.#state.orderBy],
      limit: patch.limit === undefined ? this.#state.limit : patch.limit,
      offset: patch.offset === undefined ? this.#state.offset : patch.offset,
      with: patch.with ? { ...patch.with } : { ...this.#state.with },
    })
  }
}

async function loadRelationsForRows(
  database: DatabaseRuntime,
  sourceTable: AnyTable,
  rows: Record<string, unknown>[],
  relationMap: Record<string, AnyRelation>,
): Promise<Record<string, unknown>[]> {
  let output = rows.map((row) => ({ ...row }))

  let relationNames = Object.keys(relationMap)

  for (let relationName of relationNames) {
    let relation = relationMap[relationName]

    if (relation.sourceTable !== sourceTable) {
      throw new DataTableQueryError(
        'Relation "' +
          relationName +
          '" is not defined for source table "' +
          getTableName(sourceTable) +
          '"',
      )
    }

    let values = await resolveRelationValues(database, output, relation)
    let index = 0

    while (index < output.length) {
      output[index][relationName] = values[index]
      index += 1
    }
  }

  return output
}

async function resolveRelationValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (relation.relationKind === 'hasManyThrough') {
    return loadHasManyThroughValues(database, sourceRows, relation)
  }

  return loadDirectRelationValues(database, sourceRows, relation)
}

async function loadDirectRelationValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (sourceRows.length === 0) {
    return []
  }

  let sourceTuples = uniqueTuples(sourceRows, relation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => (relation.cardinality === 'many' ? [] : null))
  }

  let query = database.query(relation.targetTable)
  let linkPredicate = buildLinkPredicate(relation.targetKey, sourceTuples)

  if (linkPredicate) {
    query = query.where(linkPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>)
  }

  query = applyRelationModifiers(query, relation, {
    includePagination: false,
  })

  let relatedRows = await query[loadRowsWithRelations]()
  let grouped = groupRowsByTuple(relatedRows, relation.targetKey)

  return sourceRows.map((sourceRow) => {
    let key = getCompositeKey(sourceRow, relation.sourceKey)
    let matches = grouped.get(key) ?? []
    let pagedMatches = applyPagination(matches, relation.modifiers.limit, relation.modifiers.offset)

    if (relation.cardinality === 'many') {
      return pagedMatches
    }

    return pagedMatches[0] ?? null
  })
}

async function loadHasManyThroughValues(
  database: DatabaseRuntime,
  sourceRows: Record<string, unknown>[],
  relation: AnyRelation,
): Promise<unknown[]> {
  if (!relation.through) {
    throw new DataTableQueryError('hasManyThrough relation is missing through metadata')
  }

  if (sourceRows.length === 0) {
    return []
  }

  let throughRelation = relation.through.relation
  let sourceTuples = uniqueTuples(sourceRows, throughRelation.sourceKey)

  if (sourceTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughQuery = database.query(throughRelation.targetTable)
  let throughPredicate = buildLinkPredicate(throughRelation.targetKey, sourceTuples)

  if (throughPredicate) {
    throughQuery = throughQuery.where(
      throughPredicate as Predicate<QueryColumnName<typeof throughRelation.targetTable>>,
    )
  }

  throughQuery = applyRelationModifiers(throughQuery, throughRelation, {
    includePagination: false,
  })

  let throughRows = await throughQuery[loadRowsWithRelations]()

  if (throughRows.length === 0) {
    return sourceRows.map(() => [])
  }

  let throughRowsBySource = groupRowsByTuple(throughRows, throughRelation.targetKey)
  let pagedThroughRowsBySource = new Map<string, Record<string, unknown>[]>()
  let pagedThroughRows: Record<string, unknown>[] = []

  for (let sourceRow of sourceRows) {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = throughRowsBySource.get(sourceKey) ?? []
    let pagedMatchedRows = applyPagination(
      matchedThroughRows,
      throughRelation.modifiers.limit,
      throughRelation.modifiers.offset,
    )

    pagedThroughRowsBySource.set(sourceKey, pagedMatchedRows)
    pagedThroughRows.push(...pagedMatchedRows)
  }

  let throughTuples = uniqueTuples(pagedThroughRows, relation.through.throughSourceKey)

  if (throughTuples.length === 0) {
    return sourceRows.map(() => [])
  }

  let targetQuery = database.query(relation.targetTable)
  let targetPredicate = buildLinkPredicate(relation.through.throughTargetKey, throughTuples)

  if (targetPredicate) {
    targetQuery = targetQuery.where(
      targetPredicate as Predicate<QueryColumnName<typeof relation.targetTable>>,
    )
  }

  targetQuery = applyRelationModifiers(targetQuery, relation, {
    includePagination: false,
  })

  let relatedRows = await targetQuery[loadRowsWithRelations]()
  let targetRowsByThrough = groupRowsByTuple(relatedRows, relation.through.throughTargetKey)

  return sourceRows.map((sourceRow) => {
    let sourceKey = getCompositeKey(sourceRow, throughRelation.sourceKey)
    let matchedThroughRows = pagedThroughRowsBySource.get(sourceKey) ?? []
    let outputRows: Record<string, unknown>[] = []
    let seen = new Set<string>()

    for (let throughRow of matchedThroughRows) {
      let throughKey = getCompositeKey(throughRow, relation.through!.throughSourceKey)
      let rowsForThrough = targetRowsByThrough.get(throughKey) ?? []

      for (let row of rowsForThrough) {
        let rowIdentity = getCompositeKey(row, getTablePrimaryKey(relation.targetTable))

        if (!seen.has(rowIdentity)) {
          seen.add(rowIdentity)
          outputRows.push(row)
        }
      }
    }

    return applyPagination(outputRows, relation.modifiers.limit, relation.modifiers.offset)
  })
}

function applyRelationModifiers<table extends AnyTable>(
  query: QueryForTable<table>,
  relation: Relation<any, table, any, any>,
  options: { includePagination: boolean },
): QueryForTable<table, any> {
  let next = query

  for (let predicate of relation.modifiers.where) {
    next = next.where(predicate)
  }

  for (let clause of relation.modifiers.orderBy) {
    next = next.orderBy(clause.column as QueryColumns<QueryColumnTypeMap<table>>, clause.direction)
  }

  if (options.includePagination && relation.modifiers.limit !== undefined) {
    next = next.limit(relation.modifiers.limit)
  }

  if (options.includePagination && relation.modifiers.offset !== undefined) {
    next = next.offset(relation.modifiers.offset)
  }

  if (Object.keys(relation.modifiers.with).length > 0) {
    next = next.with(relation.modifiers.with)
  }

  return next
}

function applyPagination<row>(
  rows: row[],
  limit: number | undefined,
  offset: number | undefined,
): row[] {
  let offsetRows = offset === undefined ? rows : rows.slice(offset)
  return limit === undefined ? offsetRows : offsetRows.slice(0, limit)
}

function normalizeRows(rows: DataManipulationResult['rows']): Record<string, unknown>[] {
  if (!rows) {
    return []
  }

  return rows.map((row) => ({ ...row }))
}

function hasScopedWriteModifiers(state: QueryState): boolean {
  return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined
}

function asQueryTableInput<table extends AnyTable>(
  table: table,
): QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>> {
  return table as unknown as QueryTableInput<
    TableName<table>,
    TableRow<table>,
    TablePrimaryKey<table>
  >
}

function getPrimaryKeyWhere<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): SingleTableWhere<table> {
  return getPrimaryKeyObject(table, value as any) as SingleTableWhere<table>
}

function getPrimaryKeyWhereFromRow<table extends AnyTable>(
  table: table,
  row: Record<string, unknown>,
): SingleTableWhere<table> {
  let where: Record<string, unknown> = {}

  for (let key of getTablePrimaryKey(table) as string[]) {
    where[key] = row[key]
  }

  return where as SingleTableWhere<table>
}

function resolveCreateRowWhere<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  insertId: unknown,
): SingleTableWhere<table> {
  let primaryKey = getTablePrimaryKey(table) as string[]

  if (primaryKey.length === 1) {
    let key = primaryKey[0]

    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return {
        [key]: (values as Record<string, unknown>)[key],
      } as SingleTableWhere<table>
    }

    if (insertId !== undefined) {
      return {
        [key]: insertId,
      } as SingleTableWhere<table>
    }
  }

  let where: Record<string, unknown> = {}

  for (let key of primaryKey) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new DataTableQueryError(
        'create({ returnRow: true }) requires primary key values for table "' +
          getTableName(table) +
          '" when adapter does not support RETURNING',
      )
    }

    where[key] = (values as Record<string, unknown>)[key]
  }

  return where as SingleTableWhere<table>
}

function normalizeOrderByInput<table extends AnyTable>(
  input: OrderByInput<table> | undefined,
): OrderByTuple<table>[] {
  if (!input) {
    return []
  }

  if (input.length === 0) {
    return []
  }

  if (Array.isArray(input[0])) {
    return input as OrderByTuple<table>[]
  }

  return [input as OrderByTuple<table>]
}

function toWriteResult(result: WriteResult | WriteRowsResult<unknown>): WriteResult {
  return {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
  }
}

type WriteStatePolicy = {
  where: boolean
  orderBy: boolean
  limit: boolean
  offset: boolean
}

function assertWriteState(
  state: QueryState,
  operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert',
  policy: WriteStatePolicy,
): void {
  let unsupported: string[] = []

  if (state.select !== '*') {
    unsupported.push('select()')
  }

  if (state.distinct) {
    unsupported.push('distinct()')
  }

  if (state.joins.length > 0) {
    unsupported.push('join()')
  }

  if (state.groupBy.length > 0) {
    unsupported.push('groupBy()')
  }

  if (state.having.length > 0) {
    unsupported.push('having()')
  }

  if (Object.keys(state.with).length > 0) {
    unsupported.push('with()')
  }

  if (!policy.where && state.where.length > 0) {
    unsupported.push('where()')
  }

  if (!policy.orderBy && state.orderBy.length > 0) {
    unsupported.push('orderBy()')
  }

  if (!policy.limit && state.limit !== undefined) {
    unsupported.push('limit()')
  }

  if (!policy.offset && state.offset !== undefined) {
    unsupported.push('offset()')
  }

  if (unsupported.length > 0) {
    throw new DataTableQueryError(
      operation + '() does not support these query modifiers: ' + unsupported.join(', '),
    )
  }
}

async function loadPrimaryKeyRowsForScope<table extends AnyTable>(
  database: Database,
  table: table,
  state: QueryState,
): Promise<Record<string, unknown>[]> {
  let query: QueryForTable<table> = database.query<
    TableName<table>,
    TableRow<table>,
    TablePrimaryKey<table>
  >(table as unknown as QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>)

  for (let predicate of state.where) {
    query = query.where(predicate as Predicate<QueryColumnName<table>>)
  }

  for (let clause of state.orderBy) {
    query = query.orderBy(
      clause.column as QueryColumns<QueryColumnTypeMap<table>>,
      clause.direction,
    )
  }

  if (state.limit !== undefined) {
    query = query.limit(state.limit)
  }

  if (state.offset !== undefined) {
    query = query.offset(state.offset)
  }

  let rows = await query
    .select(...(getTablePrimaryKey(table) as (keyof TableRow<table> & string)[]))
    [loadRowsWithRelations]()
  let primaryKeys = getTablePrimaryKey(table) as string[]

  return rows.map((row) => {
    let keyObject: Record<string, unknown> = {}

    for (let key of rowKeys(row as Record<string, unknown>, primaryKeys)) {
      keyObject[key] = (row as Record<string, unknown>)[key]
    }

    return keyObject
  })
}

function createInitialQueryState(): QueryState {
  return {
    select: '*',
    distinct: false,
    joins: [],
    where: [],
    groupBy: [],
    having: [],
    orderBy: [],
    with: {},
  }
}

function cloneSelection(selection: '*' | SelectColumn[]): '*' | SelectColumn[] {
  if (selection === '*') {
    return '*'
  }

  return selection.map((column) => ({ ...column }))
}

function defaultNow(): Date {
  return new Date()
}

function prepareInsertValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
): Record<string, unknown> {
  let output = validateWriteValues(table, values, 'create')
  let timestamps = getTableTimestamps(table)
  let columns = getTableColumns(table)

  if (touch && timestamps) {
    let createdAt = timestamps.createdAt
    let updatedAt = timestamps.updatedAt

    if (
      Object.prototype.hasOwnProperty.call(columns, createdAt) &&
      output[createdAt] === undefined
    ) {
      output[createdAt] = now
    }

    if (
      Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
      output[updatedAt] === undefined
    ) {
      output[updatedAt] = now
    }
  }

  return output
}

function prepareUpdateValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  now: unknown,
  touch: boolean,
  operation: TableWriteOperation = 'update',
): Record<string, unknown> {
  let output = validateWriteValues(table, values, operation)
  let timestamps = getTableTimestamps(table)
  let columns = getTableColumns(table)

  if (touch && timestamps) {
    let updatedAt = timestamps.updatedAt

    if (
      Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
      output[updatedAt] === undefined
    ) {
      output[updatedAt] = now
    }
  }

  return output
}

function validateWriteValues<table extends AnyTable>(
  table: table,
  values: Partial<TableRow<table>>,
  operation: TableWriteOperation,
): Record<string, unknown> {
  let tableName = getTableName(table)
  let normalizedInput = normalizeWriteObject(table, values, operation)
  let beforeWrite = getTableBeforeWrite(table)

  if (beforeWrite) {
    let beforeWriteResult = beforeWrite({
      operation,
      tableName,
      value: normalizedInput as Partial<TableRow<table>>,
    })
    assertSynchronousCallbackResult(tableName, operation, 'beforeWrite', beforeWriteResult)

    if (hasIssues(beforeWriteResult)) {
      throwValidationIssues(tableName, beforeWriteResult.issues, operation, 'beforeWrite')
    }

    if (!hasValue(beforeWriteResult)) {
      throw new DataTableValidationError(
        'Invalid beforeWrite callback result for table "' + tableName + '"',
        [{ message: 'Expected beforeWrite to return { value } or { issues }' }],
        {
          metadata: {
            table: tableName,
            operation,
            source: 'beforeWrite',
          },
        },
      )
    }

    normalizedInput = normalizeWriteObject(table, beforeWriteResult.value, operation, 'beforeWrite')
  }

  let validator = getTableValidator(table)

  if (!validator) {
    return normalizedInput
  }

  let validationResult = validator({
    operation,
    tableName,
    value: normalizedInput as Partial<TableRow<table>>,
  })
  assertSynchronousCallbackResult(tableName, operation, 'validate', validationResult)

  if (hasIssues(validationResult)) {
    throwValidationIssues(tableName, validationResult.issues, operation, 'validate')
  }

  if (!hasValue(validationResult)) {
    throw new DataTableValidationError(
      'Invalid validator result for table "' + tableName + '"',
      [{ message: 'Expected validator to return { value } or { issues }' }],
      {
        metadata: {
          table: tableName,
          operation,
          source: 'validate',
        },
      },
    )
  }

  return normalizeWriteObject(table, validationResult.value, operation, 'validate')
}

function hasIssues(value: unknown): value is { issues: ReadonlyArray<ValidationIssue> } {
  return typeof value === 'object' && value !== null && 'issues' in value
}

function hasValue(value: unknown): value is { value: unknown } {
  return typeof value === 'object' && value !== null && 'value' in value
}

function normalizeWriteObject<table extends AnyTable>(
  table: table,
  value: unknown,
  operation: TableWriteOperation,
  source?: LifecycleCallbackSource,
): Record<string, unknown> {
  let tableName = getTableName(table)
  let columns = getTableColumns(table)

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataTableValidationError(
      'Invalid value for table "' + tableName + '"',
      [{ message: 'Expected object' }],
      {
        metadata: {
          table: tableName,
          operation,
          ...(source ? { source } : {}),
        },
      },
    )
  }

  let output: Record<string, unknown> = {}

  for (let key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue
    }

    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new DataTableValidationError(
        'Unknown column "' + key + '" for table "' + tableName + '"',
        [],
        {
          metadata: {
            table: tableName,
            column: key,
            operation,
            ...(source ? { source } : {}),
          },
        },
      )
    }

    output[key] = (value as Record<string, unknown>)[key]
  }

  return output
}

function throwValidationIssues(
  tableName: string,
  issues: ReadonlyArray<ValidationIssue>,
  operation: TableLifecycleOperation,
  source?: LifecycleCallbackSource,
): never {
  let firstIssue = issues[0]
  let issuePath = firstIssue?.path
  let firstPathSegment = issuePath && issuePath.length > 0 ? issuePath[0] : undefined
  let column = typeof firstPathSegment === 'string' ? firstPathSegment : undefined

  if (column) {
    throw new DataTableValidationError(
      'Invalid value for column "' + column + '" in table "' + tableName + '"',
      issues,
      {
        metadata: {
          table: tableName,
          column,
          operation,
          ...(source ? { source } : {}),
        },
      },
    )
  }

  throw new DataTableValidationError('Invalid value for table "' + tableName + '"', issues, {
    metadata: {
      table: tableName,
      operation,
      ...(source ? { source } : {}),
    },
  })
}

function assertSynchronousCallbackResult(
  tableName: string,
  operation: TableLifecycleOperation,
  callbackName: LifecycleCallbackSource,
  value: unknown,
): void {
  if (!isPromiseLike(value)) {
    return
  }

  throw new DataTableValidationError(
    'Invalid ' + callbackName + ' callback result for table "' + tableName + '"',
    [{ message: callbackName + ' callbacks must be synchronous and cannot return a Promise' }],
    {
      metadata: {
        table: tableName,
        operation,
        source: callbackName,
      },
    },
  )
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function runBeforeDeleteHook<table extends AnyTable>(
  table: table,
  context: TableBeforeDeleteContext,
): void {
  let callback = getTableBeforeDelete(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(context.tableName, 'delete', 'beforeDelete', callbackResult)

  if (callbackResult === undefined) {
    return
  }

  if (hasIssues(callbackResult)) {
    throwValidationIssues(context.tableName, callbackResult.issues, 'delete', 'beforeDelete')
  }

  throw new DataTableValidationError(
    'Invalid beforeDelete callback result for table "' + context.tableName + '"',
    [{ message: 'Expected beforeDelete to return nothing or { issues }' }],
    {
      metadata: {
        table: context.tableName,
        operation: 'delete',
        source: 'beforeDelete',
      },
    },
  )
}

function runAfterWriteHook<table extends AnyTable>(
  table: table,
  context: TableAfterWriteContext<TableRow<table>>,
): void {
  let callback = getTableAfterWrite(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(
    context.tableName,
    context.operation,
    'afterWrite',
    callbackResult,
  )
}

function runAfterDeleteHook<table extends AnyTable>(
  table: table,
  context: TableAfterDeleteContext,
): void {
  let callback = getTableAfterDelete(table)

  if (!callback) {
    return
  }

  let callbackResult = callback(context)
  assertSynchronousCallbackResult(context.tableName, 'delete', 'afterDelete', callbackResult)
}

function applyAfterReadHooksToRows<table extends AnyTable>(
  table: table,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  let callback = getTableAfterRead(table)

  if (!callback || rows.length === 0) {
    return rows
  }

  let tableName = getTableName(table)

  return rows.map((row) => {
    let callbackResult = callback({
      tableName,
      value: row as Partial<TableRow<table>>,
    })
    assertSynchronousCallbackResult(tableName, 'read', 'afterRead', callbackResult)

    if (hasIssues(callbackResult)) {
      throwValidationIssues(tableName, callbackResult.issues, 'read', 'afterRead')
    }

    if (!hasValue(callbackResult)) {
      throw new DataTableValidationError(
        'Invalid afterRead callback result for table "' + tableName + '"',
        [{ message: 'Expected afterRead to return { value } or { issues }' }],
        {
          metadata: {
            table: tableName,
            operation: 'read',
            source: 'afterRead',
          },
        },
      )
    }

    return normalizeReadObject(tableName, callbackResult.value)
  })
}

function applyAfterReadHooksToLoadedRows(
  table: AnyTable,
  rows: Record<string, unknown>[],
  relationMap: Record<string, AnyRelation>,
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return rows
  }

  let relationNames = Object.keys(relationMap)

  if (relationNames.length > 0) {
    for (let row of rows) {
      for (let relationName of relationNames) {
        let relation = relationMap[relationName]
        let relationValue = row[relationName]

        if (relation.cardinality === 'many') {
          if (!Array.isArray(relationValue)) {
            continue
          }

          row[relationName] = applyAfterReadHooksToLoadedRows(
            relation.targetTable,
            relationValue as Record<string, unknown>[],
            relation.modifiers.with,
          )
          continue
        }

        if (relationValue === null || relationValue === undefined) {
          continue
        }

        if (typeof relationValue !== 'object' || Array.isArray(relationValue)) {
          continue
        }

        let transformed = applyAfterReadHooksToLoadedRows(
          relation.targetTable,
          [relationValue as Record<string, unknown>],
          relation.modifiers.with,
        )
        row[relationName] = transformed[0] ?? null
      }
    }
  }

  return applyAfterReadHooksToRows(table, rows)
}

function normalizeReadObject(tableName: string, value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataTableValidationError(
      'Invalid afterRead callback result for table "' + tableName + '"',
      [{ message: 'Expected afterRead to return an object value' }],
      {
        metadata: {
          table: tableName,
          operation: 'read',
          source: 'afterRead',
        },
      },
    )
  }

  return {
    ...(value as Record<string, unknown>),
  }
}

type ResolvedPredicateColumn = {
  tableName: string
  columnName: string
}

function createPredicateColumnResolver(
  tables: AnyTable[],
): (column: string) => ResolvedPredicateColumn {
  let qualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let unqualifiedColumns = new Map<string, ResolvedPredicateColumn>()
  let ambiguousColumns = new Set<string>()

  for (let table of tables) {
    let tableColumns = getTableColumns(table)
    let tableName = getTableName(table)

    for (let columnName in tableColumns) {
      if (!Object.prototype.hasOwnProperty.call(tableColumns, columnName)) {
        continue
      }

      let resolvedColumn: ResolvedPredicateColumn = {
        tableName,
        columnName,
      }

      qualifiedColumns.set(tableName + '.' + columnName, resolvedColumn)

      if (ambiguousColumns.has(columnName)) {
        continue
      }

      if (unqualifiedColumns.has(columnName)) {
        unqualifiedColumns.delete(columnName)
        ambiguousColumns.add(columnName)
        continue
      }

      unqualifiedColumns.set(columnName, resolvedColumn)
    }
  }

  return function resolveColumn(column: string): ResolvedPredicateColumn {
    let qualified = qualifiedColumns.get(column)

    if (qualified) {
      return qualified
    }

    if (column.includes('.')) {
      throw new DataTableQueryError('Unknown predicate column "' + column + '"')
    }

    if (ambiguousColumns.has(column)) {
      throw new DataTableQueryError(
        'Ambiguous predicate column "' + column + '". Use a qualified column name',
      )
    }

    let unqualified = unqualifiedColumns.get(column)

    if (!unqualified) {
      throw new DataTableQueryError('Unknown predicate column "' + column + '"')
    }

    return unqualified
  }
}

function normalizePredicateValues(
  predicate: Predicate,
  resolveColumn: (column: string) => ResolvedPredicateColumn,
): Predicate {
  if (predicate.type === 'comparison') {
    let column = resolveColumn(predicate.column)

    if (predicate.valueType === 'column') {
      resolveColumn(predicate.value)
      return predicate
    }

    if (predicate.operator === 'in' || predicate.operator === 'notIn') {
      if (!Array.isArray(predicate.value)) {
        throw new DataTableValidationError(
          'Invalid filter value for column "' +
            column.columnName +
            '" in table "' +
            column.tableName +
            '"',
          [{ message: 'Expected an array value for "' + predicate.operator + '" predicate' }],
          {
            metadata: {
              table: column.tableName,
              column: column.columnName,
            },
          },
        )
      }

      return predicate
    }

    return predicate
  }

  if (predicate.type === 'between') {
    resolveColumn(predicate.column)
    return predicate
  }

  if (predicate.type === 'null') {
    resolveColumn(predicate.column)
    return predicate
  }

  return {
    ...predicate,
    predicates: predicate.predicates.map((child) => normalizePredicateValues(child, resolveColumn)),
  }
}

function uniqueTuples(rows: Record<string, unknown>[], columns: string[]): unknown[][] {
  let output: unknown[][] = []
  let seen = new Set<string>()

  for (let row of rows) {
    let tuple = columns.map((column) => row[column])
    let key = tuple.map(stringifyForKey).join('::')

    if (!seen.has(key)) {
      seen.add(key)
      output.push(tuple)
    }
  }

  return output
}

function buildLinkPredicate(targetColumns: string[], tuples: unknown[][]): Predicate | undefined {
  if (tuples.length === 0) {
    return undefined
  }

  if (targetColumns.length === 1) {
    return inList(
      targetColumns[0],
      tuples.map((tuple) => tuple[0]),
    )
  }

  let tuplePredicates = tuples.map((tuple) => {
    let comparisons = targetColumns.map((column, index) => eq(column, tuple[index]))

    return and(...comparisons)
  })

  return or(...tuplePredicates)
}

function groupRowsByTuple(
  rows: Record<string, unknown>[],
  columns: string[],
): Map<string, Record<string, unknown>[]> {
  let output = new Map<string, Record<string, unknown>[]>()

  for (let row of rows) {
    let key = getCompositeKey(row, columns)
    let group = output.get(key)

    if (group) {
      group.push(row)
      continue
    }

    output.set(key, [row])
  }

  return output
}

function stringifyForKey(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (value instanceof Date) {
    return 'date:' + value.toISOString()
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return JSON.stringify(value)
}

function normalizeReturningSelection<row extends Record<string, unknown>>(
  returning: ReturningInput<row>,
): ReturningSelection {
  if (returning === '*') {
    return '*'
  }

  return [...returning]
}

function buildPrimaryKeyPredicate<table extends AnyTable>(
  table: table,
  keyObjects: Record<string, unknown>[],
): Predicate<TableColumnName<table>> | undefined {
  let primaryKey = getTablePrimaryKey(table)

  if (keyObjects.length === 0) {
    return undefined
  }

  if (primaryKey.length === 1) {
    let key = primaryKey[0] as TableColumnName<table>
    return inList(
      key,
      keyObjects.map((objectValue) => objectValue[key]),
    )
  }

  let predicates = keyObjects.map((objectValue) => {
    let comparisons = primaryKey.map((key) => {
      let typedKey = key as TableColumnName<table>
      return eq(typedKey, objectValue[typedKey])
    })

    return and(...comparisons)
  })

  return or(...predicates)
}

function rowKeys(row: Record<string, unknown>, keys: string[]): string[] {
  let output: string[] = []

  for (let key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      output.push(key)
    }
  }

  return output
}

function assertReturningCapability<row extends Record<string, unknown>>(
  adapter: DatabaseAdapter,
  operation: 'insert' | 'insertMany' | 'update' | 'delete' | 'upsert',
  returning: ReturningInput<row> | undefined,
): void {
  if (returning && !adapter.capabilities.returning) {
    throw new DataTableQueryError(operation + '() returning is not supported by this adapter')
  }
}
