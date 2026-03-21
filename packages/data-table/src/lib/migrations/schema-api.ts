import type { Database } from '../database.ts'
import type { DataMigrationOperation, TransactionToken } from '../adapter.ts'
import { rawSql } from '../sql.ts'
import type { AnyTable } from '../table.ts'
import type { MigrationSchema } from '../migrations.ts'

import { AlterTableBuilderRuntime } from './alter-table-builder.ts'
import {
  createCheckConstraint,
  createForeignKeyConstraint,
  createIndexOperation,
  lowerTableForCreate,
  toMigrationTableRef,
} from './schema-operations.ts'

export function createMigrationSchema(
  db: Database,
  emit: (operation: DataMigrationOperation) => Promise<void>,
  options?: { transaction?: TransactionToken },
): MigrationSchema {
  return {
    async createTable(table: AnyTable, createOptions?: { ifNotExists?: boolean }) {
      let operation = lowerTableForCreate(table)
      operation.ifNotExists = createOptions?.ifNotExists
      await emit(operation)
    },
    async alterTable(table, migrate, alterOptions) {
      let tableRef = toMigrationTableRef(table)
      let builder = new AlterTableBuilderRuntime(tableRef)
      migrate(builder)

      if (builder.alterChanges.length > 0) {
        await emit({
          kind: 'alterTable',
          table: tableRef,
          changes: builder.alterChanges,
          ifExists: alterOptions?.ifExists,
        })
      }

      for (let operation of builder.extraStatements) {
        await emit(operation)
      }
    },
    async renameTable(from, to) {
      await emit({
        kind: 'renameTable',
        from: toMigrationTableRef(from),
        to: toMigrationTableRef(to),
      })
    },
    async dropTable(table, dropOptions) {
      await emit({
        kind: 'dropTable',
        table: toMigrationTableRef(table),
        ifExists: dropOptions?.ifExists,
        cascade: dropOptions?.cascade,
      })
    },
    async createIndex(table, columns, indexOptions) {
      await emit(createIndexOperation(table, columns, indexOptions))
    },
    async dropIndex(table, name, dropOptions) {
      await emit({
        kind: 'dropIndex',
        table: toMigrationTableRef(table),
        name,
        ifExists: dropOptions?.ifExists,
      })
    },
    async renameIndex(table, from, to) {
      await emit({
        kind: 'renameIndex',
        table: toMigrationTableRef(table),
        from,
        to,
      })
    },
    async addForeignKey(table, columns, refTable, refColumns, foreignKeyOptions) {
      let tableRef = toMigrationTableRef(table)

      await emit({
        kind: 'addForeignKey',
        table: tableRef,
        constraint: createForeignKeyConstraint(
          tableRef,
          columns,
          refTable,
          refColumns,
          foreignKeyOptions,
        ),
      })
    },
    async dropForeignKey(table, name) {
      await emit({
        kind: 'dropForeignKey',
        table: toMigrationTableRef(table),
        name,
      })
    },
    async addCheck(table, expression, checkOptions) {
      let tableRef = toMigrationTableRef(table)

      await emit({
        kind: 'addCheck',
        table: tableRef,
        constraint: createCheckConstraint(tableRef, expression, checkOptions),
      })
    },
    async dropCheck(table, name) {
      await emit({
        kind: 'dropCheck',
        table: toMigrationTableRef(table),
        name,
      })
    },
    async plan(statement) {
      await emit({
        kind: 'raw',
        sql: typeof statement === 'string' ? rawSql(statement) : statement,
      })
    },
    async hasTable(table) {
      return db.adapter.hasTable(toMigrationTableRef(table), options?.transaction)
    },
    async hasColumn(table, columnName) {
      return db.adapter.hasColumn(
        toMigrationTableRef(table),
        columnName,
        options?.transaction,
      )
    },
  }
}
