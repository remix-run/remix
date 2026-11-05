import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { column } from './column.ts'
import { and, eq, ilike, inList, or } from './operators.ts'
import { createSqlClauseCompiler } from './sql-clause-compiler.ts'
import type { SqlCompileContext } from './sql-clause-compiler.ts'
import { table } from './table.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
  },
})

const clauses = createSqlClauseCompiler({
  quoteIdentifier: (value) => '"' + value + '"',
  bindValue(context, value) {
    context.values.push(value)
    return '$' + String(context.values.length)
  },
  compileCaseInsensitiveLike: (column, value) => 'lower(' + column + ') like lower(' + value + ')',
})

describe('createSqlClauseCompiler', () => {
  it('compiles where clauses with dialect quoting and placeholders', () => {
    let context: SqlCompileContext = { values: [] }
    let sql = clauses.where([or(eq('id', 1), inList('id', [2, 3])), eq('email', null)], context)

    assert.equal(sql, ' where (("id" = $1) or ("id" in ($2, $3))) and ("email" is null)')
    assert.deepEqual(context.values, [1, 2, 3])
  })

  it('uses the dialect for case-insensitive like', () => {
    let context: SqlCompileContext = { values: [] }

    assert.equal(
      clauses.predicate(ilike('email', '%@studio.test'), context),
      'lower("email") like lower($1)',
    )
  })

  it('compiles empty clauses to empty strings', () => {
    let context: SqlCompileContext = { values: [] }

    assert.equal(clauses.where([], context), '')
    assert.equal(clauses.having([], context), '')
    assert.equal(clauses.groupBy([]), '')
    assert.equal(clauses.orderBy([]), '')
    assert.equal(clauses.limit(undefined, context), '')
    assert.equal(clauses.offset(undefined, context), '')
    assert.equal(clauses.returning(undefined), '')
    assert.equal(clauses.predicate(and(), context), '1 = 1')
    assert.equal(clauses.predicate(or(), context), '1 = 0')
  })

  it('compiles from, order by, limit, and offset clauses', () => {
    let context: SqlCompileContext = { values: [] }
    let sql =
      clauses.from(accounts, [], context) +
      clauses.orderBy([{ column: 'accounts.email', direction: 'desc' }]) +
      clauses.limit(10, context) +
      clauses.offset(20, context)

    assert.equal(sql, ' from "accounts" order by "accounts"."email" DESC limit $1 offset $2')
    assert.deepEqual(context.values, [10, 20])
  })

  it('compiles returning clauses', () => {
    assert.equal(clauses.returning('*'), ' returning *')
    assert.equal(clauses.returning(['id', 'accounts.email']), ' returning "id", "accounts"."email"')
  })
})
