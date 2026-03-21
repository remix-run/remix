import { ColumnBuilder } from '../column.ts'
import type { ColumnDefinition } from '../adapter.ts'
import type { ColumnReference } from './metadata.ts'
import { columnMetadataKey, tableMetadataKey } from '../references.ts'
import type {
  TableAfterDelete,
  TableAfterRead,
  TableAfterWrite,
  TableBeforeDelete,
  TableBeforeWrite,
  TableValidate,
} from './lifecycle.ts'
import type {
  TableColumnsDefinition,
  Table,
  TableRowFromColumns,
  TimestampConfig,
  TimestampOptions,
} from './metadata.ts'

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
 * Table declaration options.
 */
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

const defaultTimestampConfig: TimestampConfig = {
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
