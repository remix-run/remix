import type { AlterTableChange, ColumnDefinition, DataMigrationOperation, TableRef } from '../adapter.ts'
import type { ColumnBuilder } from '../column.ts'
import type {
  AlterTableBuilder,
  CreateIndexOptions,
  ForeignKeyOptions,
  KeyColumns,
  NamedConstraintOptions,
  TableInput,
} from '../migrations.ts'

import {
  createCheckName,
  createPrimaryKeyName,
  createUniqueName,
  normalizeKeyColumns,
} from './helpers.ts'
import {
  createForeignKeyConstraint,
  createCheckConstraint,
  createIndexOperationForTableRef,
  toMigrationColumnDefinition,
} from './schema-operations.ts'

export class AlterTableBuilderRuntime implements AlterTableBuilder {
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
      definition: toMigrationColumnDefinition(definition),
    })
  }

  changeColumn(name: string, definition: ColumnDefinition | ColumnBuilder): void {
    this.alterChanges.push({
      kind: 'changeColumn',
      column: name,
      definition: toMigrationColumnDefinition(definition),
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
    this.alterChanges.push({
      kind: 'addForeignKey',
      constraint: createForeignKeyConstraint(this.table, columns, refTable, refColumns, options),
    })
  }

  dropForeignKey(name: string): void {
    this.alterChanges.push({ kind: 'dropForeignKey', name })
  }

  addCheck(expression: string, options?: NamedConstraintOptions): void {
    this.alterChanges.push({
      kind: 'addCheck',
      constraint: createCheckConstraint(this.table, expression, options),
    })
  }

  dropCheck(name: string): void {
    this.alterChanges.push({ kind: 'dropCheck', name })
  }

  addIndex(columns: string | string[], options?: CreateIndexOptions): void {
    this.extraStatements.push(createIndexOperationForTableRef(this.table, columns, options))
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
