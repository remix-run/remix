import { getTableName, getTablePrimaryKey } from '@remix-run/data-table'
import type { DataManipulationOperation, Predicate, SqlStatement } from '@remix-run/data-table'
import {
  collectColumns as collectColumnsHelper,
  normalizeJoinType as normalizeJoinTypeHelper,
  quotePath as quotePathHelper,
} from '@remix-run/data-table/sql-helpers'

type JoinClause = Extract<DataManipulationOperation, { kind: 'select' }>['joins'][number]
type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>
type OperationTable = Extract<DataManipulationOperation, { kind: 'select' }>['table']

type CompileContext = {
  values: unknown[]
}

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

function compileFromClause(
  table: OperationTable,
  joins: JoinClause[],
  context: CompileContext,
): string {
  let output = ' from ' + quotePath(getTableName(table))

  for (let join of joins) {
    output +=
      ' ' +
      normalizeJoinType(join.type) +
      ' join ' +
      quotePath(getTableName(join.table)) +
      ' on ' +
      compilePredicate(join.on, context)
  }

  return output
}

function compileWhereClause(predicates: Predicate[], context: CompileContext): string {
  if (predicates.length === 0) {
    return ''
  }

  return (
    ' where ' +
    predicates.map((predicate) => '(' + compilePredicate(predicate, context) + ')').join(' and ')
  )
}

function compileGroupByClause(columns: string[]): string {
  if (columns.length === 0) {
    return ''
  }

  return ' group by ' + columns.map((column) => quotePath(column)).join(', ')
}

function compileHavingClause(predicates: Predicate[], context: CompileContext): string {
  if (predicates.length === 0) {
    return ''
  }

  return (
    ' having ' +
    predicates.map((predicate) => '(' + compilePredicate(predicate, context) + ')').join(' and ')
  )
}

function compileOrderByClause(orderBy: { column: string; direction: 'asc' | 'desc' }[]): string {
  if (orderBy.length === 0) {
    return ''
  }

  return (
    ' order by ' +
    orderBy
      .map((clause) => quotePath(clause.column) + ' ' + clause.direction.toUpperCase())
      .join(', ')
  )
}

function compileLimitClause(limit: number | undefined): string {
  if (limit === undefined) {
    return ''
  }

  return ' limit ' + String(limit)
}

function compileOffsetClause(offset: number | undefined): string {
  if (offset === undefined) {
    return ''
  }

  return ' offset ' + String(offset)
}

function compilePredicate(predicate: Predicate, context: CompileContext): string {
  if (predicate.type === 'comparison') {
    let column = quotePath(predicate.column)

    if (predicate.operator === 'eq') {
      if (
        predicate.valueType === 'value' &&
        (predicate.value === null || predicate.value === undefined)
      ) {
        return column + ' is null'
      }

      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' = ' + comparisonValue
    }

    if (predicate.operator === 'ne') {
      if (
        predicate.valueType === 'value' &&
        (predicate.value === null || predicate.value === undefined)
      ) {
        return column + ' is not null'
      }

      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' <> ' + comparisonValue
    }

    if (predicate.operator === 'gt') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' > ' + comparisonValue
    }

    if (predicate.operator === 'gte') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' >= ' + comparisonValue
    }

    if (predicate.operator === 'lt') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' < ' + comparisonValue
    }

    if (predicate.operator === 'lte') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' <= ' + comparisonValue
    }

    if (predicate.operator === 'in' || predicate.operator === 'notIn') {
      let values = Array.isArray(predicate.value) ? predicate.value : []

      if (values.length === 0) {
        return predicate.operator === 'in' ? '1 = 0' : '1 = 1'
      }

      let keyword = predicate.operator === 'in' ? 'in' : 'not in'

      return (
        column +
        ' ' +
        keyword +
        ' (' +
        values.map((value) => pushValue(context, value)).join(', ') +
        ')'
      )
    }

    if (predicate.operator === 'like') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return column + ' like ' + comparisonValue
    }

    if (predicate.operator === 'ilike') {
      let comparisonValue = compileComparisonValue(predicate, context)
      return 'lower(' + column + ') like lower(' + comparisonValue + ')'
    }
  }

  if (predicate.type === 'between') {
    return (
      quotePath(predicate.column) +
      ' between ' +
      pushValue(context, predicate.lower) +
      ' and ' +
      pushValue(context, predicate.upper)
    )
  }

  if (predicate.type === 'null') {
    return (
      quotePath(predicate.column) + (predicate.operator === 'isNull' ? ' is null' : ' is not null')
    )
  }

  if (predicate.type === 'logical') {
    if (predicate.predicates.length === 0) {
      return predicate.operator === 'and' ? '1 = 1' : '1 = 0'
    }

    let joiner = predicate.operator === 'and' ? ' and ' : ' or '

    return predicate.predicates
      .map((child) => '(' + compilePredicate(child, context) + ')')
      .join(joiner)
  }

  throw new Error('Unsupported predicate')
}

function compileComparisonValue(
  predicate: Extract<Predicate, { type: 'comparison' }>,
  context: CompileContext,
): string {
  if (predicate.valueType === 'column') {
    return quotePath(predicate.value)
  }

  return pushValue(context, predicate.value)
}

function normalizeJoinType(type: string): string {
  return normalizeJoinTypeHelper(type)
}

function quoteIdentifier(value: string): string {
  return '`' + value.replace(/`/g, '``') + '`'
}

function quotePath(path: string): string {
  return quotePathHelper(path, quoteIdentifier)
}

function pushValue(context: CompileContext, value: unknown): string {
  context.values.push(value)
  return '?'
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  return collectColumnsHelper(rows)
}
