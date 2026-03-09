import type { Database } from '../database.ts'
import type {
  AlterTableChange,
  CheckConstraint,
  ColumnDefinition,
  CreateTableOperation,
  DataMigrationOperation,
  ForeignKeyConstraint,
  PrimaryKeyConstraint,
  TableRef,
  TransactionToken,
  UniqueConstraint,
} from '../adapter.ts'
import { rawSql } from '../sql.ts'
import { getTableColumnDefinitions, getTableName, getTablePrimaryKey } from '../table.ts'
import type { AnyTable } from '../table.ts'
import type {
  AlterTableBuilder,
  CreateIndexOptions,
  ForeignKeyOptions,
  KeyColumns,
  MigrationSchema,
  NamedConstraintOptions,
  TableInput,
} from '../migrations.ts'

import { ColumnBuilder } from '../column.ts'
import {
  createCheckName,
  createForeignKeyName,
  createIndexName,
  createPrimaryKeyName,
  createUniqueName,
  normalizeIndexColumns,
  normalizeKeyColumns,
  toTableRef,
} from './helpers.ts'

function asColumnDefinition(definition: ColumnDefinition | ColumnBuilder): ColumnDefinition {
  if (definition instanceof ColumnBuilder) {
    return definition.build()
  }

  return definition
}

function asTableRef(value: TableInput): TableRef {
  if (typeof value === 'string') {
    return toTableRef(value)
  }

  return toTableRef(getTableName(value))
}

function lowerTableForCreate(table: AnyTable): CreateTableOperation {
  let tableRef = toTableRef(getTableName(table))
  let sourceColumnDefinitions = getTableColumnDefinitions(table)
  let columns: Record<string, ColumnDefinition> = {}
  let uniques: UniqueConstraint[] = []
  let checks: CheckConstraint[] = []
  let foreignKeys: ForeignKeyConstraint[] = []

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
  let primaryKey: PrimaryKeyConstraint | undefined

  if (primaryKeyColumns.length > 0) {
    primaryKey = {
      columns: primaryKeyColumns,
      name: createPrimaryKeyName(tableRef),
    }
  }

  return {
    kind: 'createTable',
    table: tableRef,
    columns,
    primaryKey,
    uniques: uniques.length > 0 ? uniques : undefined,
    checks: checks.length > 0 ? checks : undefined,
    foreignKeys: foreignKeys.length > 0 ? foreignKeys : undefined,
  }
}

class AlterTableBuilderRuntime implements AlterTableBuilder {
  alterChanges: AlterTableChange[] = []
  extraStatements: DataMigrationOperation[] = []
  table: TableRef

  constructor(table: TableRef) {
    this.table = table
  }

  addColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void {
    this.alterChanges.push({
      kind: 'addColumn',
      column: name,
      definition: asColumnDefinition(definition),
    })
  }

  changeColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void {
    this.alterChanges.push({
      kind: 'changeColumn',
      column: name,
      definition: asColumnDefinition(definition),
    })
  }

  renameColumn(from: string, to: string): void {
    this.alterChanges.push({ kind: 'renameColumn', from, to })
  }

  dropColumn(name: string, options?: { ifExists?: boolean }): void {
    this.alterChanges.push({ kind: 'dropColumn', column: name, ifExists: options?.ifExists })
  }

  addPrimaryKey(columns: KeyColumns, options?: NamedConstraintOptions): void {
    let normalizedColumns = normalizeKeyColumns(columns)
    this.alterChanges.push({
      kind: 'addPrimaryKey',
      constraint: {
        columns: normalizedColumns,
        name: options?.name ?? createPrimaryKeyName(this.table),
      },
    })
  }

  dropPrimaryKey(name: string): void {
    this.alterChanges.push({ kind: 'dropPrimaryKey', name })
  }

  addUnique(columns: KeyColumns, options?: NamedConstraintOptions): void {
    let normalizedColumns = normalizeKeyColumns(columns)
    this.alterChanges.push({
      kind: 'addUnique',
      constraint: {
        columns: normalizedColumns,
        name: options?.name ?? createUniqueName(this.table, normalizedColumns),
      },
    })
  }

  dropUnique(name: string): void {
    this.alterChanges.push({ kind: 'dropUnique', name })
  }

  addForeignKey(
    columns: KeyColumns,
    refTable: TableInput,
    refColumns?: KeyColumns,
    options?: ForeignKeyOptions,
  ): void {
    let normalizedColumns = normalizeKeyColumns(columns)
    let normalizedReferenceColumns = refColumns ? normalizeKeyColumns(refColumns) : ['id']
    let referenceTable = asTableRef(refTable)
    this.alterChanges.push({
      kind: 'addForeignKey',
      constraint: {
        columns: normalizedColumns,
        references: {
          table: referenceTable,
          columns: normalizedReferenceColumns,
        },
        name:
          options?.name ??
          createForeignKeyName(
            this.table,
            normalizedColumns,
            referenceTable,
            normalizedReferenceColumns,
          ),
        onDelete: options?.onDelete,
        onUpdate: options?.onUpdate,
      },
    })
  }

  dropForeignKey(name: string): void {
    this.alterChanges.push({ kind: 'dropForeignKey', name })
  }

  addCheck(expression: string, options?: NamedConstraintOptions): void {
    this.alterChanges.push({
      kind: 'addCheck',
      constraint: {
        expression,
        name: options?.name ?? createCheckName(this.table, expression),
      },
    })
  }

  dropCheck(name: string): void {
    this.alterChanges.push({ kind: 'dropCheck', name })
  }

  addIndex(columns: string | string[], options?: CreateIndexOptions): void {
    let normalizedColumns = normalizeIndexColumns(columns)
    let { name, ifNotExists, ...indexOptions } = options ?? {}
    this.extraStatements.push({
      kind: 'createIndex',
      index: {
        table: this.table,
        name: name ?? createIndexName(this.table, normalizedColumns),
        columns: normalizedColumns,
        ...indexOptions,
      },
      ifNotExists,
    })
  }

  dropIndex(name: string): void {
    this.extraStatements.push({
      kind: 'dropIndex',
      table: this.table,
      name,
    })
  }

  comment(text: string): void {
    this.alterChanges.push({ kind: 'setTableComment', comment: text })
  }
}

export function createMigrationSchema(
  db: Database,
  emit: (operation: DataMigrationOperation) => Promise<void>,
  options?: { transaction?: TransactionToken },
): MigrationSchema {
  return {
    async createTable(table, options) {
      let operation = lowerTableForCreate(table)
      operation.ifNotExists = options?.ifNotExists
      await emit(operation)
    },
    async alterTable(input, migrate, options) {
      let tableRef = asTableRef(input)
      let builder = new AlterTableBuilderRuntime(tableRef)
      migrate(builder)

      if (builder.alterChanges.length > 0) {
        await emit({
          kind: 'alterTable',
          table: tableRef,
          changes: builder.alterChanges,
          ifExists: options?.ifExists,
        })
      }

      for (let operation of builder.extraStatements) {
        await emit(operation)
      }
    },
    async renameTable(from, to) {
      await emit({ kind: 'renameTable', from: asTableRef(from), to: toTableRef(to) })
    },
    async dropTable(table, options) {
      await emit({
        kind: 'dropTable',
        table: asTableRef(table),
        ifExists: options?.ifExists,
        cascade: options?.cascade,
      })
    },
    async createIndex(table, columns, options) {
      let tableRef = asTableRef(table)
      let normalizedColumns = normalizeIndexColumns(columns)
      let { name, ifNotExists, ...indexOptions } = options ?? {}
      await emit({
        kind: 'createIndex',
        index: {
          table: tableRef,
          name: name ?? createIndexName(tableRef, normalizedColumns),
          columns: normalizedColumns,
          ...indexOptions,
        },
        ifNotExists,
      })
    },
    async dropIndex(table, name, options) {
      await emit({
        kind: 'dropIndex',
        table: asTableRef(table),
        name,
        ifExists: options?.ifExists,
      })
    },
    async renameIndex(table, from, to) {
      await emit({
        kind: 'renameIndex',
        table: asTableRef(table),
        from,
        to,
      })
    },
    async addForeignKey(table, columns, refTable, refColumns, options) {
      let tableRef = asTableRef(table)
      let normalizedColumns = normalizeKeyColumns(columns)
      let referenceTable = asTableRef(refTable)
      let normalizedReferenceColumns = refColumns ? normalizeKeyColumns(refColumns) : ['id']
      await emit({
        kind: 'addForeignKey',
        table: tableRef,
        constraint: {
          columns: normalizedColumns,
          references: {
            table: referenceTable,
            columns: normalizedReferenceColumns,
          },
          name:
            options?.name ??
            createForeignKeyName(
              tableRef,
              normalizedColumns,
              referenceTable,
              normalizedReferenceColumns,
            ),
          onDelete: options?.onDelete,
          onUpdate: options?.onUpdate,
        },
      })
    },
    async dropForeignKey(table, name) {
      await emit({
        kind: 'dropForeignKey',
        table: asTableRef(table),
        name,
      })
    },
    async addCheck(table, expression, options) {
      let tableRef = asTableRef(table)
      await emit({
        kind: 'addCheck',
        table: tableRef,
        constraint: {
          expression,
          name: options?.name ?? createCheckName(tableRef, expression),
        },
      })
    },
    async dropCheck(table, name) {
      await emit({
        kind: 'dropCheck',
        table: asTableRef(table),
        name,
      })
    },
    async plan(sql) {
      let statement = typeof sql === 'string' ? rawSql(sql) : sql
      await emit({
        kind: 'raw',
        sql: statement,
      })
    },
    async hasTable(table) {
      return db.adapter.hasTable(asTableRef(table), options?.transaction)
    },
    async hasColumn(table, columnName) {
      return db.adapter.hasColumn(asTableRef(table), columnName, options?.transaction)
    },
  }
}
