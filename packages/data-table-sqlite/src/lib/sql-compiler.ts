import { getTableName, getTablePrimaryKey } from '@remix-run/data-table'
import type { SqlStatement } from '@remix-run/data-table'
import type { DataManipulationOperation } from '@remix-run/data-table'
import {
  collectColumns,
  quotePath as quotePathHelper,
  createSqlClauseCompiler,
} from '@remix-run/data-table/sql-helpers'
import type { SqlCompileContext } from '@remix-run/data-table/sql-helpers'

type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>
type OperationTable = Extract<DataManipulationOperation, { kind: 'select' }>['table']

const clauses = createSqlClauseCompiler({
  quoteIdentifier,
  bindValue: pushValue,
  compileCaseInsensitiveLike: (column, value) => 'lower(' + column + ') like lower(' + value + ')',
})

export function compileSqliteOperation(operation: DataManipulationOperation): SqlStatement {
  if (operation.kind === 'raw') {
    return {
      text: operation.sql.text,
      values: [...operation.sql.values],
    }
  }

  let context: SqlCompileContext = { values: [] }

  if (operation.kind === 'select') {
    let selection = '*'

    if (operation.select !== '*') {
      selection = operation.select
        .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
        .join(', ')
    }

    return {
      text:
        'select ' +
        (operation.distinct ? 'distinct ' : '') +
        selection +
        clauses.from(operation.table, operation.joins, context) +
        clauses.where(operation.where, context) +
        clauses.groupBy(operation.groupBy) +
        clauses.having(operation.having, context) +
        clauses.orderBy(operation.orderBy) +
        clauses.limit(operation.limit, context) +
        clauses.offset(operation.offset, context),
      values: context.values,
    }
  }

  if (operation.kind === 'count' || operation.kind === 'exists') {
    let inner =
      'select 1' +
      clauses.from(operation.table, operation.joins, context) +
      clauses.where(operation.where, context) +
      clauses.groupBy(operation.groupBy) +
      clauses.having(operation.having, context)

    return {
      text:
        'select count(*) as ' +
        quoteIdentifier('count') +
        ' from (' +
        inner +
        ') as ' +
        quoteIdentifier('__dt_count'),
      values: context.values,
    }
  }

  if (operation.kind === 'insert') {
    return compileInsertOperation(operation.table, operation.values, operation.returning, context)
  }

  if (operation.kind === 'insertMany') {
    return compileInsertManyOperation(
      operation.table,
      operation.values,
      operation.returning,
      context,
    )
  }

  if (operation.kind === 'update') {
    let columns = Object.keys(operation.changes)

    return {
      text:
        'update ' +
        quotePath(getTableName(operation.table)) +
        ' set ' +
        columns
          .map(
            (column) => quotePath(column) + ' = ' + pushValue(context, operation.changes[column]),
          )
          .join(', ') +
        clauses.where(operation.where, context) +
        compileReturningClause(operation.returning),
      values: context.values,
    }
  }

  if (operation.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quotePath(getTableName(operation.table)) +
        clauses.where(operation.where, context) +
        compileReturningClause(operation.returning),
      values: context.values,
    }
  }

  if (operation.kind === 'upsert') {
    return compileUpsertOperation(operation, context)
  }

  throw new Error('Unsupported operation kind')
}

function compileInsertOperation(
  table: OperationTable,
  values: Record<string, unknown>,
  returning: '*' | string[] | undefined,
  context: SqlCompileContext,
): SqlStatement {
  let columns = Object.keys(values)

  if (columns.length === 0) {
    return {
      text:
        'insert into ' +
        quotePath(getTableName(table)) +
        ' default values' +
        compileReturningClause(returning),
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      columns.map((column) => quotePath(column)).join(', ') +
      ') values (' +
      columns.map((column) => pushValue(context, values[column])).join(', ') +
      ')' +
      compileReturningClause(returning),
    values: context.values,
  }
}

function compileInsertManyOperation(
  table: OperationTable,
  rows: Record<string, unknown>[],
  returning: '*' | string[] | undefined,
  context: SqlCompileContext,
): SqlStatement {
  if (rows.length === 0) {
    return {
      text: 'select 0 where 1 = 0',
      values: context.values,
    }
  }

  let columns = collectColumns(rows)

  if (columns.length === 0) {
    return {
      text:
        'insert into ' +
        quotePath(getTableName(table)) +
        ' default values' +
        compileReturningClause(returning),
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      columns.map((column) => quotePath(column)).join(', ') +
      ') values ' +
      rows
        .map(
          (row) =>
            '(' +
            columns
              .map((column) => {
                let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null
                return pushValue(context, value)
              })
              .join(', ') +
            ')',
        )
        .join(', ') +
      compileReturningClause(returning),
    values: context.values,
  }
}

function compileUpsertOperation(
  operation: UpsertOperation,
  context: SqlCompileContext,
): SqlStatement {
  let insertColumns = Object.keys(operation.values)
  let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)]

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let updateValues = operation.update ?? operation.values
  let updateColumns = Object.keys(updateValues)
  let insertValues = insertColumns
    .map((column) => pushValue(context, operation.values[column]))
    .join(', ')

  let conflictClause = ''

  if (updateColumns.length === 0) {
    conflictClause =
      ' on conflict (' +
      conflictTarget.map((column: string) => quotePath(column)).join(', ') +
      ') do nothing'
  } else {
    conflictClause =
      ' on conflict (' +
      conflictTarget.map((column: string) => quotePath(column)).join(', ') +
      ') do update set ' +
      updateColumns
        .map((column) => quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
        .join(', ')
  }

  return {
    text:
      'insert into ' +
      quotePath(getTableName(operation.table)) +
      ' (' +
      insertColumns.map((column) => quotePath(column)).join(', ') +
      ') values (' +
      insertValues +
      ')' +
      conflictClause +
      compileReturningClause(operation.returning),
    values: context.values,
  }
}

function compileReturningClause(returning: '*' | string[] | undefined): string {
  if (!returning) {
    return ''
  }

  if (returning === '*') {
    return ' returning *'
  }

  return ' returning ' + returning.map((column) => quotePath(column)).join(', ')
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function quotePath(path: string): string {
  return quotePathHelper(path, quoteIdentifier)
}

function pushValue(context: SqlCompileContext, value: unknown): string {
  context.values.push(normalizeBoundValue(value))
  return '?'
}

function normalizeBoundValue(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  return value
}
