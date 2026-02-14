import * as assert from 'node:assert/strict'
import { beforeEach, it } from 'node:test'
import { boolean, nullable, number, string } from '@remix-run/data-schema'

import type { Database } from '../src/lib/database.ts'
import { createTable } from '../src/lib/table.ts'
import { between, eq, ilike, inList, ne } from '../src/lib/operators.ts'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
    nickname: nullable(string()),
  },
})

let Projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    name: string(),
    archived: boolean(),
  },
})

let Tasks = createTable({
  name: 'tasks',
  columns: {
    id: number(),
    project_id: number(),
    title: string(),
    state: string(),
  },
})

let AccountProjects = Accounts.hasMany(Projects)
let AccountTasks = Accounts.hasManyThrough(Tasks, {
  through: AccountProjects,
})

export type IntegrationContractOptions = {
  integrationEnabled: boolean
  createDatabase: () => Database
  resetDatabase: () => Promise<void>
}

export function runAdapterIntegrationContract(options: IntegrationContractOptions): void {
  beforeEach(async () => {
    if (!options.integrationEnabled) {
      return
    }

    await options.resetDatabase()
  })

  it(
    'supports joined alias select with groupBy/having',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(Accounts).insertMany([
        {
          id: 1,
          email: 'a@example.com',
          status: 'active',
          nickname: null,
        },
        {
          id: 2,
          email: 'b@example.com',
          status: 'inactive',
          nickname: 'bee',
        },
      ])
      await db.query(Projects).insertMany([
        {
          id: 100,
          account_id: 1,
          name: 'Alpha',
          archived: false,
        },
        {
          id: 101,
          account_id: 1,
          name: 'Beta',
          archived: true,
        },
        {
          id: 200,
          account_id: 2,
          name: 'Gamma',
          archived: false,
        },
      ])

      let joined = await db
        .query(Accounts)
        .join(Projects, eq('accounts.id', 'projects.account_id'))
        .where(eq('projects.archived', false))
        .select({
          accountId: 'accounts.id',
          accountEmail: 'accounts.email',
          projectId: 'projects.id',
          projectName: 'projects.name',
        })
        .orderBy('projects.id', 'asc')
        .all()

      assert.deepEqual(joined, [
        {
          accountId: 1,
          accountEmail: 'a@example.com',
          projectId: 100,
          projectName: 'Alpha',
        },
        {
          accountId: 2,
          accountEmail: 'b@example.com',
          projectId: 200,
          projectName: 'Gamma',
        },
      ])

      let groupedCount = await db
        .query(Accounts)
        .join(Projects, eq('accounts.id', 'projects.account_id'))
        .where(eq('projects.archived', false))
        .groupBy('accounts.id')
        .having(eq('accounts.id', 1))
        .count()

      assert.equal(groupedCount, 1)
    },
  )

  it(
    'supports eager relations with per-parent relation pagination',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(Accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
      ])
      await db.query(Projects).insertMany([
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ])
      await db.query(Tasks).insertMany([
        { id: 1000, project_id: 100, title: 'A1-T1', state: 'open' },
        { id: 1001, project_id: 101, title: 'A2-T1', state: 'open' },
        { id: 2000, project_id: 200, title: 'B1-T1', state: 'open' },
        { id: 2001, project_id: 201, title: 'B2-T1', state: 'open' },
      ])

      let accounts = await db.query(Accounts).orderBy('id', 'asc').with({
        projects: AccountProjects.orderBy('id', 'asc').limit(1),
        tasks: AccountTasks.orderBy('id', 'asc').limit(1),
      }).all()

      assert.equal(accounts.length, 2)
      assert.equal(accounts[0].projects.length, 1)
      assert.equal(accounts[0].projects[0].id, 100)
      assert.equal(accounts[1].projects.length, 1)
      assert.equal(accounts[1].projects[0].id, 200)
      assert.equal(accounts[0].tasks.length, 1)
      assert.equal(accounts[0].tasks[0].id, 1000)
      assert.equal(accounts[1].tasks.length, 1)
      assert.equal(accounts[1].tasks[0].id, 2000)
    },
  )

  it(
    'scopes update/delete writes with orderBy and limit',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(Accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
        { id: 3, email: 'c@example.com', status: 'active', nickname: null },
      ])

      await db
        .query(Accounts)
        .where({ status: 'active' })
        .orderBy('id', 'asc')
        .limit(1)
        .update({ status: 'paused' })

      await db
        .query(Accounts)
        .where({ status: 'active' })
        .orderBy('id', 'desc')
        .limit(1)
        .delete()

      let rows = await db.query(Accounts).orderBy('id', 'asc').all()

      assert.deepEqual(
        rows.map((row) => ({ id: row.id, status: row.status })),
        [
          { id: 1, status: 'paused' },
          { id: 2, status: 'active' },
        ],
      )
    },
  )

  it('supports transactions and nested savepoints', { skip: !options.integrationEnabled }, async function () {
    let db = options.createDatabase()

    await db.query(Accounts).insert({
      id: 1,
      email: 'a@example.com',
      status: 'active',
      nickname: null,
    })

    await db.transaction(async (outerTransaction) => {
      await outerTransaction.query(Accounts).insert({
        id: 2,
        email: 'b@example.com',
        status: 'active',
        nickname: null,
      })

      await outerTransaction
        .transaction(async (innerTransaction) => {
          await innerTransaction.query(Accounts).insert({
            id: 3,
            email: 'c@example.com',
            status: 'active',
            nickname: null,
          })

          throw new Error('rollback inner')
        })
        .catch(() => undefined)
    })

    await db
      .transaction(async (transactionDatabase) => {
        await transactionDatabase.query(Accounts).insert({
          id: 4,
          email: 'd@example.com',
          status: 'active',
          nickname: null,
        })

        throw new Error('rollback outer')
      })
      .catch(() => undefined)

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

    assert.deepEqual(
      rows.map((row) => row.id),
      [1, 2],
    )
  })

  it('supports upsert with conflict target', { skip: !options.integrationEnabled }, async function () {
    let db = options.createDatabase()

    await db.query(Accounts).insert({
      id: 1,
      email: 'a@example.com',
      status: 'active',
      nickname: null,
    })

    await db.query(Accounts).upsert(
      {
        id: 1,
        email: 'a@example.com',
        status: 'inactive',
        nickname: 'alpha',
      },
      { conflictTarget: ['id'] },
    )
    await db.query(Accounts).upsert(
      {
        id: 2,
        email: 'b@example.com',
        status: 'active',
        nickname: null,
      },
      { conflictTarget: ['id'] },
    )

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

    assert.equal(rows.length, 2)
    assert.equal(rows[0].status, 'inactive')
    assert.equal(rows[0].nickname, 'alpha')
    assert.equal(rows[1].id, 2)
  })

  it('supports null and value operators in real queries', { skip: !options.integrationEnabled }, async function () {
    let db = options.createDatabase()

    await db.query(Accounts).insertMany([
      {
        id: 1,
        email: 'A@Example.com',
        status: 'active',
        nickname: null,
      },
      {
        id: 2,
        email: 'b@example.com',
        status: 'inactive',
        nickname: 'bee',
      },
      {
        id: 3,
        email: 'c@example.com',
        status: 'active',
        nickname: null,
      },
    ])

    let nullNickname = await db.query(Accounts).where(eq('nickname', null)).orderBy('id', 'asc').all()
    let nonNullNickname = await db.query(Accounts).where(ne('nickname', null)).all()
    let inRows = await db.query(Accounts).where(inList('id', [1, 3])).orderBy('id', 'asc').all()
    let betweenRows = await db.query(Accounts).where(between('id', 2, 3)).orderBy('id', 'asc').all()
    let ilikeRows = await db.query(Accounts).where(ilike('email', '%@example.com')).orderBy('id', 'asc').all()

    assert.deepEqual(
      nullNickname.map((row) => row.id),
      [1, 3],
    )
    assert.equal(nonNullNickname.length, 1)
    assert.equal(nonNullNickname[0].id, 2)
    assert.deepEqual(
      inRows.map((row) => row.id),
      [1, 3],
    )
    assert.deepEqual(
      betweenRows.map((row) => row.id),
      [2, 3],
    )
    assert.deepEqual(
      ilikeRows.map((row) => row.id),
      [1, 2, 3],
    )
  })
}
