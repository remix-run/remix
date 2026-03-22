import type { ColumnDefinition } from '../adapter.ts'
import type { ColumnBuilder } from '../column.ts'
import type { AnyRelation } from '../table-relations.ts'
import type {
  AnyTable,
  TableName,
  TableRow,
  TableValidate,
  TimestampConfig,
} from '../table.ts'
import type { tableMetadataKey } from '../table.ts'
import type { Pretty } from '../types.ts'
import type { WriteResult, WriteRowResult, WriteRowsResult } from '../database.ts'
import type { OrderDirection } from '../table.ts'
import type { ColumnInput, NormalizeColumnInput, TableMetadataLike } from '../references.ts'
import type { WhereInput } from '../operators.ts'
import type { QueryExecutionMode } from './plan.ts'

type RowColumnName<row extends Record<string, unknown>> = keyof row & string
type QualifiedRowColumnName<
  tableName extends string,
  row extends Record<string, unknown>,
> = `${tableName}.${RowColumnName<row>}`

type QueryBindingState = 'bound' | 'unbound'

export type QueryPhase<
  binding extends QueryBindingState = QueryBindingState,
  mode extends QueryExecutionMode = QueryExecutionMode,
> = {
  binding: binding
  mode: mode
}

export type BoundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<
  'bound',
  mode
>

export type UnboundQueryPhase<mode extends QueryExecutionMode = QueryExecutionMode> = QueryPhase<
  'unbound',
  mode
>

export type AnyQuerySource = QueryTableInput<string, Record<string, unknown>, readonly string[]>

export type QuerySourceTableName<source extends AnyQuerySource> =
  source extends QueryTableInput<infer tableName, any, any> ? tableName : never

export type QuerySourceRow<source extends AnyQuerySource> =
  source extends QueryTableInput<any, infer row, any> ? row : never

export type QuerySourcePrimaryKey<source extends AnyQuerySource> =
  source extends QueryTableInput<any, any, infer primaryKey> ? primaryKey : never

export type QuerySourceColumnTypes<source extends AnyQuerySource> = Pretty<
  QueryColumnTypeMapFromRow<QuerySourceTableName<source>, QuerySourceRow<source>>
>

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

export type QueryColumnName<table extends AnyTable> =
  | (keyof TableRow<table> & string)
  | `${TableName<table>}.${keyof TableRow<table> & string}`

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

export type QueryColumnTypesForTable<table extends AnyTable> = QueryColumnTypeMap<table>

export type QueryResultMap<row extends Record<string, unknown>, loaded extends Record<string, unknown>> = {
  all: Array<row & loaded>
  first: (row & loaded) | null
  find: (row & loaded) | null
  count: number
  exists: boolean
  insert: WriteResult | WriteRowResult<row>
  insertMany: WriteResult | WriteRowsResult<row>
  update: WriteResult | WriteRowsResult<row>
  delete: WriteResult | WriteRowsResult<row>
  upsert: WriteResult | WriteRowResult<row>
}

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

export type UpdateManyOptions<table extends AnyTable> = Omit<UpdateOptions<table>, 'with'>

export type DeleteOptions<table extends AnyTable> = {
  with?: RelationMapForSourceName<TableName<table>>
}

export type CreateOptions<table extends AnyTable> = {
  touch?: boolean
  returnRow?: boolean
  with?: RelationMapForSourceName<TableName<table>>
}

export type CreateManyOptions<table extends AnyTable> = {
  touch?: boolean
  returnRows?: boolean
  with?: RelationMapForSourceName<TableName<table>>
}

export type InsertManyOptions<table extends AnyTable> = CreateManyOptions<table>
