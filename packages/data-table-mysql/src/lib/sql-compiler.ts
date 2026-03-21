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
  compileWhereClause,
  pushValue,
  quoteIdentifier,
  quotePath,
  type CompileContext,
  type OperationTable,
} from './sql-compiler-helpers.ts'

type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>

export function compileMysqlOperation(operation: DataManipulationOperation): SqlStatement {
  if (operation.kind === 'raw') {
    return {
      text: operation.sql.text,
      values: [...operation.sql.values],
    }
  }

  let context: CompileContext = { values: [] }

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
        compileFromClause(operation.table, operation.joins, context) +
        compileWhereClause(operation.where, context) +
        compileGroupByClause(operation.groupBy) +
        compileHavingClause(operation.having, context) +
        compileOrderByClause(operation.orderBy) +
        compileLimitClause(operation.limit) +
        compileOffsetClause(operation.offset),
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
    return compileInsertOperation(operation.table, operation.values, context)
  }

  if (operation.kind === 'insertMany') {
    return compileInsertManyOperation(operation.table, operation.values, context)
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
        compileWhereClause(operation.where, context),
      values: context.values,
    }
  }

  if (operation.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quotePath(getTableName(operation.table)) +
        compileWhereClause(operation.where, context),
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
  context: CompileContext,
): SqlStatement {
  let columns = Object.keys(values)

  if (columns.length === 0) {
    return {
      text: 'insert into ' + quotePath(getTableName(table)) + ' () values ()',
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
      ')',
    values: context.values,
  }
}

function compileInsertManyOperation(
  table: OperationTable,
  rows: Record<string, unknown>[],
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
      text: 'insert into ' + quotePath(getTableName(table)) + ' () values ()',
      values: context.values,
    }
  }

  let values = rows.map(
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

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      columns.map((column) => quotePath(column)).join(', ') +
      ') values ' +
      values.join(', '),
    values: context.values,
  }
}

function compileUpsertOperation(operation: UpsertOperation, context: CompileContext): SqlStatement {
  let insertColumns = Object.keys(operation.values)

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let updateValues = operation.update ?? operation.values
  let updateColumns = Object.keys(updateValues)
  let fallbackNoopColumn = getTablePrimaryKey(operation.table)[0]

  let onDuplicate =
    updateColumns.length > 0
      ? updateColumns
          .map((column) => quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
          .join(', ')
      : quotePath(fallbackNoopColumn) + ' = ' + quotePath(fallbackNoopColumn)

  return {
    text:
      'insert into ' +
      quotePath(getTableName(operation.table)) +
      ' (' +
      insertColumns.map((column) => quotePath(column)).join(', ') +
      ') values (' +
      insertColumns.map((column) => pushValue(context, operation.values[column])).join(', ') +
      ') on duplicate key update ' +
      onDuplicate,
    values: context.values,
  }
}
