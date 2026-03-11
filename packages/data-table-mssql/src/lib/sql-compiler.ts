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

export function compileMssqlOperation(operation: DataManipulationOperation): SqlStatement {
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

    return {
      text:
        'select ' +
        (operation.distinct ? 'distinct ' : '') +
        compileTopClause(operation.limit, operation.offset) +
        selection +
        compileFromClause(operation.table, operation.joins, context) +
        compileWhereClause(operation.where, context) +
        compileGroupByClause(operation.groupBy) +
        compileHavingClause(operation.having, context) +
        compileOrderByClause(operation.orderBy) +
        compileOffsetClause(operation.orderBy.length > 0, operation.limit, operation.offset),
      values: context.values,
    }
  }

  if (operation.kind === 'count' || operation.kind === 'exists') {
    let inner =
      'select 1 as ' +
      quoteIdentifier('__dt_col') +
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
        compileOutputClause(operation.returning, 'inserted') +
        compileWhereClause(operation.where, context),
      values: context.values,
    }
  }

  if (operation.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quotePath(getTableName(operation.table)) +
        compileOutputClause(operation.returning, 'deleted') +
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
  returning: '*' | string[] | undefined,
  context: CompileContext,
): SqlStatement {
  let columns = Object.keys(values)

  if (columns.length === 0) {
    return {
      text:
        'insert into ' +
        quotePath(getTableName(table)) +
        compileOutputClause(returning, 'inserted') +
        ' default values',
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      columns.map((column) => quotePath(column)).join(', ') +
      ')' +
      compileOutputClause(returning, 'inserted') +
      ' values (' +
      columns.map((column) => pushValue(context, values[column])).join(', ') +
      ')',
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
        compileOutputClause(returning, 'inserted') +
        ' default values',
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quotePath(getTableName(table)) +
      ' (' +
      columns.map((column) => quotePath(column)).join(', ') +
      ')' +
      compileOutputClause(returning, 'inserted') +
      ' values ' +
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
        .join(', '),
    values: context.values,
  }
}

function compileUpsertOperation(operation: UpsertOperation, context: CompileContext): SqlStatement {
  let insertColumns = Object.keys(operation.values)

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)]

  if (conflictTarget.length === 0) {
    throw new Error('upsert requires at least one conflict target column')
  }

  let sourceValues = insertColumns.map((column) => pushValue(context, operation.values[column]))

  let updateValues = operation.update ?? operation.values
  let updateColumns = Object.keys(updateValues)
  let whenMatchedClause = ''

  if (updateColumns.length > 0) {
    whenMatchedClause =
      ' when matched then update set ' +
      updateColumns
        .map(
          (column) =>
            'target.' + quotePath(column) + ' = ' + pushValue(context, updateValues[column]),
        )
        .join(', ')
  }

  return {
    text:
      'merge ' +
      quotePath(getTableName(operation.table)) +
      ' with (holdlock) as target using (values (' +
      sourceValues.join(', ') +
      ')) as source (' +
      insertColumns.map((column) => quotePath(column)).join(', ') +
      ') on ' +
      conflictTarget
        .map((column) => 'target.' + quotePath(column) + ' = source.' + quotePath(column))
        .join(' and ') +
      whenMatchedClause +
      ' when not matched then insert (' +
      insertColumns.map((column) => quotePath(column)).join(', ') +
      ') values (' +
      insertColumns.map((column) => 'source.' + quotePath(column)).join(', ') +
      ')' +
      compileOutputClause(operation.returning, 'inserted') +
      ';',
    values: context.values,
  }
}

function compileRawOperation(statement: SqlStatement): SqlStatement {
  if (!statement.text.includes('?')) {
    return {
      text: statement.text,
      values: [...statement.values],
    }
  }

  let index = 1
  let text = statement.text.replace(/\?/g, function replaceParameter() {
    let placeholder = '@dt_p' + String(index)
    index += 1
    return placeholder
  })

  return {
    text,
    values: [...statement.values],
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

function compileTopClause(limit: number | undefined, offset: number | undefined): string {
  if (limit === undefined || offset !== undefined) {
    return ''
  }

  return 'top (' + String(limit) + ') '
}

function compileOffsetClause(
  hasOrderBy: boolean,
  limit: number | undefined,
  offset: number | undefined,
): string {
  if (offset === undefined) {
    return ''
  }

  let output = ''

  if (!hasOrderBy) {
    output += ' order by (select 1)'
  }

  output += ' offset ' + String(offset) + ' rows'

  if (limit !== undefined) {
    output += ' fetch next ' + String(limit) + ' rows only'
  }

  return output
}

function compileOutputClause(
  returning: '*' | string[] | undefined,
  tableAlias: 'inserted' | 'deleted',
): string {
  if (!returning) {
    return ''
  }

  if (returning === '*') {
    return ' output ' + tableAlias + '.*'
  }

  return (
    ' output ' +
    returning
      .map((column) => {
        if (column.includes('.')) {
          return quotePath(column)
        }

        return tableAlias + '.' + quoteIdentifier(column)
      })
      .join(', ')
  )
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
  return '[' + value.replace(/]/g, ']]') + ']'
}

function quotePath(path: string): string {
  return quotePathHelper(path, quoteIdentifier)
}

function pushValue(context: CompileContext, value: unknown): string {
  context.values.push(value)
  return '@dt_p' + String(context.values.length)
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  return collectColumnsHelper(rows)
}
