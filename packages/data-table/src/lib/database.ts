import type {
  ColumnDefinition,
  DatabaseAdapter,
  DataManipulationResult,
  TransactionOptions,
  TransactionToken,
} from './adapter.ts'
import type { ColumnBuilder } from './column.ts'
import { QueryBuilder } from './database/query-builder.ts'
import { Database, withDatabaseInternals } from './database/runtime.ts'
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from './references.ts'
import type { SqlStatement } from './sql.ts'
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
 * Query builder type produced for a table-like input.
 */
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

/**
 * Signature of the database `query` helper.
 */
export type QueryMethod = <
  tableName extends string,
  row extends Record<string, unknown>,
  primaryKey extends readonly (keyof row & string)[],
>(
  table: QueryTableInput<tableName, row, primaryKey>,
) => QueryBuilderFor<tableName, row, primaryKey>

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
 * Query builder type produced for a concrete table.
 */
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
  return new Database(
    adapter,
    withDatabaseInternals(options, {
      token,
      savepointCounter: { value: 0 },
    }),
  )
}

export { Database, QueryBuilder }
