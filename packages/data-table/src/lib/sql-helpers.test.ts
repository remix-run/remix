import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { column } from './column.ts'
import { and, between, eq, gt, ilike, inList, isNull, or } from './operators.ts'
import {
  compileFromClause,
  compileGroupByClause,
  compileHavingClause,
  compileLimitOffsetClause,
  compileOrderByClause,
  compileOrderByDirection,
  compilePredicate,
  compileReturningClause,
  compileWhereClause,
} from './sql-helpers.ts'
import type { SqlCompileContext } from './sql-helpers.ts'
import { table } from './table.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
  },
})

const profiles = table({
  name: 'profiles',
  columns: {
    id: column.integer(),
    accountId: column.integer(),
  },
})

function createContext(
  options?: Pick<SqlCompileContext, 'ilike'>,
): SqlCompileContext & { values: unknown[] } {
  let values: unknown[] = []
  return {
    ...options,
    values,
    quoteIdentifier: (value) => '"' + value + '"',
    bindValue(value) {
      values.push(value)
      return '$' + String(values.length)
    },
  }
}

describe('SQL helpers', () => {
  it('compiles order by directions case-insensitively', () => {
    assert.equal(compileOrderByDirection('asc'), 'ASC')
    assert.equal(compileOrderByDirection('ASC'), 'ASC')
    assert.equal(compileOrderByDirection('Asc'), 'ASC')
    assert.equal(compileOrderByDirection('desc'), 'DESC')
    assert.equal(compileOrderByDirection('DESC'), 'DESC')
    assert.equal(compileOrderByDirection('Desc'), 'DESC')
  })

  it('rejects invalid order by directions', () => {
    assert.throws(
      () => compileOrderByDirection('ascending'),
      /Invalid order by direction: expected "asc" or "desc"/,
    )
  })

  it('compiles comparison predicates with bound values', () => {
    let context = createContext()
    assert.equal(compilePredicate(gt('accounts.id', 10), context), '"accounts"."id" > $1')
    assert.deepEqual(context.values, [10])
  })

  it('compiles null equality as is null', () => {
    let context = createContext()
    assert.equal(compilePredicate(eq('email', null), context), '"email" is null')
    assert.deepEqual(context.values, [])
  })

  it('compiles empty in lists as constant predicates', () => {
    let context = createContext()
    assert.equal(compilePredicate(inList('id', []), context), '1 = 0')
    assert.equal(compilePredicate(inList('id', [1, 2]), context), '"id" in ($1, $2)')
    assert.deepEqual(context.values, [1, 2])
  })

  it('compiles ilike with lower() by default', () => {
    let context = createContext()
    assert.equal(
      compilePredicate(ilike('email', '%@remix.run'), context),
      'lower("email") like lower($1)',
    )
  })

  it('compiles ilike natively when the dialect supports it', () => {
    let context = createContext({ ilike: 'ilike' })
    assert.equal(compilePredicate(ilike('email', '%@remix.run'), context), '"email" ilike $1')
  })

  it('compiles between, null, and nested logical predicates', () => {
    let context = createContext()
    let predicate = or(between('id', 1, 5), and(isNull('email'), eq('id', 9)))
    assert.equal(
      compilePredicate(predicate, context),
      '("id" between $1 and $2) or (("email" is null) and ("id" = $3))',
    )
    assert.deepEqual(context.values, [1, 5, 9])
  })

  it('compiles from clauses with joins', () => {
    let context = createContext()
    assert.equal(
      compileFromClause(
        accounts,
        [{ type: 'left', table: profiles, on: eq('accounts.id', 7) }],
        context,
      ),
      ' from "accounts" left join "profiles" on "accounts"."id" = $1',
    )
  })

  it('compiles where and having clauses only when predicates exist', () => {
    let context = createContext()
    assert.equal(compileWhereClause([], context), '')
    assert.equal(compileHavingClause([], context), '')
    assert.equal(
      compileWhereClause([eq('id', 1), eq('email', 'a')], context),
      ' where ("id" = $1) and ("email" = $2)',
    )
    assert.equal(compileHavingClause([gt('id', 2)], context), ' having ("id" > $3)')
  })

  it('compiles group by and order by clauses', () => {
    let context = createContext()
    assert.equal(compileGroupByClause([], context), '')
    assert.equal(compileGroupByClause(['accounts.email'], context), ' group by "accounts"."email"')
    assert.equal(
      compileOrderByClause([{ column: 'id', direction: 'desc' }], context),
      ' order by "id" DESC',
    )
  })

  it('binds limit before offset', () => {
    let context = createContext()
    assert.equal(compileLimitOffsetClause(undefined, undefined, context), '')
    assert.equal(compileLimitOffsetClause(10, 20, context), ' limit $1 offset $2')
    assert.deepEqual(context.values, [10, 20])
  })

  it('compiles returning clauses', () => {
    let context = createContext()
    assert.equal(compileReturningClause(undefined, context), '')
    assert.equal(compileReturningClause('*', context), ' returning *')
    assert.equal(compileReturningClause(['id', 'email'], context), ' returning "id", "email"')
  })
})
