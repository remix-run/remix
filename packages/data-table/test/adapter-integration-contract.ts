import * as assert from 'node:assert/strict'
import { beforeEach, it } from 'node:test'

import { column } from '../src/lib/column.ts'
import type { Database } from '../src/lib/database.ts'
import { createMigration } from '../src/lib/migrations.ts'
import { createMigrationRunner } from '../src/lib/migrations/runner.ts'
import { table, hasMany, hasManyThrough } from '../src/lib/table.ts'
import { between, eq, ilike, inList, ne } from '../src/lib/operators.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    nickname: column.text().nullable(),
  },
})

let projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
    name: column.text(),
    archived: column.boolean(),
  },
})

let tasks = table({
  name: 'tasks',
  columns: {
    id: column.integer(),
    project_id: column.integer(),
    title: column.text(),
    state: column.text(),
  },
})

let accountProjects = hasMany(accounts, projects)
let accountTasks = hasManyThrough(accounts, tasks, {
  through: accountProjects,
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

      await db.query(accounts).insertMany([
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
      await db.query(projects).insertMany([
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
        .query(accounts)
        .join(projects, eq('accounts.id', 'projects.account_id'))
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
        .query(accounts)
        .join(projects, eq('accounts.id', 'projects.account_id'))
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

      await db.query(accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
      ])
      await db.query(projects).insertMany([
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ])
      await db.query(tasks).insertMany([
        { id: 1000, project_id: 100, title: 'A1-T1', state: 'open' },
        { id: 1001, project_id: 101, title: 'A2-T1', state: 'open' },
        { id: 2000, project_id: 200, title: 'B1-T1', state: 'open' },
        { id: 2001, project_id: 201, title: 'B2-T1', state: 'open' },
      ])

      let accountRows = await db
        .query(accounts)
        .orderBy('id', 'asc')
        .with({
          projects: accountProjects.orderBy('id', 'asc').limit(1),
          tasks: accountTasks.orderBy('id', 'asc').limit(1),
        })
        .all()

      assert.equal(accountRows.length, 2)
      assert.equal(accountRows[0].projects.length, 1)
      assert.equal(accountRows[0].projects[0].id, 100)
      assert.equal(accountRows[1].projects.length, 1)
      assert.equal(accountRows[1].projects[0].id, 200)
      assert.equal(accountRows[0].tasks.length, 1)
      assert.equal(accountRows[0].tasks[0].id, 1000)
      assert.equal(accountRows[1].tasks.length, 1)
      assert.equal(accountRows[1].tasks[0].id, 2000)
    },
  )

  it(
    'scopes update/delete writes with orderBy and limit',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
        { id: 3, email: 'c@example.com', status: 'active', nickname: null },
      ])

      await db
        .query(accounts)
        .where({ status: 'active' })
        .orderBy('id', 'asc')
        .limit(1)
        .update({ status: 'paused' })

      await db.query(accounts).where({ status: 'active' }).orderBy('id', 'desc').limit(1).delete()

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.deepEqual(
        rows.map((row) => ({ id: row.id, status: row.status })),
        [
          { id: 1, status: 'paused' },
          { id: 2, status: 'active' },
        ],
      )
    },
  )

  it(
    'supports transactions and nested savepoints',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(accounts).insert({
        id: 1,
        email: 'a@example.com',
        status: 'active',
        nickname: null,
      })

      await db.transaction(async (outerTransaction) => {
        await outerTransaction.query(accounts).insert({
          id: 2,
          email: 'b@example.com',
          status: 'active',
          nickname: null,
        })

        await outerTransaction
          .transaction(async (innerTransaction) => {
            await innerTransaction.query(accounts).insert({
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
          await transactionDatabase.query(accounts).insert({
            id: 4,
            email: 'd@example.com',
            status: 'active',
            nickname: null,
          })

          throw new Error('rollback outer')
        })
        .catch(() => undefined)

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.deepEqual(
        rows.map((row) => row.id),
        [1, 2],
      )
    },
  )

  it(
    'supports upsert with conflict target',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(accounts).insert({
        id: 1,
        email: 'a@example.com',
        status: 'active',
        nickname: null,
      })

      await db.query(accounts).upsert(
        {
          id: 1,
          email: 'a@example.com',
          status: 'inactive',
          nickname: 'alpha',
        },
        { conflictTarget: ['id'] },
      )
      await db.query(accounts).upsert(
        {
          id: 2,
          email: 'b@example.com',
          status: 'active',
          nickname: null,
        },
        { conflictTarget: ['id'] },
      )

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.equal(rows.length, 2)
      assert.equal(rows[0].status, 'inactive')
      assert.equal(rows[0].nickname, 'alpha')
      assert.equal(rows[1].id, 2)
    },
  )

  it(
    'supports null and value operators in real queries',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()

      await db.query(accounts).insertMany([
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

      let nullNickname = await db
        .query(accounts)
        .where(eq('nickname', null))
        .orderBy('id', 'asc')
        .all()
      let nonNullNickname = await db.query(accounts).where(ne('nickname', null)).all()
      let inRows = await db
        .query(accounts)
        .where(inList('id', [1, 3]))
        .orderBy('id', 'asc')
        .all()
      let betweenRows = await db
        .query(accounts)
        .where(between('id', 2, 3))
        .orderBy('id', 'asc')
        .all()
      let ilikeRows = await db
        .query(accounts)
        .where(ilike('email', '%@example.com'))
        .orderBy('id', 'asc')
        .all()

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
    },
  )

  it(
    'supports migration up/down with lifecycle hooks and returned reads',
    { skip: !options.integrationEnabled },
    async function () {
      let db = options.createDatabase()
      let lifecycleEvents: string[] = []
      let lifecycleAccounts = table({
        name: 'lifecycle_accounts',
        columns: {
          id: column.integer(),
          email: column.text(),
          status: column.text(),
        },
        beforeWrite({ value }) {
          lifecycleEvents.push('beforeWrite')
          return {
            value: {
              ...value,
              email:
                typeof value.email === 'string' ? value.email.trim().toLowerCase() : value.email,
              status:
                value.status === undefined
                  ? 'active'
                  : typeof value.status === 'string'
                    ? value.status.trim().toLowerCase()
                    : value.status,
            },
          }
        },
        validate({ value }) {
          lifecycleEvents.push('validate')
          if (typeof value.email !== 'string' || !value.email.includes('@')) {
            return { issues: [{ message: 'Expected valid email', path: ['email'] }] }
          }
          return { value }
        },
        afterWrite({ operation, affectedRows }) {
          lifecycleEvents.push('afterWrite:' + operation + ':' + String(affectedRows))
        },
        afterRead({ value }) {
          if (typeof value.email !== 'string') {
            return { value }
          }
          return {
            value: {
              ...value,
              email: value.email.toUpperCase(),
            },
          }
        },
      })
      let migration = createMigration({
        async up({ schema }) {
          await schema.createTable(lifecycleAccounts, { ifNotExists: true })
        },
        async down({ schema }) {
          await schema.dropTable('lifecycle_accounts', { ifExists: true })
        },
      })
      let runner = createMigrationRunner(
        db.adapter,
        [{ id: '20260228001000', name: 'create_lifecycle_accounts', migration }],
        { journalTable: 'adapter_contract_migrations' },
      )

      await runner.up()

      let created = await db.create(
        lifecycleAccounts,
        {
          id: 1,
          email: '  User@Example.com  ',
        },
        { returnRow: true },
      )
      let loaded = await db.find(lifecycleAccounts, 1)
      let statusAfterUp = await runner.status()

      assert.equal(created.email, 'USER@EXAMPLE.COM')
      assert.equal(created.status, 'active')
      assert.equal(loaded?.email, 'USER@EXAMPLE.COM')
      assert.deepEqual(lifecycleEvents, ['beforeWrite', 'validate', 'afterWrite:create:1'])
      assert.equal(statusAfterUp.length, 1)
      assert.equal(statusAfterUp[0].status, 'applied')

      await runner.down({ step: 1 })

      let statusAfterDown = await runner.status()
      assert.equal(statusAfterDown.length, 1)
      assert.equal(statusAfterDown[0].status, 'pending')
    },
  )
}
