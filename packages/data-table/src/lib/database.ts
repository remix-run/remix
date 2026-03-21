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
  createScopedQuery,
  getPrimaryKeyWhere,
  getPrimaryKeyWhereFromRow,
  requireLoadedRow,
  resolveCreateRowWhere,
  toLoadedRow,
  toLoadedRowOrNull,
  toLoadedRows,
  toWriteResult,
  toWriteRow,
  toWriteRows,
} from './database/helpers.ts'
import { executeQuery } from './database/query-execution.ts'
import type {
  AnyQuery,
  BoundQueryPhase,
  Query as QueryObject,
  QueryExecutionResult,
} from './query.ts'
import { bindQueryRuntime, query as createQuery } from './query.ts'
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts'
import type { SqlStatement } from './sql.ts'
import { isSqlStatement, rawSql } from './sql.ts'
import type {
  AnyTable,
  OrderDirection,
  TableName,
  TablePrimaryKey,
  TableRow,
  TableRowWith,
  TableValidate,
  tableMetadataKey,
  TimestampConfig,
} from './table.ts'
import type { AnyRelation, LoadedRelationMap } from './table-relations.ts'
import type { PrimaryKeyInput } from './table-keys.ts'
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
  QueryTableInput<TableName<table>, TableRow<table>, TablePrimaryKey<table>>,
  QueryColumnTypesForTable<table>,
  TableRow<table>,
  loaded,
  BoundQueryPhase<'all'>
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
  token?: TransactionToken
  savepointCounter?: SavepointCounter
}

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
    this.#token = options?.token
    this.#savepointCounter = options?.savepointCounter ?? { value: 0 }
  }

  get adapter(): DatabaseAdapter {
    return this.#adapter
  }

  now(): unknown {
    return this.#now()
  }

  query<
    table extends AnyTable,
  >(table: table): QueryForTable<table>
  query<
    tableName extends string,
    row extends Record<string, unknown>,
    primaryKey extends readonly (keyof row & string)[],
  >(
    table: QueryTableInput<tableName, row, primaryKey>,
  ): QueryObject<
    QueryTableInput<tableName, row, primaryKey>,
    Pretty<QueryColumnTypeMapFromRow<tableName, row>>,
    row,
    {},
    BoundQueryPhase<'all'>
  > {
    return createQuery(table)[bindQueryRuntime](this) as QueryObject<
      QueryTableInput<tableName, row, primaryKey>,
      Pretty<QueryColumnTypeMapFromRow<tableName, row>>,
      row,
      {},
      BoundQueryPhase<'all'>
    >
  }

  #createTransactionDatabase(token: TransactionToken): Database {
    return new Database(this.#adapter, {
      now: this.#now,
      token,
      savepointCounter: this.#savepointCounter,
    })
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
    let query = this.query(table)

    if (options?.returnRow !== true) {
      let result = await query.insert(values, { touch })
      return toWriteResult(result)
    }

    if (this.#adapter.capabilities.returning) {
      let result = await query.insert(values, {
        returning: '*',
        touch,
      })
      let row = requireLoadedRow(
        toWriteRow(result),
        'create({ returnRow: true }) failed to return an inserted row',
      )

      if (!options.with) {
        return toLoadedRow<table, LoadedRelationMap<relations>>(row)
      }

      return requireLoadedRow(
        await this.findOne(table, {
          where: getPrimaryKeyWhereFromRow(table, row),
          with: options.with,
        }),
        'create({ returnRow: true }) failed to load inserted row',
      )
    }

    let insertResult = await query.insert(values, { touch })
    return requireLoadedRow(
      await this.findOne(table, {
        where: resolveCreateRowWhere(table, values, insertResult.insertId),
        with: options.with,
      }),
      'create({ returnRow: true }) failed to load inserted row',
    )
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
    let query = this.query(table)

    if (options?.returnRows === true) {
      if (!this.#adapter.capabilities.returning) {
        throw new DataTableQueryError(
          'createMany({ returnRows: true }) is not supported by this adapter',
        )
      }

      let result = await query.insertMany(values, {
        returning: '*',
        touch: options.touch,
      })

      return toWriteRows(result)
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

    let query = this.query(table)

    if (options?.with) {
      return toLoadedRowOrNull<table, LoadedRelationMap<relations>>(
        await query.with(options.with).find(value),
      )
    }

    return toLoadedRowOrNull<table, LoadedRelationMap<relations>>(await query.find(value))
  }

  async findOne<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options: FindOneOptions<table, relations>,
  ): Promise<TableRowWith<table, LoadedRelationMap<relations>> | null> {
    let query = createScopedQuery(this.query(table), options)

    if (options.with) {
      return toLoadedRowOrNull<table, LoadedRelationMap<relations>>(
        await query.with(options.with).first(),
      )
    }

    return toLoadedRowOrNull<table, LoadedRelationMap<relations>>(await query.first())
  }

  async findMany<
    table extends AnyTable,
    relations extends RelationMapForSourceName<TableName<table>> = {},
  >(
    table: table,
    options?: FindManyOptions<table, relations>,
  ): Promise<Array<TableRowWith<table, LoadedRelationMap<relations>>>> {
    let query = createScopedQuery(this.query(table), options)

    if (options?.with) {
      return toLoadedRows<table, LoadedRelationMap<relations>>(await query.with(options.with).all())
    }

    return toLoadedRows<table, LoadedRelationMap<relations>>(await query.all())
  }

  async count<table extends AnyTable>(
    table: table,
    options?: CountOptions<table>,
  ): Promise<number> {
    let query = createScopedQuery(this.query(table), options)
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
      let updateResult = await this.query(table)
        .where(where)
        .update(changes, {
          touch: options?.touch,
          returning: '*',
        })
      let updatedRow = requireLoadedRow(
        toWriteRows(updateResult)[0] ?? null,
        'update() failed to find row for table "' + getTableName(table) + '"',
      )

      if (!options?.with) {
        return toLoadedRow<table, LoadedRelationMap<relations>>(updatedRow)
      }

      return requireLoadedRow(
        await this.findOne(table, {
          where: getPrimaryKeyWhereFromRow(table, updatedRow),
          with: options.with,
        }),
        'update() failed to find row for table "' + getTableName(table) + '"',
      )
    }

    await this.query(table)
      .where(where)
      .update(changes, {
        touch: options?.touch,
      })

    return requireLoadedRow(
      await this.find(table, value, { with: options?.with }),
      'update() failed to find row for table "' + getTableName(table) + '"',
    )
  }

  async updateMany<table extends AnyTable>(
    table: table,
    changes: Partial<TableRow<table>>,
    options: UpdateManyOptions<table>,
  ): Promise<WriteResult> {
    let query = createScopedQuery(this.query(table), options)

    let result = await query.update(changes, { touch: options.touch })
    return toWriteResult(result)
  }

  async delete<table extends AnyTable>(
    table: table,
    value: PrimaryKeyInput<table>,
  ): Promise<boolean> {
    let where = getPrimaryKeyWhere(table, value)
    let result = await this.query(table)
      .where(where)
      .delete()

    return result.affectedRows > 0
  }

  async deleteMany<table extends AnyTable>(
    table: table,
    options: DeleteManyOptions<table>,
  ): Promise<WriteResult> {
    let query = createScopedQuery(this.query(table), options)

    let result = await query.delete()
    return toWriteResult(result)
  }

  async exec(statement: string | SqlStatement, values?: unknown[]): Promise<DataManipulationResult>
  async exec<input extends AnyQuery>(input: input): Promise<QueryExecutionResult<input>>
  async exec<input extends AnyQuery>(
    statementOrInput: string | SqlStatement | input,
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
      let tx = this.#createTransactionDatabase(token)

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

function defaultNow(): Date {
  return new Date()
}
