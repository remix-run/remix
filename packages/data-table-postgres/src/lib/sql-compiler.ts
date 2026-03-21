import { getTableName, getTablePrimaryKey } from '@remix-run/data-table/adapter'
import type { DataManipulationOperation, SqlStatement } from '@remix-run/data-table/adapter'

import {
  collectColumns,
  compileFromClause,
  compileGroupByClause,
  compileHavingClause,
  compileLimitClause,
  compileOffsetClause,
  compileOrderByClause,
  compileRawOperation,
  compileReturningClause,
  compileWhereClause,
  pushValue,
  quoteIdentifier,
  quotePath,
  type CompileContext,
  type OperationTable,
} from './sql-compiler-helpers.ts'

type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>

export function compilePostgresOperation(operation: DataManipulationOperation): SqlStatement {
  if (operation.kind === 'raw') {
    return compileRawOperation(operation.sql)
  }

  let context: CompileContext = { values: [] }

  if (operation.kind === 'select') {
    let selection = '*'

    if (operation.select !== '*') {
      selection = operation.select
        .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
        .join(', ')
    }

    let text =
      'select ' +
      (operation.distinct ? 'distinct ' : '') +
      selection +
      compileFromClause(operation.table, operation.joins, context) +
      compileWhereClause(operation.where, context) +
      compileGroupByClause(operation.groupBy) +
      compileHavingClause(operation.having, context) +
      compileOrderByClause(operation.orderBy) +
      compileLimitClause(operation.limit) +
      compileOffsetClause(operation.offset)

    return {
      text,
      values: context.values,
    }
  }

  if (operation.kind === 'count' || operation.kind === 'exists') {
    let inner =
      'select 1' +
      compileFromClause(operation.table, operation.joins, context) +
      compileWhereClause(operation.where, context) +
      compileGroupByClause(operation.groupBy) +
      compileHavingClause(operation.having, context)

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
    let changes = Object.keys(operation.changes)
    let assignments = changes
      .map((column) => quotePath(column) + ' = ' + pushValue(context, operation.changes[column]))
      .join(', ')

    return {
      text:
        'update ' +
        quotePath(getTableName(operation.table)) +
        ' set ' +
        assignments +
        compileWhereClause(operation.where, context) +
        compileReturningClause(operation.returning),
      values: context.values,
    }
  }

  if (operation.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quotePath(getTableName(operation.table)) +
        compileWhereClause(operation.where, context) +
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
  context: CompileContext,
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

  let quotedColumns = columns.map((column) => quotePath(column))
  let placeholders = columns.map((column) => pushValue(context, values[column]))

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      quotedColumns.join(', ') +
      ') values (' +
      placeholders.join(', ') +
      ')' +
      compileReturningClause(returning),
    values: context.values,
  }
}

function compileInsertManyOperation(
  table: OperationTable,
  rows: Record<string, unknown>[],
  returning: '*' | string[] | undefined,
  context: CompileContext,
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

  let quotedColumns = columns.map((column) => quotePath(column))

  let valueSets = rows.map((row) => {
    let placeholders = columns.map((column) => {
      let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null
      return pushValue(context, value)
    })

    return '(' + placeholders.join(', ') + ')'
  })

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      quotedColumns.join(', ') +
      ') values ' +
      valueSets.join(', ') +
      compileReturningClause(returning),
    values: context.values,
  }
}

function compileUpsertOperation(operation: UpsertOperation, context: CompileContext): SqlStatement {
  let insertColumns = Object.keys(operation.values)
  let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)]

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let quotedInsertColumns = insertColumns.map((column) => quotePath(column))
  let insertPlaceholders = insertColumns.map((column) =>
    pushValue(context, operation.values[column]),
  )

  let updateValues = operation.update ?? operation.values
  let updateColumns = Object.keys(updateValues)
  let onConflictClause = ''

  if (updateColumns.length === 0) {
    onConflictClause =
      ' on conflict (' +
      conflictTarget.map((column: string) => quotePath(column)).join(', ') +
      ') do nothing'
  } else {
    onConflictClause =
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
      quotedInsertColumns.join(', ') +
      ') values (' +
      insertPlaceholders.join(', ') +
      ')' +
      onConflictClause +
      compileReturningClause(operation.returning),
    values: context.values,
  }
}
