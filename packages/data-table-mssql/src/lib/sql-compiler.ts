import { getTableName, getTablePrimaryKey } from '@remix-run/data-table'
import type { AdapterStatement, Predicate, SqlStatement } from '@remix-run/data-table'

type JoinClause = Extract<AdapterStatement, { kind: 'select' }>['joins'][number]
type UpsertStatement = Extract<AdapterStatement, { kind: 'upsert' }>
type StatementTable = Extract<AdapterStatement, { kind: 'select' }>['table']

type CompiledSql = {
  text: string
  values: unknown[]
}

type CompileContext = {
  values: unknown[]
}

export function compileMssqlStatement(statement: AdapterStatement): CompiledSql {
  if (statement.kind === 'raw') {
    return compileRawStatement(statement.sql)
  }

  let context: CompileContext = { values: [] }

  if (statement.kind === 'select') {
    let selection = '*'

    if (statement.select !== '*') {
      selection = statement.select
        .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
        .join(', ')
    }

    return {
      text:
        'select ' +
        (statement.distinct ? 'distinct ' : '') +
        compileTopClause(statement.limit, statement.offset) +
        selection +
        compileFromClause(statement.table, statement.joins, context) +
        compileWhereClause(statement.where, context) +
        compileGroupByClause(statement.groupBy) +
        compileHavingClause(statement.having, context) +
        compileOrderByClause(statement.orderBy) +
        compileOffsetClause(statement.orderBy.length > 0, statement.limit, statement.offset),
      values: context.values,
    }
  }

  if (statement.kind === 'count' || statement.kind === 'exists') {
    let inner =
      'select 1 as ' +
      quoteIdentifier('__dt_col') +
      compileFromClause(statement.table, statement.joins, context) +
      compileWhereClause(statement.where, context) +
      compileGroupByClause(statement.groupBy) +
      compileHavingClause(statement.having, context)

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

  if (statement.kind === 'insert') {
    return compileInsertStatement(statement.table, statement.values, statement.returning, context)
  }

  if (statement.kind === 'insertMany') {
    return compileInsertManyStatement(statement.table, statement.values, statement.returning, context)
  }

  if (statement.kind === 'update') {
    let columns = Object.keys(statement.changes)

    return {
      text:
        'update ' +
        quoteIdentifier(getTableName(statement.table)) +
        ' set ' +
        columns
          .map((column) => quotePath(column) + ' = ' + pushValue(context, statement.changes[column]))
          .join(', ') +
        compileOutputClause(statement.returning, 'inserted') +
        compileWhereClause(statement.where, context),
      values: context.values,
    }
  }

  if (statement.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quoteIdentifier(getTableName(statement.table)) +
        compileOutputClause(statement.returning, 'deleted') +
        compileWhereClause(statement.where, context),
      values: context.values,
    }
  }

  if (statement.kind === 'upsert') {
    return compileUpsertStatement(statement, context)
  }

  throw new Error('Unsupported statement kind')
}

function compileInsertStatement(
  table: StatementTable,
  values: Record<string, unknown>,
  returning: '*' | string[] | undefined,
  context: CompileContext,
): CompiledSql {
  let columns = Object.keys(values)

  if (columns.length === 0) {
    return {
      text:
        'insert into ' +
        quoteIdentifier(getTableName(table)) +
        compileOutputClause(returning, 'inserted') +
        ' default values',
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quoteIdentifier(getTableName(table)) +
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

function compileInsertManyStatement(
  table: StatementTable,
  rows: Record<string, unknown>[],
  returning: '*' | string[] | undefined,
  context: CompileContext,
): CompiledSql {
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
        quoteIdentifier(getTableName(table)) +
        compileOutputClause(returning, 'inserted') +
        ' default values',
      values: context.values,
    }
  }

  return {
    text:
      'insert into ' +
      quoteIdentifier(getTableName(table)) +
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

function compileUpsertStatement(statement: UpsertStatement, context: CompileContext): CompiledSql {
  let insertColumns = Object.keys(statement.values)

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let conflictTarget = statement.conflictTarget ?? [...getTablePrimaryKey(statement.table)]

  if (conflictTarget.length === 0) {
    throw new Error('upsert requires at least one conflict target column')
  }

  let sourceValues = insertColumns.map((column) => pushValue(context, statement.values[column]))

  let updateValues = statement.update ?? statement.values
  let updateColumns = Object.keys(updateValues)
  let whenMatchedClause = ''

  if (updateColumns.length > 0) {
    whenMatchedClause =
      ' when matched then update set ' +
      updateColumns
        .map((column) => 'target.' + quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
        .join(', ')
  }

  return {
    text:
      'merge ' +
      quoteIdentifier(getTableName(statement.table)) +
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
      compileOutputClause(statement.returning, 'inserted') +
      ';',
    values: context.values,
  }
}

function compileRawStatement(statement: SqlStatement): CompiledSql {
  if (!statement.text.includes('?')) {
    return {
      text: statement.text,
      values: [...statement.values],
    }
  }

  let index = 1
  let text = statement.text.replace(/\?/g, function replaceParameter() {
    let placeholder = '@p' + String(index)
    index += 1
    return placeholder
  })

  return {
    text,
    values: [...statement.values],
  }
}

function compileFromClause(
  table: StatementTable,
  joins: JoinClause[],
  context: CompileContext,
): string {
  let output = ' from ' + quoteIdentifier(getTableName(table))

  for (let join of joins) {
    output +=
      ' ' +
      normalizeJoinType(join.type) +
      ' join ' +
      quoteIdentifier(getTableName(join.table)) +
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
  if (type === 'left') {
    return 'left'
  }

  if (type === 'right') {
    return 'right'
  }

  return 'inner'
}

function quoteIdentifier(value: string): string {
  return '[' + value.replace(/]/g, ']]') + ']'
}

function quotePath(path: string): string {
  if (path === '*') {
    return '*'
  }

  return path
    .split('.')
    .map((segment) => {
      if (segment === '*') {
        return '*'
      }

      return quoteIdentifier(segment)
    })
    .join('.')
}

function pushValue(context: CompileContext, value: unknown): string {
  context.values.push(value)
  return '@p' + String(context.values.length)
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  let columns: string[] = []
  let seen = new Set<string>()

  for (let row of rows) {
    for (let key in row) {
      if (!Object.prototype.hasOwnProperty.call(row, key)) {
        continue
      }

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      columns.push(key)
    }
  }

  return columns
}
