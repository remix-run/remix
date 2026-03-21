import type { ColumnDefinition } from './adapter.ts'
import { ColumnBuilder } from './column.ts'
import type { ColumnOutput } from './column.ts'
import type { Predicate } from './operators.ts'
import { columnMetadataKey, tableMetadataKey } from './references.ts'
import type { ColumnInput, ColumnReferenceLike, TableMetadataLike } from './references.ts'
import type { Pretty } from './types.ts'

/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from './references.ts'

/**
 * Column builder map used when declaring a table.
 */
export type TableColumnsDefinition = Record<string, ColumnBuilder<any>>

/**
 * Validation lifecycle operations.
 */
export type TableValidationOperation = 'create' | 'update'
/**
 * Write lifecycle operations.
 */
export type TableWriteOperation = TableValidationOperation
/**
 * All lifecycle operations exposed by table hooks.
 */
export type TableLifecycleOperation = TableWriteOperation | 'delete' | 'read'

/**
 * Single validation issue reported by table hooks.
 */
export type ValidationIssue = {
  message: string
  path?: Array<string | number>
}

/**
 * Validation failure returned from table hooks.
 */
export type ValidationFailure = {
  issues: ReadonlyArray<ValidationIssue>
}

/**
 * Context passed to the `validate` hook.
 */
export type TableValidationContext<row extends Record<string, unknown>> = {
  operation: TableValidationOperation
  tableName: string
  value: Partial<row>
}

/**
 * Result returned from the `validate` hook.
 */
export type TableValidationResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Validation hook that runs before writes.
 */
export type TableValidate<row extends Record<string, unknown>> = (
  context: TableValidationContext<row>,
) => TableValidationResult<row>

/**
 * Context passed to the `beforeWrite` hook.
 */
export type TableBeforeWriteContext<row extends Record<string, unknown>> = {
  operation: TableWriteOperation
  tableName: string
  value: Partial<row>
}

/**
 * Result returned from the `beforeWrite` hook.
 */
export type TableBeforeWriteResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Hook invoked before a row write executes.
 */
export type TableBeforeWrite<row extends Record<string, unknown>> = (
  context: TableBeforeWriteContext<row>,
) => TableBeforeWriteResult<row>

/**
 * Context passed to the `afterWrite` hook.
 */
export type TableAfterWriteContext<row extends Record<string, unknown>> = {
  operation: TableWriteOperation
  tableName: string
  values: ReadonlyArray<Partial<row>>
  affectedRows: number
  insertId?: unknown
}

/**
 * Hook invoked after a row write completes.
 */
export type TableAfterWrite<row extends Record<string, unknown>> = (
  context: TableAfterWriteContext<row>,
) => void

/**
 * Context passed to the `beforeDelete` hook.
 */
export type TableBeforeDeleteContext = {
  tableName: string
  where: ReadonlyArray<Predicate<string>>
  orderBy: ReadonlyArray<OrderByClause>
  limit?: number
  offset?: number
}

/**
 * Result returned from the `beforeDelete` hook.
 */
export type TableBeforeDeleteResult = void | ValidationFailure

/**
 * Hook invoked before a delete operation executes.
 */
export type TableBeforeDelete = (context: TableBeforeDeleteContext) => TableBeforeDeleteResult

/**
 * Context passed to the `afterDelete` hook.
 */
export type TableAfterDeleteContext = {
  tableName: string
  where: ReadonlyArray<Predicate<string>>
  orderBy: ReadonlyArray<OrderByClause>
  limit?: number
  offset?: number
  affectedRows: number
}

/**
 * Hook invoked after a delete operation completes.
 */
export type TableAfterDelete = (context: TableAfterDeleteContext) => void

/**
 * Context passed to the `afterRead` hook.
 */
export type TableAfterReadContext<row extends Record<string, unknown>> = {
  tableName: string
  /**
   * The current row shape being returned. This may be a projection/partial row.
   */
  value: Partial<row>
}

/**
 * Result returned from the `afterRead` hook.
 */
export type TableAfterReadResult<row extends Record<string, unknown>> =
  | { value: Partial<row> }
  | ValidationFailure

/**
 * Hook invoked after a row is read.
 */
export type TableAfterRead<row extends Record<string, unknown>> = (
  context: TableAfterReadContext<row>,
) => TableAfterReadResult<row>

type ColumnNameFromColumns<columns extends TableColumnsDefinition> = keyof columns & string

type DefaultPrimaryKey<columns extends TableColumnsDefinition> =
  'id' extends ColumnNameFromColumns<columns>
    ? readonly ['id']
    : readonly ColumnNameFromColumns<columns>[]

type NormalizePrimaryKey<
  columns extends TableColumnsDefinition,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined,
> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[]
  ? readonly [...column[]]
  : primaryKey extends ColumnNameFromColumns<columns>
    ? readonly [primaryKey]
    : DefaultPrimaryKey<columns>

/**
 * Timestamp configuration accepted by {@link table}.
 */
export type TimestampOptions = boolean | { createdAt?: string; updatedAt?: string }

/**
 * Resolved timestamp column names for a table.
 */
export type TimestampConfig = {
  createdAt: string
  updatedAt: string
}

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

type TableColumnReferences<name extends string, columns extends TableColumnsDefinition> = {
  [column in keyof columns & string]: ColumnReference<name, column>
}

type TableRowFromColumns<columns extends TableColumnsDefinition> = Pretty<{
  [column in keyof columns & string]: ColumnOutput<columns[column]>
}>

/**
 * Fully-typed table object returned by {@link table}.
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

/**
 * Sort direction accepted by `orderBy`.
 */
export type OrderDirection = 'asc' | 'desc'

/**
 * Normalized `orderBy` clause.
 */
export type OrderByClause = {
  column: string
  direction: OrderDirection
}

export type CreateTableOptions<
  name extends string,
  columns extends TableColumnsDefinition,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined,
> = {
  name: name
  columns: columns
  primaryKey?: primaryKey
  timestamps?: TimestampOptions
  beforeWrite?: TableBeforeWrite<TableRowFromColumns<columns>>
  afterWrite?: TableAfterWrite<TableRowFromColumns<columns>>
  beforeDelete?: TableBeforeDelete
  afterDelete?: TableAfterDelete
  afterRead?: TableAfterRead<TableRowFromColumns<columns>>
  validate?: TableValidate<TableRowFromColumns<columns>>
}

let defaultTimestampConfig: TimestampConfig = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 * @example
 * ```ts
 * import { column as c, table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer(),
 *     email: c.varchar(255),
 *   },
 *   primaryKey: 'id',
 * })
 * ```
 */
export function table<
  name extends string,
  columns extends TableColumnsDefinition,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined = undefined,
>(
  options: CreateTableOptions<name, columns, primaryKey>,
): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>> {
  let tableName = options.name
  let columns = options.columns

  let resolvedPrimaryKey = normalizePrimaryKey(tableName, columns, options.primaryKey)
  let timestampConfig = normalizeTimestampConfig(options.timestamps)
  let columnDefinitions = resolveTableColumns(tableName, columns)
  let table = Object.create(null) as Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>

  Object.defineProperty(table, tableMetadataKey, {
    value: Object.freeze({
      name: tableName,
      columns,
      primaryKey: resolvedPrimaryKey,
      timestamps: timestampConfig,
      columnDefinitions,
      beforeWrite: options.beforeWrite as
        | TableBeforeWrite<TableRowFromColumns<columns>>
        | undefined,
      afterWrite: options.afterWrite as TableAfterWrite<TableRowFromColumns<columns>> | undefined,
      beforeDelete: options.beforeDelete as TableBeforeDelete | undefined,
      afterDelete: options.afterDelete as TableAfterDelete | undefined,
      afterRead: options.afterRead as TableAfterRead<TableRowFromColumns<columns>> | undefined,
      validate: options.validate as TableValidate<TableRowFromColumns<columns>> | undefined,
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  })

  for (let columnName in columns) {
    if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
      continue
    }

    let column = createColumnReference(tableName, columnName)

    Object.defineProperty(table, columnName, {
      value: column,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }

  return Object.freeze(table) as Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>
}

function createColumnReference<tableName extends string, columnName extends string>(
  tableName: tableName,
  columnName: columnName,
): ColumnReference<tableName, columnName> {
  return Object.freeze({
    kind: 'column',
    [columnMetadataKey]: Object.freeze({
      tableName,
      columnName,
      qualifiedName: tableName + '.' + columnName,
    }),
  }) as ColumnReference<tableName, columnName>
}

function resolveTableColumns<columns extends TableColumnsDefinition>(
  tableName: string,
  columns: columns,
): { [column in keyof columns & string]: ColumnDefinition } {
  let columnDefinitions: Record<string, ColumnDefinition> = {}

  for (let columnName in columns) {
    if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
      continue
    }

    let column = columns[columnName]

    if (!(column instanceof ColumnBuilder)) {
      throw new Error(
        'Invalid column "' +
          columnName +
          '" for table "' +
          tableName +
          '". Expected a column(...) builder',
      )
    }

    columnDefinitions[columnName] = column.build()
  }

  return Object.freeze(columnDefinitions) as {
    [column in keyof columns & string]: ColumnDefinition
  }
}

function normalizePrimaryKey(
  tableName: string,
  columns: TableColumnsDefinition,
  primaryKey?: string | readonly string[],
): string[] {
  if (primaryKey === undefined) {
    if (!Object.prototype.hasOwnProperty.call(columns, 'id')) {
      throw new Error(
        'Table "' + tableName + '" must include an "id" column or an explicit primaryKey',
      )
    }

    return ['id']
  }

  let keys = Array.isArray(primaryKey) ? [...primaryKey] : [primaryKey]

  if (keys.length === 0) {
    throw new Error('Table "' + tableName + '" primaryKey must contain at least one column')
  }

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new Error('Table "' + tableName + '" primaryKey column "' + key + '" does not exist')
    }
  }

  return keys
}

function normalizeTimestampConfig(options: TimestampOptions | undefined): TimestampConfig | null {
  if (!options) {
    return null
  }

  if (options === true) {
    return { ...defaultTimestampConfig }
  }

  return {
    createdAt: options.createdAt ?? defaultTimestampConfig.createdAt,
    updatedAt: options.updatedAt ?? defaultTimestampConfig.updatedAt,
  }
}
