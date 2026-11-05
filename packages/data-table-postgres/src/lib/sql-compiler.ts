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
  compileCaseInsensitiveLike: (column, value) => column + ' ilike ' + value,
})

export function compilePostgresOperation(operation: DataManipulationOperation): SqlStatement {
  if (operation.kind === 'raw') {
    return compileRawOperation(operation.sql)
  }

  let context: SqlCompileContext = { values: [] }

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
      clauses.from(operation.table, operation.joins, context) +
      clauses.where(operation.where, context) +
      clauses.groupBy(operation.groupBy) +
      clauses.having(operation.having, context) +
      clauses.orderBy(operation.orderBy) +
      clauses.limit(operation.limit, context) +
      clauses.offset(operation.offset, context)

    return {
      text,
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

function compileUpsertOperation(
  operation: UpsertOperation,
  context: SqlCompileContext,
): SqlStatement {
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

function compileRawOperation(statement: SqlStatement): SqlStatement {
  if (!statement.text.includes('?')) {
    return {
      text: statement.text,
      values: [...statement.values],
    }
  }

  return {
    text: rewriteRawPlaceholders(statement.text),
    values: [...statement.values],
  }
}

function rewriteRawPlaceholders(text: string): string {
  let output = ''
  let index = 0
  let placeholderIndex = 1

  while (index < text.length) {
    let char = text[index]

    if (char === '?') {
      output += '$' + String(placeholderIndex)
      placeholderIndex += 1
      index += 1
      continue
    }

    if ((char === 'E' || char === 'e') && text[index + 1] === "'") {
      let end = scanEscapeSingleQuotedString(text, index + 1)
      output += text.slice(index, end)
      index = end
      continue
    }

    if (char === "'") {
      let end = scanSingleQuotedString(text, index)
      output += text.slice(index, end)
      index = end
      continue
    }

    if (char === '"') {
      let end = scanDoubleQuotedIdentifier(text, index)
      output += text.slice(index, end)
      index = end
      continue
    }

    if (text.startsWith('--', index)) {
      let end = scanLineComment(text, index)
      output += text.slice(index, end)
      index = end
      continue
    }

    if (text.startsWith('/*', index)) {
      let end = scanBlockComment(text, index)
      output += text.slice(index, end)
      index = end
      continue
    }

    let dollarQuotedStringEnd = scanDollarQuotedString(text, index)

    if (dollarQuotedStringEnd !== undefined) {
      output += text.slice(index, dollarQuotedStringEnd)
      index = dollarQuotedStringEnd
      continue
    }

    output += char
    index += 1
  }

  return output
}

function scanSingleQuotedString(text: string, start: number): number {
  let index = start + 1

  while (index < text.length) {
    if (text[index] === "'") {
      if (text[index + 1] === "'") {
        index += 2
        continue
      }

      return index + 1
    }

    index += 1
  }

  return text.length
}

function scanEscapeSingleQuotedString(text: string, start: number): number {
  let index = start + 1

  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2
      continue
    }

    if (text[index] === "'") {
      if (text[index + 1] === "'") {
        index += 2
        continue
      }

      return index + 1
    }

    index += 1
  }

  return text.length
}

function scanDoubleQuotedIdentifier(text: string, start: number): number {
  let index = start + 1

  while (index < text.length) {
    if (text[index] === '"') {
      if (text[index + 1] === '"') {
        index += 2
        continue
      }

      return index + 1
    }

    index += 1
  }

  return text.length
}

function scanLineComment(text: string, start: number): number {
  let index = start + 2

  while (index < text.length && text[index] !== '\n' && text[index] !== '\r') {
    index += 1
  }

  return index
}

function scanBlockComment(text: string, start: number): number {
  let index = start + 2
  let depth = 1

  while (index < text.length && depth > 0) {
    if (text.startsWith('/*', index)) {
      depth += 1
      index += 2
      continue
    }

    if (text.startsWith('*/', index)) {
      depth -= 1
      index += 2
      continue
    }

    index += 1
  }

  return index
}

function scanDollarQuotedString(text: string, start: number): number | undefined {
  let delimiter = getDollarQuoteDelimiter(text, start)

  if (delimiter === undefined) {
    return undefined
  }

  let end = text.indexOf(delimiter, start + delimiter.length)

  return end === -1 ? text.length : end + delimiter.length
}

function getDollarQuoteDelimiter(text: string, start: number): string | undefined {
  if (text[start] !== '$') {
    return undefined
  }

  let index = start + 1

  if (text[index] === '$') {
    return '$$'
  }

  if (!isDollarQuoteTagStart(text[index])) {
    return undefined
  }

  index += 1

  while (index < text.length && isDollarQuoteTagPart(text[index])) {
    index += 1
  }

  if (text[index] !== '$') {
    return undefined
  }

  return text.slice(start, index + 1)
}

function isDollarQuoteTagStart(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }

  return isAsciiLetter(char) || char === '_'
}

function isDollarQuoteTagPart(char: string | undefined): boolean {
  if (char === undefined) {
    return false
  }

  return isDollarQuoteTagStart(char) || isAsciiDigit(char)
}

function isAsciiLetter(char: string): boolean {
  let code = char.charCodeAt(0)
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isAsciiDigit(char: string): boolean {
  let code = char.charCodeAt(0)
  return code >= 48 && code <= 57
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
  context.values.push(value)
  return '$' + String(context.values.length)
}
