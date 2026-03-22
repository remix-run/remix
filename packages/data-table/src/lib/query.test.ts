import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { column } from './column.ts'
import { eq } from './operators.ts'
import { cloneQueryConfig, createInitialQueryConfig, mergeQueryConfig } from './query/config.ts'
import type { QueryConfig } from './query/config.ts'
import { query, querySnapshot } from './query.ts'
import { createPredicateColumnResolver } from './query/predicate.ts'
import { isSelectionMap, normalizeSelection } from './query/selection.ts'
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
    assert.deepEqual(normalizeSelection([{ email: 'status', accountId: 'id' }]), [
      { column: 'status', alias: 'email' },
      { column: 'id', alias: 'accountId' },
    ])
    assert.deepEqual(normalizeSelection(['id', 'email']), [
      { column: 'id', alias: 'id' },
      { column: 'email', alias: 'email' },
    ])
  })

  it('merges query config without sharing nested state', () => {
    let config = createInitialQueryConfig()
    let where = [eq('status', 'active')]
    let merged = mergeQueryConfig(config, {
      where,
      with: {},
      limit: 10,
    })

    assert.notStrictEqual(merged.where, config.where)
    assert.notStrictEqual(merged.with, config.with)
    assert.equal(merged.where.length, 1)
    assert.equal(merged.limit, 10)

    where.push(eq('status', 'inactive'))

    assert.equal(config.where.length, 0)
    assert.equal(merged.where.length, 1)
  })

  it('clones query configs deeply', () => {
    let config: QueryConfig<
      {
        id: number
        email: string
        status: string
      },
      readonly ['id'],
      'upsert'
    > = {
      kind: 'upsert',
      select: '*',
      distinct: false,
      joins: [],
      where: [],
      groupBy: [],
      having: [],
      orderBy: [],
      with: {},
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

    let cloned = cloneQueryConfig(config)

    cloned.values.status = 'archived'
    cloned.options!.conflictTarget!.push('email')
    cloned.options!.update!.status = 'archived'

    assert.equal(config.values.status, 'active')
    assert.deepEqual(config.options!.conflictTarget, ['id'])
    assert.equal(config.options!.update!.status, 'inactive')
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
    snapshot.config.where.push(eq('status', 'inactive'))
    snapshot.config.options!.conflictTarget!.push('email')
    snapshot.config.options!.update!.status = 'archived'

    let nextSnapshot = snapshotSource[querySnapshot]()

    assert.equal(nextSnapshot.config.where.length, 0)
    assert.deepEqual(nextSnapshot.config.options?.conflictTarget, ['id'])
    assert.equal(nextSnapshot.config.options?.update?.status, 'inactive')

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
