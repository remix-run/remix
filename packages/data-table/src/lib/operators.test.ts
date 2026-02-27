import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number } from '@remix-run/data-schema'

import {
  and,
  between,
  eq,
  getPredicateColumns,
  gt,
  gte,
  ilike,
  inList,
  isNull,
  isPredicate,
  like,
  lt,
  lte,
  ne,
  normalizeWhereInput,
  notInList,
  notNull,
  or,
} from './operators.ts'
import { createTable } from './table.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
  },
})

let projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
  },
})

let invoices = createTable({
  name: 'billing.invoices',
  columns: {
    id: number(),
    account_id: number(),
    total: number(),
  },
})

describe('comparison predicates', () => {
  it('treats qualified string values as column references', () => {
    let predicate = eq('accounts.id', 'projects.account_id')

    assert.deepEqual(predicate, {
      type: 'comparison',
      operator: 'eq',
      column: 'accounts.id',
      value: 'projects.account_id',
      valueType: 'column',
    })
  })

  it('supports column reference inputs', () => {
    let predicate = eq(accounts.id, projects.account_id)

    assert.deepEqual(predicate, {
      type: 'comparison',
      operator: 'eq',
      column: 'accounts.id',
      value: 'projects.account_id',
      valueType: 'column',
    })
  })

  it('supports cross schema column reference inputs', () => {
    let predicate = eq(accounts.id, invoices.account_id)

    assert.deepEqual(predicate, {
      type: 'comparison',
      operator: 'eq',
      column: 'accounts.id',
      value: 'billing.invoices.account_id',
      valueType: 'column',
    })
  })

  it('treats unqualified values as scalar values', () => {
    let predicate = eq('id', 'projects.account_id')

    assert.deepEqual(predicate, {
      type: 'comparison',
      operator: 'eq',
      column: 'id',
      value: 'projects.account_id',
      valueType: 'value',
    })
  })

  it('builds standard comparison predicates', () => {
    assert.deepEqual(ne('status', 'active'), {
      type: 'comparison',
      operator: 'ne',
      column: 'status',
      value: 'active',
      valueType: 'value',
    })

    assert.deepEqual(gt('score', 10), {
      type: 'comparison',
      operator: 'gt',
      column: 'score',
      value: 10,
      valueType: 'value',
    })

    assert.deepEqual(gte('score', 10), {
      type: 'comparison',
      operator: 'gte',
      column: 'score',
      value: 10,
      valueType: 'value',
    })

    assert.deepEqual(lt('score', 10), {
      type: 'comparison',
      operator: 'lt',
      column: 'score',
      value: 10,
      valueType: 'value',
    })

    assert.deepEqual(lte('score', 10), {
      type: 'comparison',
      operator: 'lte',
      column: 'score',
      value: 10,
      valueType: 'value',
    })

    assert.deepEqual(like('email', '%@example.com'), {
      type: 'comparison',
      operator: 'like',
      column: 'email',
      value: '%@example.com',
      valueType: 'value',
    })

    assert.deepEqual(ilike('email', '%@example.com'), {
      type: 'comparison',
      operator: 'ilike',
      column: 'email',
      value: '%@example.com',
      valueType: 'value',
    })
  })
})

describe('collection and null predicates', () => {
  it('clones inList and notInList arrays', () => {
    let values = [1, 2, 3]
    let inPredicate = inList('id', values)
    let notInPredicate = notInList('id', values)
    values.push(4)

    assert.deepEqual(inPredicate, {
      type: 'comparison',
      operator: 'in',
      column: 'id',
      value: [1, 2, 3],
      valueType: 'value',
    })
    assert.deepEqual(notInPredicate, {
      type: 'comparison',
      operator: 'notIn',
      column: 'id',
      value: [1, 2, 3],
      valueType: 'value',
    })
  })

  it('builds between and null predicates', () => {
    assert.deepEqual(between('created_at', 1, 10), {
      type: 'between',
      column: 'created_at',
      lower: 1,
      upper: 10,
    })
    assert.deepEqual(isNull('deleted_at'), {
      type: 'null',
      operator: 'isNull',
      column: 'deleted_at',
    })
    assert.deepEqual(notNull('deleted_at'), {
      type: 'null',
      operator: 'notNull',
      column: 'deleted_at',
    })
  })
})

describe('logical predicates', () => {
  it('normalizes object filters into and(eq()) predicates', () => {
    let predicate = normalizeWhereInput({
      id: 10,
      status: 'active',
    })

    assert.equal(predicate.type, 'logical')
    assert.equal(predicate.operator, 'and')
    assert.equal(predicate.predicates.length, 2)
    assert.deepEqual(predicate.predicates[0], eq('id', 10))
    assert.deepEqual(predicate.predicates[1], eq('status', 'active'))
  })

  it('returns predicate inputs unchanged', () => {
    let input = eq('status', 'active')
    let normalized = normalizeWhereInput(input)

    assert.equal(normalized, input)
  })

  it('filters falsy values when combining logical predicates', () => {
    let predicate = and(eq('id', 10), null as never, undefined as never)

    assert.deepEqual(predicate, {
      type: 'logical',
      operator: 'and',
      predicates: [eq('id', 10)],
    })

    let disjunction = or(eq('status', 'active'), false as never)

    assert.deepEqual(disjunction, {
      type: 'logical',
      operator: 'or',
      predicates: [eq('status', 'active')],
    })
  })

  it('collects columns across nested predicates', () => {
    let predicate = and(
      eq('accounts.id', 'projects.account_id'),
      or(
        between('accounts.id', 1, 5),
        and(isNull('projects.deleted_at'), notNull('accounts.email')),
      ),
    )

    assert.deepEqual(getPredicateColumns(predicate), [
      'accounts.id',
      'projects.account_id',
      'accounts.id',
      'projects.deleted_at',
      'accounts.email',
    ])
  })

  it('collects columns for scalar comparison predicates', () => {
    assert.deepEqual(getPredicateColumns(eq('accounts.id', 1)), ['accounts.id'])
  })

  it('identifies predicate-like inputs', () => {
    assert.equal(isPredicate(eq('id', 1)), true)
    assert.equal(isPredicate({ type: 'logical', operator: 'and', predicates: [] }), true)
    assert.equal(isPredicate({}), false)
    assert.equal(isPredicate(null), false)
    assert.equal(isPredicate({ type: 'unknown' }), false)
  })
})
