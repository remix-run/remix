import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string, boolean } from '@remix-run/data-schema'

import { createTable } from './model.ts'
import { eq } from './operators.ts'
import { MemoryDatabaseAdapter } from './memory-adapter.ts'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
  },
})

let Projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    archived: boolean(),
  },
})

describe('memory adapter contract', () => {
  it('supports join semantics across inner/left/right/full joins', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [
        { id: 1, email: 'a@example.com', status: 'active' },
        { id: 2, email: 'b@example.com', status: 'active' },
      ],
      projects: [
        { id: 100, account_id: 1, archived: false },
        { id: 101, account_id: 99, archived: false },
      ],
    })

    let inner = await adapter.execute({
      statement: {
        kind: 'select',
        table: Accounts,
        select: [
          { column: 'id', alias: 'id' },
          { column: 'projects.account_id', alias: 'projects.account_id' },
        ],
        distinct: false,
        joins: [{ type: 'inner', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [{ column: 'id', direction: 'asc' }],
      },
    })

    let left = await adapter.execute({
      statement: {
        kind: 'select',
        table: Accounts,
        select: [
          { column: 'id', alias: 'id' },
          { column: 'projects.account_id', alias: 'projects.account_id' },
        ],
        distinct: false,
        joins: [{ type: 'left', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [{ column: 'id', direction: 'asc' }],
      },
    })

    let right = await adapter.execute({
      statement: {
        kind: 'select',
        table: Accounts,
        select: [
          { column: 'id', alias: 'id' },
          { column: 'projects.account_id', alias: 'projects.account_id' },
        ],
        distinct: false,
        joins: [{ type: 'right', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [{ column: 'projects.account_id', direction: 'asc' }],
      },
    })

    let full = await adapter.execute({
      statement: {
        kind: 'select',
        table: Accounts,
        select: [
          { column: 'id', alias: 'id' },
          { column: 'projects.account_id', alias: 'projects.account_id' },
        ],
        distinct: false,
        joins: [{ type: 'full', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [{ column: 'projects.account_id', direction: 'asc' }],
      },
    })

    assert.equal(inner.rows?.length, 1)
    assert.deepEqual(inner.rows?.[0], { id: 1, 'projects.account_id': 1 })

    assert.equal(left.rows?.length, 2)
    assert.deepEqual(left.rows?.[0], { id: 1, 'projects.account_id': 1 })
    assert.deepEqual(left.rows?.[1], { id: 2, 'projects.account_id': undefined })

    assert.equal(right.rows?.length, 2)
    assert.deepEqual(right.rows?.[0], { id: 1, 'projects.account_id': 1 })
    assert.deepEqual(right.rows?.[1], { id: undefined, 'projects.account_id': 99 })

    assert.equal(full.rows?.length, 3)
    assert.deepEqual(full.rows?.[0], { id: 2, 'projects.account_id': undefined })
    assert.deepEqual(full.rows?.[1], { id: 1, 'projects.account_id': 1 })
    assert.deepEqual(full.rows?.[2], { id: undefined, 'projects.account_id': 99 })
  })

  it('applies joins, where, groupBy, and having in count/exists statements', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [
        { id: 1, email: 'a@example.com', status: 'active' },
        { id: 2, email: 'b@example.com', status: 'active' },
        { id: 3, email: 'c@example.com', status: 'inactive' },
      ],
      projects: [
        { id: 100, account_id: 1, archived: false },
        { id: 101, account_id: 1, archived: true },
        { id: 102, account_id: 2, archived: false },
      ],
    })

    let count = await adapter.execute({
      statement: {
        kind: 'count',
        table: Accounts,
        joins: [{ type: 'inner', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [eq('projects.archived', false)],
        groupBy: ['accounts.id'],
        having: [eq('status', 'active')],
      },
    })

    let exists = await adapter.execute({
      statement: {
        kind: 'exists',
        table: Accounts,
        joins: [{ type: 'inner', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [eq('projects.archived', false)],
        groupBy: ['accounts.id'],
        having: [eq('status', 'active')],
      },
    })

    assert.deepEqual(count.rows, [{ count: 2 }])
    assert.deepEqual(exists.rows, [{ exists: true }])
  })

  it('keeps qualified column references table-specific in unmatched join rows', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [{ id: 10, account_id: 99, archived: false }],
    })

    let rows = await adapter.execute({
      statement: {
        kind: 'select',
        table: Accounts,
        select: [
          { column: 'accounts.id', alias: 'accounts.id' },
          { column: 'projects.id', alias: 'projects.id' },
        ],
        distinct: false,
        joins: [{ type: 'right', table: Projects, on: eq('accounts.id', 'projects.account_id') }],
        where: [eq('accounts.id', 10)],
        groupBy: [],
        having: [],
        orderBy: [],
      },
    })

    assert.deepEqual(rows.rows, [])
  })

  it('supports transaction and savepoint lifecycle with commit and rollback', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
    })

    let tx1 = await adapter.beginTransaction()
    await adapter.execute({
      transaction: tx1,
      statement: {
        kind: 'insert',
        table: Accounts,
        values: { id: 2, email: 'b@example.com', status: 'active' },
      },
    })
    assert.equal(adapter.snapshot('accounts').length, 1)
    await adapter.commitTransaction(tx1)
    assert.equal(adapter.snapshot('accounts').length, 2)

    let tx2 = await adapter.beginTransaction()
    await adapter.execute({
      transaction: tx2,
      statement: {
        kind: 'insert',
        table: Accounts,
        values: { id: 3, email: 'c@example.com', status: 'active' },
      },
    })
    await adapter.rollbackTransaction(tx2)
    assert.equal(adapter.snapshot('accounts').length, 2)

    let tx3 = await adapter.beginTransaction()
    await adapter.execute({
      transaction: tx3,
      statement: {
        kind: 'insert',
        table: Accounts,
        values: { id: 4, email: 'd@example.com', status: 'active' },
      },
    })
    await adapter.createSavepoint(tx3, 'sp_1')
    await adapter.execute({
      transaction: tx3,
      statement: {
        kind: 'insert',
        table: Accounts,
        values: { id: 5, email: 'e@example.com', status: 'active' },
      },
    })
    await adapter.rollbackToSavepoint(tx3, 'sp_1')
    await adapter.releaseSavepoint(tx3, 'sp_1')
    await adapter.commitTransaction(tx3)

    let rows = adapter.snapshot('accounts')
    assert.deepEqual(
      rows.map((row) => row.id),
      [1, 2, 4],
    )
    assert.deepEqual(adapter.events, [
      'begin:tx_1',
      'commit:tx_1',
      'begin:tx_2',
      'rollback:tx_2',
      'begin:tx_3',
      'savepoint:tx_3:sp_1',
      'rollback-to-savepoint:tx_3:sp_1',
      'release-savepoint:tx_3:sp_1',
      'commit:tx_3',
    ])
  })

  it('throws for unknown transaction tokens and savepoints', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
    })

    await assert.rejects(
      async function () {
        await adapter.execute({
          transaction: { id: 'missing' },
          statement: {
            kind: 'select',
            table: Accounts,
            select: '*',
            distinct: false,
            joins: [],
            where: [],
            groupBy: [],
            having: [],
            orderBy: [],
          },
        })
      },
      /Unknown transaction token/,
    )

    await assert.rejects(
      async function () {
        await adapter.rollbackTransaction({ id: 'missing' })
      },
      /Unknown transaction token/,
    )

    let tx = await adapter.beginTransaction()

    await assert.rejects(
      async function () {
        await adapter.rollbackToSavepoint(tx, 'missing')
      },
      /Unknown savepoint/,
    )
  })
})
