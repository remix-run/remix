import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import { eq } from './operators.ts'
import { query, querySnapshot } from './query.ts'
import { createPredicateColumnResolver } from './query/predicate.ts'
import { cloneQueryPlan } from './query/plan.ts'
import { isSelectionMap, normalizeSelectionColumns, normalizeSelectionMap } from './query/selection.ts'
import type { QueryPlan } from './query/plan.ts'
import { createInitialQueryState, mergeQueryState } from './query/state.ts'
import { table } from './table.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
  },
})

let projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
  },
})

describe('query helpers', () => {
  it('normalizes select input shapes consistently', () => {
    assert.equal(isSelectionMap([{ email: 'email' }]), true)
    assert.equal(isSelectionMap(['email']), false)
    assert.deepEqual(normalizeSelectionMap({ email: 'status', accountId: 'id' }), [
      { column: 'status', alias: 'email' },
      { column: 'id', alias: 'accountId' },
    ])
    assert.deepEqual(normalizeSelectionColumns(['id', 'email']), [
      { column: 'id', alias: 'id' },
      { column: 'email', alias: 'email' },
    ])
  })

  it('merges query state without sharing nested state', () => {
    let state = createInitialQueryState()
    let where = [eq('status', 'active')]
    let merged = mergeQueryState(state, {
      where,
      with: {},
      limit: 10,
    })

    assert.notStrictEqual(merged.where, state.where)
    assert.notStrictEqual(merged.with, state.with)
    assert.equal(merged.where.length, 1)
    assert.equal(merged.limit, 10)

    where.push(eq('status', 'inactive'))

    assert.equal(state.where.length, 0)
    assert.equal(merged.where.length, 1)
  })

  it('clones write plans deeply', () => {
    let plan: QueryPlan<
      {
        id: number
        email: string
        status: string
      },
      readonly ['id'],
      'upsert'
    > = {
      kind: 'upsert',
      values: {
        id: 1,
        email: 'amy@studio.test',
        status: 'active',
      },
      options: {
        conflictTarget: ['id'],
        update: {
          status: 'inactive',
        },
      },
    }

    let cloned = cloneQueryPlan(plan) as typeof plan

    cloned.values.status = 'archived'
    cloned.options!.conflictTarget!.push('email')
    cloned.options!.update!.status = 'archived'

    assert.equal(plan.values.status, 'active')
    assert.deepEqual(plan.options!.conflictTarget, ['id'])
    assert.equal(plan.options!.update!.status, 'inactive')
  })

  it('resolves predicate columns and detects ambiguity', () => {
    let resolveColumn = createPredicateColumnResolver([accounts, projects])

    assert.deepEqual(resolveColumn('accounts.id'), {
      tableName: 'accounts',
      columnName: 'id',
    })
    assert.deepEqual(resolveColumn('email'), {
      tableName: 'accounts',
      columnName: 'email',
    })
    assert.throws(() => resolveColumn('id'), {
      message: 'Ambiguous predicate column "id". Use a qualified column name',
    })
  })

  it('returns isolated snapshots and rejects unsupported write modifiers', () => {
    let snapshotSource = query(accounts).upsert(
      {
        id: 1,
        email: 'amy@studio.test',
        status: 'active',
      },
      {
        conflictTarget: ['id'],
        update: {
          status: 'inactive',
        },
      },
    )

    let snapshot = snapshotSource[querySnapshot]()
    snapshot.state.where.push(eq('status', 'inactive'))
    snapshot.plan.options!.conflictTarget!.push('email')
    snapshot.plan.options!.update!.status = 'archived'

    let nextSnapshot = snapshotSource[querySnapshot]()

    assert.equal(nextSnapshot.state.where.length, 0)
    assert.deepEqual(nextSnapshot.plan.options?.conflictTarget, ['id'])
    assert.equal(nextSnapshot.plan.options?.update?.status, 'inactive')

    let invalidWriteQuery = query(accounts).distinct().where({ status: 'active' }).orderBy('id')

    assert.throws(
      () =>
        invalidWriteQuery.insert({
          id: 1,
          email: 'amy@studio.test',
          status: 'active',
        }),
      {
        message:
          'insert() does not support these query modifiers: distinct(), where(), orderBy()',
      },
    )
  })
})
