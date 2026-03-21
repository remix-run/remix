import type { ColumnDefinition, CreateTableOperation, ForeignKeyConstraint, TableRef } from '../adapter.ts'
import { ColumnBuilder } from '../column.ts'
import type {
  CreateIndexOptions,
  ForeignKeyOptions,
  KeyColumns,
  NamedConstraintOptions,
  TableInput,
} from '../migrations.ts'
import { getTableColumnDefinitions, getTableName, getTablePrimaryKey } from '../table.ts'
import type { AnyTable } from '../table.ts'

import {
  createCheckName,
  createForeignKeyName,
  createIndexName,
  createPrimaryKeyName,
  createUniqueName,
  normalizeKeyColumns,
  toTableRef,
} from './helpers.ts'

export function toMigrationTableRef(value: TableInput): TableRef {
  if (typeof value === 'string') {
    return toTableRef(value)
  }

  return toTableRef(getTableName(value))
}

export function toMigrationColumnDefinition(
  definition: ColumnDefinition | ColumnBuilder,
): ColumnDefinition {
  if (definition instanceof ColumnBuilder) {
    return definition.build()
  }

  return definition
}

export function lowerTableForCreate(table: AnyTable): CreateTableOperation {
  let tableRef = toTableRef(getTableName(table))
  let sourceColumnDefinitions = getTableColumnDefinitions(table)
  let columns: Record<string, ColumnDefinition> = {}
  let uniques: NonNullable<CreateTableOperation['uniques']> = []
  let checks: NonNullable<CreateTableOperation['checks']> = []
  let foreignKeys: NonNullable<CreateTableOperation['foreignKeys']> = []

  for (let columnName in sourceColumnDefinitions) {
    if (!Object.prototype.hasOwnProperty.call(sourceColumnDefinitions, columnName)) {
      continue
    }

    let sourceDefinition = sourceColumnDefinitions[columnName]
    let columnDefinition: ColumnDefinition = {
      ...sourceDefinition,
      checks: undefined,
      references: undefined,
      primaryKey: undefined,
    }

    let unique = sourceDefinition.unique

    if (unique) {
      let uniqueName =
        typeof unique === 'object' && unique.name
          ? unique.name
          : createUniqueName(tableRef, [columnName])
      uniques.push({
        name: uniqueName,
        columns: [columnName],
      })
      columnDefinition.unique = undefined
    }

    if (sourceDefinition.checks) {
      for (let check of sourceDefinition.checks) {
        checks.push({
          name: check.name || createCheckName(tableRef, check.expression),
          expression: check.expression,
        })
      }
    }

    if (sourceDefinition.references) {
      let referenceColumns = [...sourceDefinition.references.columns]
      let referencesTable = { ...sourceDefinition.references.table }
      foreignKeys.push({
        name:
          sourceDefinition.references.name ||
          createForeignKeyName(tableRef, [columnName], referencesTable, referenceColumns),
        columns: [columnName],
        references: {
          table: referencesTable,
          columns: referenceColumns,
        },
        onDelete: sourceDefinition.references.onDelete,
        onUpdate: sourceDefinition.references.onUpdate,
      })
    }

    columns[columnName] = columnDefinition
  }

  let primaryKeyColumns = [...getTablePrimaryKey(table)]
  let primaryKey = primaryKeyColumns.length
    ? {
        columns: primaryKeyColumns,
        name: createPrimaryKeyName(tableRef),
      }
    : undefined

  return {
    kind: 'createTable',
    table: tableRef,
    columns,
    primaryKey,
    uniques: uniques.length ? uniques : undefined,
    checks: checks.length ? checks : undefined,
    foreignKeys: foreignKeys.length ? foreignKeys : undefined,
  }
}

export function createIndexOperation(
  table: TableInput,
  columns: string | string[],
  options?: CreateIndexOptions,
): ReturnType<typeof createIndexOperationForTableRef> {
  return createIndexOperationForTableRef(toMigrationTableRef(table), columns, options)
}

export function createIndexOperationForTableRef(
  table: TableRef,
  columns: string | string[],
  options?: CreateIndexOptions,
): {
  kind: 'createIndex'
  index: {
    table: TableRef
    name: string
    columns: string[]
    unique?: boolean
    using?: CreateIndexOptions['using']
    where?: string
  }
  ifNotExists?: boolean
} {
  return buildCreateIndexOperation(table, columns, options)
}

function buildCreateIndexOperation(
  table: TableRef,
  columns: string | string[],
  options?: CreateIndexOptions,
): {
  kind: 'createIndex'
  index: {
    table: TableRef
    name: string
    columns: string[]
    unique?: boolean
    using?: CreateIndexOptions['using']
    where?: string
  }
  ifNotExists?: boolean
} {
  let normalizedColumns = normalizeKeyColumns(columns)
  let { name, ifNotExists, ...indexOptions } = options ?? {}

  return {
    kind: 'createIndex',
    index: {
      table,
      name: name ?? createIndexName(table, normalizedColumns),
      columns: normalizedColumns,
      ...indexOptions,
    },
    ifNotExists,
  }
}

export function createForeignKeyConstraint(
  table: TableRef,
  columns: KeyColumns,
  refTable: TableInput,
  refColumns?: KeyColumns,
  options?: ForeignKeyOptions,
): ForeignKeyConstraint {
  let normalizedColumns = normalizeKeyColumns(columns)
  let referencesTable = toMigrationTableRef(refTable)
  let normalizedReferenceColumns = refColumns ? normalizeKeyColumns(refColumns) : ['id']

  return {
    columns: normalizedColumns,
    references: {
      table: referencesTable,
      columns: normalizedReferenceColumns,
    },
    name:
      options?.name ??
      createForeignKeyName(
        table,
        normalizedColumns,
        referencesTable,
        normalizedReferenceColumns,
      ),
    onDelete: options?.onDelete,
    onUpdate: options?.onUpdate,
  }
}

export function createCheckConstraint(
  table: TableRef,
  expression: string,
  options?: NamedConstraintOptions,
): {
  expression: string
  name: string
} {
  return {
    expression,
    name: options?.name ?? createCheckName(table, expression),
  }
}
