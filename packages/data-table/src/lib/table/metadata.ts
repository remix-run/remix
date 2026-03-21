import type { ColumnDefinition } from '../adapter.ts'
import type { ColumnBuilder } from '../column.ts'
import type { ColumnOutput } from '../column.ts'
import { tableMetadataKey } from '../references.ts'
import type {
  columnMetadataKey,
  ColumnInput,
  ColumnReferenceLike,
  TableMetadataLike,
} from '../references.ts'
import type {
  TableAfterDelete,
  TableAfterRead,
  TableAfterWrite,
  TableBeforeDelete,
  TableBeforeWrite,
  TableValidate,
} from './lifecycle.ts'
import type { Pretty } from '../types.ts'

/**
 * Column builder map used when declaring a table.
 */
export type TableColumnsDefinition = Record<string, ColumnBuilder<any>>

/**
 * Resolved timestamp column names for a table.
 */
export type TimestampConfig = {
  createdAt: string
  updatedAt: string
}

/**
 * Timestamp configuration accepted by the `Table` factory.
 */
export type TimestampOptions = boolean | { createdAt?: string; updatedAt?: string }

type ColumnNameFromColumns<columns extends TableColumnsDefinition> = keyof columns & string

type TableColumnReferences<name extends string, columns extends TableColumnsDefinition> = {
  [column in keyof columns & string]: ColumnReference<name, column>
}

export type TableRowFromColumns<columns extends TableColumnsDefinition> = Pretty<{
  [column in keyof columns & string]: ColumnOutput<columns[column]>
}>

type TableMetadata<
  name extends string,
  columns extends TableColumnsDefinition,
  primaryKey extends readonly ColumnNameFromColumns<columns>[],
> = {
  name: name
  columns: columns
  primaryKey: primaryKey
  timestamps: TimestampConfig | null
  columnDefinitions: {
    [column in keyof columns & string]: ColumnDefinition
  }
  beforeWrite?: TableBeforeWrite<TableRowFromColumns<columns>>
  afterWrite?: TableAfterWrite<TableRowFromColumns<columns>>
  beforeDelete?: TableBeforeDelete
  afterDelete?: TableAfterDelete
  afterRead?: TableAfterRead<TableRowFromColumns<columns>>
  validate?: TableValidate<TableRowFromColumns<columns>>
}

/**
 * Typed reference to a table column.
 */
export type ColumnReference<
  tableName extends string,
  columnName extends string,
> = ColumnReferenceLike<`${tableName}.${columnName}`> & {
  [columnMetadataKey]: {
    tableName: tableName
    columnName: columnName
    qualifiedName: `${tableName}.${columnName}`
  }
}

/**
 * Any column reference.
 */
export type AnyColumn = ColumnReference<string, string>

/**
 * Column reference narrowed by a qualified column name string.
 */
export type ColumnReferenceForQualifiedName<qualifiedName extends string> = AnyColumn & {
  [columnMetadataKey]: {
    qualifiedName: qualifiedName
  }
}

/**
 * Fully-typed table object returned by the `Table` factory.
 */
export type Table<
  name extends string,
  columns extends TableColumnsDefinition,
  primaryKey extends readonly ColumnNameFromColumns<columns>[],
> = TableMetadataLike<name, columns, primaryKey, TimestampConfig | null> & {
  [tableMetadataKey]: TableMetadata<name, columns, primaryKey>
} & TableColumnReferences<name, columns>

/**
 * Table-like object with erased concrete column types.
 */
export type AnyTable = TableMetadataLike<
  string,
  TableColumnsDefinition,
  readonly string[],
  TimestampConfig | null
> & {
  [tableMetadataKey]: {
    name: string
    columns: TableColumnsDefinition
    primaryKey: readonly string[]
    timestamps: TimestampConfig | null
    columnDefinitions: Record<string, ColumnDefinition>
    beforeWrite?: unknown
    afterWrite?: unknown
    beforeDelete?: unknown
    afterDelete?: unknown
    afterRead?: unknown
    validate?: TableValidate<Record<string, unknown>>
  }
} & Record<string, unknown>

/**
 * Name of a concrete table.
 */
export type TableName<table extends AnyTable> = table[typeof tableMetadataKey]['name']

/**
 * Column builder map for a concrete table.
 */
export type TableColumns<table extends AnyTable> = table[typeof tableMetadataKey]['columns']

/**
 * Primary-key column list for a concrete table.
 */
export type TablePrimaryKey<table extends AnyTable> = table[typeof tableMetadataKey]['primaryKey']

/**
 * Timestamp configuration for a concrete table.
 */
export type TableTimestamps<table extends AnyTable> = table[typeof tableMetadataKey]['timestamps']

/**
 * Row shape produced by a concrete table.
 */
export type TableRow<table extends AnyTable> = TableRowFromColumns<TableColumns<table>>

/**
 * Row shape with loaded relations merged in.
 */
export type TableRowWith<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
> = Pretty<TableRow<table> & loaded>

/**
 * Unqualified column names for a concrete table.
 */
export type TableColumnName<table extends AnyTable> = keyof TableColumns<table> & string

export type QualifiedTableColumnName<table extends AnyTable> =
  `${TableName<table>}.${TableColumnName<table>}`

/**
 * Column input accepted for a concrete table.
 */
export type TableColumnInput<table extends AnyTable> = ColumnInput<
  TableColumnName<table> | QualifiedTableColumnName<table>
>

/**
 * Plain metadata snapshot of a table.
 */
export type TableReference<table extends AnyTable = AnyTable> = {
  kind: 'table'
  name: TableName<table>
  columns: TableColumns<table>
  primaryKey: TablePrimaryKey<table>
  timestamps: TableTimestamps<table>
}

/**
 * Creates a plain table reference snapshot from a table instance.
 * @param table Source table instance.
 * @returns Table metadata snapshot.
 */
export function getTableReference<table extends AnyTable>(table: table): TableReference<table> {
  let metadata = table[tableMetadataKey]

  return {
    kind: 'table',
    name: metadata.name as TableName<table>,
    columns: metadata.columns as TableColumns<table>,
    primaryKey: metadata.primaryKey as TablePrimaryKey<table>,
    timestamps: metadata.timestamps as TableTimestamps<table>,
  }
}

/**
 * Returns a table's SQL name.
 * @param table Source table instance.
 * @returns Table SQL name.
 */
export function getTableName<table extends AnyTable>(table: table): TableName<table> {
  return table[tableMetadataKey].name as TableName<table>
}

/**
 * Returns a table's column builder map.
 * @param table Source table instance.
 * @returns Table column builder map.
 */
export function getTableColumns<table extends AnyTable>(table: table): TableColumns<table> {
  return table[tableMetadataKey].columns as TableColumns<table>
}

/**
 * Returns a table's resolved physical column definitions.
 * @param table Source table instance.
 * @returns Column definition map.
 */
export function getTableColumnDefinitions<table extends AnyTable>(
  table: table,
): {
  [column in keyof TableColumns<table> & string]: ColumnDefinition
} {
  return table[tableMetadataKey].columnDefinitions as {
    [column in keyof TableColumns<table> & string]: ColumnDefinition
  }
}

/**
 * Returns a table's optional write validator.
 * @param table Source table instance.
 * @returns Validation function or `undefined`.
 */
export function getTableValidator<table extends AnyTable>(
  table: table,
): TableValidate<TableRow<table>> | undefined {
  return table[tableMetadataKey].validate as TableValidate<TableRow<table>> | undefined
}

/**
 * Returns a table's optional before-write lifecycle callback.
 * @param table Source table instance.
 * @returns Before-write callback or `undefined`.
 */
export function getTableBeforeWrite<table extends AnyTable>(
  table: table,
): TableBeforeWrite<TableRow<table>> | undefined {
  return table[tableMetadataKey].beforeWrite as TableBeforeWrite<TableRow<table>> | undefined
}

/**
 * Returns a table's optional after-write lifecycle callback.
 * @param table Source table instance.
 * @returns After-write callback or `undefined`.
 */
export function getTableAfterWrite<table extends AnyTable>(
  table: table,
): TableAfterWrite<TableRow<table>> | undefined {
  return table[tableMetadataKey].afterWrite as TableAfterWrite<TableRow<table>> | undefined
}

/**
 * Returns a table's optional before-delete lifecycle callback.
 * @param table Source table instance.
 * @returns Before-delete callback or `undefined`.
 */
export function getTableBeforeDelete<table extends AnyTable>(
  table: table,
): TableBeforeDelete | undefined {
  return table[tableMetadataKey].beforeDelete as TableBeforeDelete | undefined
}

/**
 * Returns a table's optional after-delete lifecycle callback.
 * @param table Source table instance.
 * @returns After-delete callback or `undefined`.
 */
export function getTableAfterDelete<table extends AnyTable>(
  table: table,
): TableAfterDelete | undefined {
  return table[tableMetadataKey].afterDelete as TableAfterDelete | undefined
}

/**
 * Returns a table's optional after-read lifecycle callback.
 * The callback receives the current read shape, which may be a projected partial row.
 * @param table Source table instance.
 * @returns After-read callback or `undefined`.
 */
export function getTableAfterRead<table extends AnyTable>(
  table: table,
): TableAfterRead<TableRow<table>> | undefined {
  return table[tableMetadataKey].afterRead as TableAfterRead<TableRow<table>> | undefined
}

/**
 * Returns a table's primary key columns.
 * @param table Source table instance.
 * @returns Primary key columns.
 */
export function getTablePrimaryKey<table extends AnyTable>(table: table): TablePrimaryKey<table> {
  return table[tableMetadataKey].primaryKey as TablePrimaryKey<table>
}

/**
 * Returns a table's resolved timestamp configuration.
 * @param table Source table instance.
 * @returns Timestamp configuration or `null`.
 */
export function getTableTimestamps<table extends AnyTable>(table: table): TableTimestamps<table> {
  return table[tableMetadataKey].timestamps as TableTimestamps<table>
}
