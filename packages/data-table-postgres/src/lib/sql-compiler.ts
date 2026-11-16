import { getTableName, getTablePrimaryKey } from '@remix-run/data-table'
import type { DataManipulationOperation, SqlStatement } from '@remix-run/data-table'
import {
  collectColumns,
  compileFromClause,
  compileGroupByClause,
  compileHavingClause,
  compileLimitOffsetClause,
  compileOrderByClause,
  compileReturningClause,
  compileWhereClause,
  quotePath,
} from '@remix-run/data-table/sql-helpers'
import type { SqlCompileContext } from '@remix-run/data-table/sql-helpers'

type UpsertOperation = Extract<DataManipulationOperation, { kind: 'upsert' }>
type InsertOperation = Extract<DataManipulationOperation, { kind: 'insert' | 'insertMany' }>

type CompileContext = SqlCompileContext & {
  values: unknown[]
}

export function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

function quote(path: string): string {
  return quotePath(path, quoteIdentifier)
}

export function compilePostgresOperation(operation: DataManipulationOperation): SqlStatement {
  if (operation.kind === 'raw') {
    return {
      text: rewriteRawPlaceholders(operation.sql.text),
      values: [...operation.sql.values],
    }
  }

  let values: unknown[] = []
  let context: CompileContext = {
    values,
    quoteIdentifier,
    ilike: 'ilike',
    bindValue(value) {
      values.push(value)
      return '$' + String(values.length)
    },
  }

  if (operation.kind === 'select') {
    let selection = '*'

    if (operation.select !== '*') {
      selection = operation.select
        .map((field) => quote(field.column) + ' as ' + quoteIdentifier(field.alias))
        .join(', ')
    }

    return {
      text:
        'select ' +
        (operation.distinct ? 'distinct ' : '') +
        selection +
        compileFromClause(operation.table, operation.joins, context) +
        compileWhereClause(operation.where, context) +
        compileGroupByClause(operation.groupBy, context) +
        compileHavingClause(operation.having, context) +
        compileOrderByClause(operation.orderBy, context) +
        compileLimitOffsetClause(operation.limit, operation.offset, context),
      values,
    }
  }

  if (operation.kind === 'count' || operation.kind === 'exists') {
    let inner =
      'select 1' +
      compileFromClause(operation.table, operation.joins, context) +
      compileWhereClause(operation.where, context) +
      compileGroupByClause(operation.groupBy, context) +
      compileHavingClause(operation.having, context)

    return {
      text:
        'select count(*) as ' +
        quoteIdentifier('count') +
        ' from (' +
        inner +
        ') as ' +
        quoteIdentifier('__dt_count'),
      values,
    }
  }

  if (operation.kind === 'insert') {
    return compileInsertOperation(operation, [operation.values], context)
  }

  if (operation.kind === 'insertMany') {
    if (operation.values.length === 0) {
      return { text: 'select 0 where 1 = 0', values }
    }

    return compileInsertOperation(operation, operation.values, context)
  }

  if (operation.kind === 'update') {
    return {
      text:
        'update ' +
        quote(getTableName(operation.table)) +
        ' set ' +
        Object.keys(operation.changes)
          .map((column) => quote(column) + ' = ' + context.bindValue(operation.changes[column]))
          .join(', ') +
        compileWhereClause(operation.where, context) +
        compileReturningClause(operation.returning, context),
      values,
    }
  }

  if (operation.kind === 'delete') {
    return {
      text:
        'delete from ' +
        quote(getTableName(operation.table)) +
        compileWhereClause(operation.where, context) +
        compileReturningClause(operation.returning, context),
      values,
    }
  }

  if (operation.kind === 'upsert') {
    return compileUpsertOperation(operation, context)
  }

  throw new Error('Unsupported operation kind')
}

function compileInsertOperation(
  operation: InsertOperation,
  rows: Record<string, unknown>[],
  context: CompileContext,
): SqlStatement {
  let table = quote(getTableName(operation.table))
  let columns = collectColumns(rows)

  if (columns.length === 0) {
    return {
      text:
        'insert into ' +
        table +
        ' default values' +
        compileReturningClause(operation.returning, context),
      values: context.values,
    }
  }

  let valueSets = rows.map(
    (row) =>
      '(' +
      columns
        .map((column) =>
          context.bindValue(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null),
        )
        .join(', ') +
      ')',
  )

  return {
    text:
      'insert into ' +
      table +
      ' (' +
      columns.map(quote).join(', ') +
      ') values ' +
      valueSets.join(', ') +
      compileReturningClause(operation.returning, context),
    values: context.values,
  }
}

function compileUpsertOperation(operation: UpsertOperation, context: CompileContext): SqlStatement {
  let insertColumns = Object.keys(operation.values)

  if (insertColumns.length === 0) {
    throw new Error('upsert requires at least one value')
  }

  let insertPlaceholders = insertColumns.map((column) =>
    context.bindValue(operation.values[column]),
  )

  let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)]
  let updateValues = operation.update ?? operation.values
  let updateColumns = Object.keys(updateValues)

  let conflictClause =
    ' on conflict (' +
    conflictTarget.map(quote).join(', ') +
    ')' +
    (updateColumns.length === 0
      ? ' do nothing'
      : ' do update set ' +
        updateColumns
          .map((column) => quote(column) + ' = ' + context.bindValue(updateValues[column]))
          .join(', '))

  return {
    text:
      'insert into ' +
      quote(getTableName(operation.table)) +
      ' (' +
      insertColumns.map(quote).join(', ') +
      ') values (' +
      insertPlaceholders.join(', ') +
      ')' +
      conflictClause +
      compileReturningClause(operation.returning, context),
    values: context.values,
  }
}

// Rewrites `?` placeholders to `$n`, skipping quoted strings, identifiers, and comments.
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
