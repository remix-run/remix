import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'

import type { AdapterStatement, DatabaseAdapter } from './adapter.ts'
import { createDatabase } from './database.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import { belongsTo, createTable, hasMany, hasManyThrough, hasOne, timestamps } from './table.ts'
import { eq } from './operators.ts'
import { sql } from './sql.ts'
import type { SqliteTestAdapterOptions, SqliteTestSeed } from '../../test/sqlite-test-database.ts'
import { createSqliteTestAdapter } from '../../test/sqlite-test-database.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
    ...timestamps(),
  },
  timestamps: true,
})

let projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    name: string(),
    archived: boolean(),
  },
})

let profiles = createTable({
  name: 'profiles',
  columns: {
    id: number(),
    account_id: number(),
    display_name: string(),
  },
})

let tasks = createTable({
  name: 'tasks',
  columns: {
    id: number(),
    project_id: number(),
    title: string(),
    state: string(),
  },
})

let memberships = createTable({
  name: 'memberships',
  primaryKey: ['organization_id', 'account_id'],
  columns: {
    organization_id: number(),
    account_id: number(),
    role: string(),
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

let accountProjects = hasMany(accounts, projects)
let accountProfile = hasOne(accounts, profiles)
let projectAccount = belongsTo(projects, accounts)
let accountTasks = hasManyThrough(accounts, tasks, {
  through: accountProjects,
})

let cleanups = new Set<() => void>()

afterEach(() => {
  for (let cleanup of cleanups) {
    cleanup()
  }

  cleanups.clear()
})

describe('query builder', () => {
  it('is immutable and supports eager hasMany loading', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'Spring Campaign', archived: false },
        { id: 101, account_id: 1, name: 'Legacy Data Migration', archived: true },
        { id: 102, account_id: 2, name: 'Customer Onboarding', archived: false },
      ],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let archivedExcludedProjects = accountProjects.where({ archived: false }).orderBy('id', 'asc')

    let allAccountsQuery = db.query(accounts)
    let activeAccountsQuery = allAccountsQuery.where({ status: 'active' })

    let allAccounts = await allAccountsQuery.all()
    let activeAccounts = await activeAccountsQuery
      .with({ projects: archivedExcludedProjects })
      .all()

    assert.equal(allAccounts.length, 2)
    assert.equal(activeAccounts.length, 1)
    assert.equal(activeAccounts[0].email, 'amy@studio.test')
    assert.equal(activeAccounts[0].projects.length, 1)
    assert.equal(activeAccounts[0].projects[0].name, 'Spring Campaign')
  })

  it('supports hasManyThrough loading', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'active' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'Spring Campaign', archived: false },
        { id: 101, account_id: 1, name: 'Fall Campaign', archived: false },
        { id: 102, account_id: 2, name: 'Launch Site', archived: false },
      ],
      tasks: [
        { id: 1000, project_id: 100, title: 'Define Ad Sets', state: 'open' },
        { id: 1001, project_id: 100, title: 'Build UTM Links', state: 'done' },
        { id: 1002, project_id: 101, title: 'Draft Landing Page', state: 'open' },
        { id: 1003, project_id: 102, title: 'Collect Testimonials', state: 'open' },
      ],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let openTasks = accountTasks.where({ state: 'open' }).orderBy('id', 'asc')

    let accountRows = await db.query(accounts).orderBy('id', 'asc').with({ tasks: openTasks }).all()

    assert.equal(accountRows[0].tasks.length, 2)
    assert.equal(accountRows[0].tasks[0].title, 'Define Ad Sets')
    assert.equal(accountRows[0].tasks[1].title, 'Draft Landing Page')
    assert.equal(accountRows[1].tasks.length, 1)
    assert.equal(accountRows[1].tasks[0].title, 'Collect Testimonials')
  })

  it('applies hasMany relation limit/offset per parent row', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'active' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    let firstProjectPerAccount = await db
      .query(accounts)
      .orderBy('id', 'asc')
      .with({
        projects: accountProjects.orderBy('id', 'asc').limit(1),
      })
      .all()

    assert.equal(firstProjectPerAccount[0].projects.length, 1)
    assert.equal(firstProjectPerAccount[0].projects[0].id, 100)
    assert.equal(firstProjectPerAccount[1].projects.length, 1)
    assert.equal(firstProjectPerAccount[1].projects[0].id, 200)

    let secondProjectPerAccount = await db
      .query(accounts)
      .orderBy('id', 'asc')
      .with({
        projects: accountProjects.orderBy('id', 'asc').offset(1).limit(1),
      })
      .all()

    assert.equal(secondProjectPerAccount[0].projects.length, 1)
    assert.equal(secondProjectPerAccount[0].projects[0].id, 101)
    assert.equal(secondProjectPerAccount[1].projects.length, 1)
    assert.equal(secondProjectPerAccount[1].projects[0].id, 201)
  })

  it('applies hasManyThrough relation pagination per parent row', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'active' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ],
      tasks: [
        { id: 1000, project_id: 100, title: 'A-1 Task', state: 'open' },
        { id: 1001, project_id: 101, title: 'A-2 Task', state: 'open' },
        { id: 2000, project_id: 200, title: 'B-1 Task', state: 'open' },
        { id: 2001, project_id: 201, title: 'B-2 Task', state: 'open' },
      ],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    let firstTaskPerAccount = await db
      .query(accounts)
      .orderBy('id', 'asc')
      .with({
        tasks: accountTasks.orderBy('id', 'asc').limit(1),
      })
      .all()

    assert.equal(firstTaskPerAccount[0].tasks.length, 1)
    assert.equal(firstTaskPerAccount[0].tasks[0].id, 1000)
    assert.equal(firstTaskPerAccount[1].tasks.length, 1)
    assert.equal(firstTaskPerAccount[1].tasks[0].id, 2000)

    let secondTaskPerAccount = await db
      .query(accounts)
      .orderBy('id', 'asc')
      .with({
        tasks: accountTasks.orderBy('id', 'asc').offset(1).limit(1),
      })
      .all()

    assert.equal(secondTaskPerAccount[0].tasks.length, 1)
    assert.equal(secondTaskPerAccount[0].tasks[0].id, 1001)
    assert.equal(secondTaskPerAccount[1].tasks.length, 1)
    assert.equal(secondTaskPerAccount[1].tasks[0].id, 2001)
  })

  it('applies hasManyThrough through-relation pagination per parent row', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'active' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ],
      tasks: [
        { id: 1000, project_id: 100, title: 'A-1 Task', state: 'open' },
        { id: 1001, project_id: 101, title: 'A-2 Task', state: 'open' },
        { id: 2000, project_id: 200, title: 'B-1 Task', state: 'open' },
        { id: 2001, project_id: 201, title: 'B-2 Task', state: 'open' },
      ],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let firstProjectPerAccount = accountProjects.orderBy('id', 'asc').limit(1)
    let tasksThroughFirstProject = hasManyThrough(accounts, tasks, {
      through: firstProjectPerAccount,
    }).orderBy('id', 'asc')

    let accountRows = await db
      .query(accounts)
      .orderBy('id', 'asc')
      .with({ tasks: tasksThroughFirstProject })
      .all()

    assert.equal(accountRows[0].tasks.length, 1)
    assert.equal(accountRows[0].tasks[0].id, 1000)
    assert.equal(accountRows[1].tasks.length, 1)
    assert.equal(accountRows[1].tasks[0].id, 2000)
  })

  it('supports composite primary keys in find()', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [
        { organization_id: 9, account_id: 1, role: 'owner' },
        { organization_id: 9, account_id: 2, role: 'member' },
      ],
    })

    let db = createTestDatabase(adapter)
    let membership = await db.query(memberships).find({ organization_id: 9, account_id: 2 })

    assert.ok(membership)
    assert.equal(membership.role, 'member')
  })

  it('supports database-level find helpers', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'Spring Campaign', archived: false },
        { id: 101, account_id: 1, name: 'Legacy Data Migration', archived: true },
        { id: 102, account_id: 2, name: 'Customer Onboarding', archived: false },
      ],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let openProjects = accountProjects.where({ archived: false }).orderBy('id', 'asc')

    let account = await db.find(accounts, 1)
    let activeAccount = await db.findOne(accounts, {
      where: { status: 'active' },
      orderBy: ['id', 'asc'],
    })
    let activeAccounts = await db.findMany(accounts, {
      where: { status: 'active' },
      orderBy: [
        ['status', 'asc'],
        ['id', 'asc'],
      ],
      limit: 1,
    })
    let activeCount = await db.count(accounts, { where: { status: 'active' } })
    let accountsWithProjects = await db.findMany(accounts, {
      orderBy: ['id', 'asc'],
      with: { projects: openProjects },
    })

    assert.equal(account?.email, 'amy@studio.test')
    assert.equal(activeAccount?.id, 1)
    assert.equal(activeAccounts.length, 1)
    assert.equal(activeAccounts[0].id, 1)
    assert.equal(activeCount, 1)
    assert.equal(accountsWithProjects[0].projects.length, 1)
    assert.equal(accountsWithProjects[0].projects[0].id, 100)
    assert.equal(accountsWithProjects[1].projects.length, 1)
    assert.equal(accountsWithProjects[1].projects[0].id, 102)
  })

  it('returns null from database-level find helper for nullish primary keys', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let nullResult = await db.find(accounts, null)
    let undefinedResult = await db.find(accounts, undefined)

    assert.equal(nullResult, null)
    assert.equal(undefinedResult, null)
  })

  it('supports database-level update helper', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'Spring Campaign', archived: false },
        { id: 101, account_id: 1, name: 'Legacy Data Migration', archived: true },
      ],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let openProjects = accountProjects.where({ archived: false }).orderBy('id', 'asc')

    let updated = await db.update(
      accounts,
      1,
      {
        status: 'inactive',
      },
      { with: { projects: openProjects } },
    )

    assert.equal(updated.status, 'inactive')
    assert.equal(updated.projects.length, 1)
    assert.equal(updated.projects[0].id, 100)
  })

  it('throws from database-level update helper when row is missing', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.update(accounts, 999, { status: 'active' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'update() failed to find row for table "accounts"'
        )
      },
    )
  })

  it('does not pre-read when update helper uses RETURNING', async () => {
    let statementKinds: string[] = []

    let adapter: DatabaseAdapter = {
      dialect: 'fake',
      capabilities: {
        returning: true,
        savepoints: true,
        upsert: true,
      },
      async execute(request) {
        statementKinds.push(request.statement.kind)

        if (request.statement.kind === 'update') {
          return {
            rows: [
              {
                id: 1,
                email: 'amy@studio.test',
                status: 'inactive',
              },
            ],
            affectedRows: 1,
          }
        }

        throw new Error('unexpected statement kind: ' + request.statement.kind)
      },
      async beginTransaction() {
        return { id: 'tx_1' }
      },
      async commitTransaction() {},
      async rollbackTransaction() {},
      async createSavepoint() {},
      async rollbackToSavepoint() {},
      async releaseSavepoint() {},
    }

    let db = createTestDatabase(adapter)
    let updated = await db.update(accounts, 1, { status: 'inactive' })

    assert.equal(updated.id, 1)
    assert.deepEqual(statementKinds, ['update'])
  })

  it('does not throw on no-op updates for non-RETURNING adapters when row still exists', async () => {
    let statementKinds: string[] = []

    let adapter: DatabaseAdapter = {
      dialect: 'fake',
      capabilities: {
        returning: false,
        savepoints: true,
        upsert: true,
      },
      async execute(request) {
        statementKinds.push(request.statement.kind)

        if (request.statement.kind === 'update') {
          return {
            affectedRows: 0,
          }
        }

        if (request.statement.kind === 'select') {
          return {
            rows: [
              {
                id: 1,
                email: 'amy@studio.test',
                status: 'active',
              },
            ],
          }
        }

        throw new Error('unexpected statement kind: ' + request.statement.kind)
      },
      async beginTransaction() {
        return { id: 'tx_1' }
      },
      async commitTransaction() {},
      async rollbackTransaction() {},
      async createSavepoint() {},
      async rollbackToSavepoint() {},
      async releaseSavepoint() {},
    }

    let db = createTestDatabase(adapter)
    let updated = await db.update(accounts, 1, { status: 'active' })

    assert.equal(updated.id, 1)
    assert.equal(updated.status, 'active')
    assert.deepEqual(statementKinds, ['update', 'select'])
  })

  it('supports database-level updateMany helper', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'inactive' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
        { id: 3, email: 'cory@studio.test', status: 'active' },
      ],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let result = await db.updateMany(
      accounts,
      {
        status: 'archived',
      },
      {
        where: { status: 'inactive' },
        orderBy: ['id', 'asc'],
        limit: 1,
      },
    )

    let rows = await db.query(accounts).orderBy('id', 'asc').all()

    assert.equal(result.affectedRows, 1)
    assert.equal(rows[0].status, 'archived')
    assert.equal(rows[1].status, 'inactive')
    assert.equal(rows[2].status, 'active')
  })

  it('supports database-level delete helper', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let deleted = await db.delete(accounts, 2)
    let deletedMissing = await db.delete(accounts, 999)
    let rows = await db.query(accounts).orderBy('id', 'asc').all()

    assert.equal(deleted, true)
    assert.equal(deletedMissing, false)
    assert.deepEqual(
      rows.map((row) => row.id),
      [1],
    )
  })

  it('supports database-level deleteMany helper', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'inactive' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
        { id: 3, email: 'cory@studio.test', status: 'active' },
      ],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let result = await db.deleteMany(accounts, {
      where: { status: 'inactive' },
      orderBy: ['id', 'asc'],
      limit: 1,
    })

    let rows = await db.query(accounts).orderBy('id', 'asc').all()

    assert.equal(result.affectedRows, 1)
    assert.deepEqual(
      rows.map((row) => row.id),
      [2, 3],
    )
  })

  it('supports database-level create helper returning result metadata by default', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'existing@studio.test', status: 'active' }],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let result = await db.create(accounts, {
      email: 'new@studio.test',
      status: 'active',
    })
    let rows = await db.query(accounts).orderBy('id', 'asc').all()

    assert.equal(result.affectedRows, 1)
    assert.equal(rows.length, 2)
    assert.equal(rows[1].email, 'new@studio.test')
  })

  it('supports database-level create helper returning a loaded row', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [{ id: 100, account_id: 99, name: 'Onboarding', archived: false }],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let created = await db.create(
      accounts,
      {
        id: 99,
        email: 'new@studio.test',
        status: 'active',
      },
      {
        returnRow: true,
        with: { projects: accountProjects.orderBy('id', 'asc') },
      },
    )

    assert.equal(created.id, 99)
    assert.equal(created.email, 'new@studio.test')
    assert.equal(created.projects.length, 1)
    assert.equal(created.projects[0].id, 100)
  })

  it('supports createMany() metadata and rows return modes', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'existing@studio.test', status: 'active' }],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)
    let result = await db.createMany(accounts, [
      { id: 2, email: 'a@studio.test', status: 'active' },
      { id: 3, email: 'b@studio.test', status: 'inactive' },
    ])
    let rows = await db.createMany(
      accounts,
      [{ id: 4, email: 'c@studio.test', status: 'active' }],
      { returnRows: true },
    )

    assert.equal(result.affectedRows, 2)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 4)
    assert.equal(rows[0].email, 'c@studio.test')
  })

  it('throws for createMany() batches with only empty rows', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.createMany(tasks, [{}, {}])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'insertMany() requires at least one explicit value across the batch'
        )
      },
    )
  })

  it('throws for insertMany() batches with only empty rows', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.query(tasks).insertMany([{}])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'insertMany() requires at least one explicit value across the batch'
        )
      },
    )
  })

  it('supports insertMany() batches that include at least one explicit value', async () => {
    let statements: AdapterStatement[] = []

    let adapter: DatabaseAdapter = {
      dialect: 'fake',
      capabilities: {
        returning: true,
        savepoints: true,
        upsert: true,
      },
      async execute(request) {
        statements.push(request.statement)

        if (request.statement.kind === 'insertMany') {
          return {
            affectedRows: request.statement.values.length,
          }
        }

        return {}
      },
      async beginTransaction() {
        return { id: 'tx_1' }
      },
      async commitTransaction() {},
      async rollbackTransaction() {},
      async createSavepoint() {},
      async rollbackToSavepoint() {},
      async releaseSavepoint() {},
    }

    let db = createTestDatabase(adapter)
    let result = await db.query(tasks).insertMany([{}, { title: 'hello world' }])

    assert.equal(result.affectedRows, 2)
    assert.equal(statements.length, 1)
    assert.equal(statements[0].kind, 'insertMany')
  })

  it('throws for createMany({ returnRows: true }) when adapter has no RETURNING support', async () => {
    let adapter = createAdapter(
      {
        accounts: [],
        projects: [],
        tasks: [],
        memberships: [],
      },
      { returning: false },
    )

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.createMany(accounts, [{ id: 1, email: 'a@studio.test', status: 'active' }], {
          returnRows: true,
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'createMany({ returnRows: true }) is not supported by this adapter'
        )
      },
    )
  })

  it('supports join/groupBy/having with count()', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [
        { id: 100, account_id: 1, name: 'Campaign', archived: false },
        { id: 101, account_id: 2, name: 'Legacy', archived: false },
      ],
      profiles: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    let count = await db
      .query(accounts)
      .join(projects, eq('archived', false))
      .groupBy('status')
      .having({ status: 'active' })
      .count()

    assert.equal(count, 1)
  })

  it('supports alias object selection across joined tables', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [{ id: 100, account_id: 1, name: 'Campaign', archived: false }],
      profiles: [],
      tasks: [],
      memberships: [],
    })

    let db = createTestDatabase(adapter)

    let rows = await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .select({
        accountId: 'accounts.id',
        accountEmail: 'accounts.email',
        projectId: 'projects.id',
        projectName: 'projects.name',
      })
      .orderBy('projects.id', 'asc')
      .all()

    assert.deepEqual(rows, [
      {
        accountId: 1,
        accountEmail: 'amy@studio.test',
        projectId: 100,
        projectName: 'Campaign',
      },
    ])
  })

  it('supports count() and exists()', async () => {
    let adapter = createAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    let activeCount = await db.query(accounts).where({ status: 'active' }).count()
    let hasInactive = await db.query(accounts).where({ status: 'inactive' }).exists()
    let hasArchived = await db.query(accounts).where({ status: 'archived' }).exists()

    assert.equal(activeCount, 1)
    assert.equal(hasInactive, true)
    assert.equal(hasArchived, false)
  })

  it('supports eager loading for hasOne and belongsTo', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [{ id: 100, account_id: 1, name: 'Campaign', archived: false }],
      profiles: [{ id: 10, account_id: 1, display_name: 'Amy' }],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    let accountRows = await db.query(accounts).with({ profile: accountProfile }).all()
    let projectRows = await db.query(projects).with({ account: projectAccount }).all()

    assert.equal(accountRows.length, 1)
    assert.equal(accountRows[0].profile?.display_name, 'Amy')
    assert.equal(projectRows.length, 1)
    assert.equal(projectRows[0].account?.email, 'amy@studio.test')
  })

  it('supports cross schema query', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      invoices: [{ id: 100, account_id: 1, total: 1000 }],
    })
    let db = createTestDatabase(adapter)
    let invoiceRows = await db
      .query(invoices)
      .join(accounts, eq(accounts.id, invoices.account_id))
      .select({
        email: accounts.email,
        total: invoices.total,
      })
      .all()

    assert.equal(invoiceRows.length, 1)
    assert.equal(invoiceRows[0].email, 'amy@studio.test')
    assert.equal(invoiceRows[0].total, 1000)
  })
})

describe('writes and validation', () => {
  it('validates values and applies timestamps', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [],
    })
    let createdAt = '2026-01-15T10:00:00.000Z'
    let db = createDatabase(adapter, {
      now() {
        return createdAt
      },
    })

    let insertResult = await db.query(accounts).insert(
      {
        id: 10,
        email: 'ops@studio.test',
        status: 'active',
      },
      { returning: ['id', 'email'] },
    )

    if ('row' in insertResult) {
      assert.equal(insertResult.row?.id, 10)
      assert.equal(insertResult.row?.email, 'ops@studio.test')
    } else {
      assert.fail('Expected row in insert result')
    }

    let savedAccount = await db.query(accounts).find(10)
    assert.ok(savedAccount)
    assert.deepEqual(savedAccount.created_at, createdAt)
    assert.deepEqual(savedAccount.updated_at, createdAt)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .insert({ id: 11, email: 'billing@studio.test', status: 300 as never })
      },
      function (error: unknown) {
        return error instanceof DataTableValidationError
      },
    )
  })

  it('throws for update returning when adapter has no RETURNING support', async () => {
    let adapter = createAdapter(
      {
        accounts: [
          { id: 1, email: 'amy@studio.test', status: 'active' },
          { id: 2, email: 'brad@studio.test', status: 'active' },
        ],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { returning: false },
    )
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async () => {
        await db
          .query(accounts)
          .where({ status: 'active' })
          .orderBy('id', 'asc')
          .limit(1)
          .update({ status: 'inactive' }, { returning: ['id', 'status'] })
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'update() returning is not supported by this adapter',
    )
  })

  it('throws for delete returning when adapter has no RETURNING support', async () => {
    let adapter = createAdapter(
      {
        accounts: [
          { id: 1, email: 'amy@studio.test', status: 'active' },
          { id: 2, email: 'brad@studio.test', status: 'active' },
          { id: 3, email: 'cara@studio.test', status: 'inactive' },
        ],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { returning: false },
    )
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async () => {
        await db
          .query(accounts)
          .where({ status: 'active' })
          .orderBy('id', 'asc')
          .limit(1)
          .delete({ returning: ['id'] })
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'delete() returning is not supported by this adapter',
    )
  })

  it('throws for write returning when adapter has no RETURNING support', async () => {
    let adapter = createAdapter(
      {
        accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { returning: false },
    )

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async () => {
        await db.query(accounts).insert(
          {
            id: 2,
            email: 'finance@studio.test',
            status: 'active',
          },
          { returning: ['id', 'email'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'insert() returning is not supported by this adapter',
    )

    await assert.rejects(
      async () => {
        await db.query(accounts).insertMany(
          [
            { id: 2, email: 'finance@studio.test', status: 'active' },
            { id: 3, email: 'ops@studio.test', status: 'active' },
          ],
          { returning: ['id', 'email'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'insertMany() returning is not supported by this adapter',
    )

    await assert.rejects(
      async () => {
        await db.query(accounts).upsert(
          {
            id: 1,
            email: 'founder@studio.test',
            status: 'inactive',
          },
          { returning: ['id', 'status'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'upsert() returning is not supported by this adapter',
    )
  })

  it('supports insertMany() and delete() returning with RETURNING adapters', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    let inserted = await db.query(accounts).insertMany(
      [
        { id: 1, email: 'a@studio.test', status: 'active' },
        { id: 2, email: 'b@studio.test', status: 'active' },
      ],
      { returning: ['id', 'email'] },
    )
    assert.ok('rows' in inserted)

    let deleted = await db
      .query(accounts)
      .where({ id: 2 })
      .delete({ returning: ['id'] })
    assert.ok('rows' in deleted)
    if ('rows' in deleted) {
      assert.equal(deleted.rows.length, 1)
      assert.equal(deleted.rows[0].id, 2)
    }
  })

  it('supports upsert() and conflictTarget', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'a@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    let result = await db
      .query(accounts)
      .upsert(
        { id: 1, email: 'a@studio.test', status: 'inactive' },
        { conflictTarget: ['id'], returning: ['id', 'status'] },
      )

    assert.ok('row' in result)
    if ('row' in result) {
      assert.equal(result.row?.status, 'inactive')
    }
  })

  it('throws for upsert() when adapter does not support it', async () => {
    let adapter = createAdapter(
      {
        accounts: [],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { upsert: false },
    )
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .upsert({ id: 1, email: 'a@studio.test', status: 'active' }, { conflictTarget: ['id'] })
      },
      function (error: unknown) {
        return error instanceof DataTableQueryError
      },
    )
  })

  it('throws when read-only query modifiers are used with write terminals', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'a@studio.test', status: 'active' }],
      projects: [{ id: 10, account_id: 1, name: 'Alpha', archived: false }],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .join(projects, eq('accounts.id', 'projects.account_id'))
          .update({ status: 'inactive' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('update() does not support these query modifiers: join()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db.query(accounts).groupBy('status').delete()
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('delete() does not support these query modifiers: groupBy()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .with({ projects: accountProjects })
          .upsert({ id: 1, email: 'a@studio.test', status: 'active' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('upsert() does not support these query modifiers: with()')
        )
      },
    )
  })

  it('throws when scoped query modifiers are used with insert-like terminals', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'a@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.query(accounts).where({ id: 1 }).insert({
          id: 2,
          email: 'b@studio.test',
          status: 'active',
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('insert() does not support these query modifiers: where()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .orderBy('id', 'asc')
          .insertMany([{ id: 3, email: 'c@studio.test', status: 'active' }])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('insertMany() does not support these query modifiers: orderBy()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db.query(accounts).limit(1).upsert({
          id: 1,
          email: 'a@studio.test',
          status: 'inactive',
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('upsert() does not support these query modifiers: limit()')
        )
      },
    )
  })

  it('validates filter values against column schemas at runtime', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'a@studio.test', status: 'active' }],
      projects: [{ id: 100, account_id: 1, name: 'Alpha', archived: false }],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .where({ id: 'not-a-number' as never })
          .all()
      },
      function (error: unknown) {
        return (
          error instanceof DataTableValidationError &&
          error.message.includes('Invalid filter value for column "id" in table "accounts"')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .join(projects, eq('projects.archived', 'nope' as never))
          .all()
      },
      function (error: unknown) {
        return (
          error instanceof DataTableValidationError &&
          error.message.includes('Invalid filter value for column "archived" in table "projects"')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .groupBy('status')
          .having(eq('status', 123 as never))
          .count()
      },
      function (error: unknown) {
        return (
          error instanceof DataTableValidationError &&
          error.message.includes('Invalid filter value for column "status" in table "accounts"')
        )
      },
    )
  })
})

describe('transactions and raw sql', () => {
  it('supports nested transactions using savepoints', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await db.transaction(async (outerTransaction) => {
      await outerTransaction
        .query(accounts)
        .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

      await outerTransaction
        .transaction(async (innerTransaction) => {
          await innerTransaction
            .query(accounts)
            .insert({ id: 3, email: 'design@studio.test', status: 'active' })

          throw new Error('Abort inner transaction')
        })
        .catch(() => undefined)
    })

    let rows = await db.query(accounts).orderBy('id', 'asc').all()

    assert.equal(rows.length, 2)
    assert.equal(rows[1].email, 'pm@studio.test')
    assert.deepEqual(
      rows.map((row) => row.id),
      [1, 2],
    )
  })

  it('treats transaction options as best-effort adapter hints', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await db.transaction(
      async (transactionDatabase) => {
        await transactionDatabase
          .query(accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })
      },
      {
        isolationLevel: 'serializable',
        readOnly: true,
      },
    )

    let rows = await db.query(accounts).orderBy('id', 'asc').all()
    assert.equal(rows.length, 2)
    assert.equal(rows[0].id, 1)
    assert.equal(rows[0].email, 'founder@studio.test')
    assert.equal(rows[1].id, 2)
    assert.equal(rows[1].email, 'pm@studio.test')
    assert.equal(rows[1].status, 'active')
  })

  it('routes raw sql through db.exec', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 42, email: 'raw@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    let result = await db.exec(sql`select * from accounts where id = ${42}`)
    assert.ok(result.rows)
    assert.equal(result.rows?.length, 1)
    assert.equal(result.rows?.[0].id, 42)
  })

  it('rolls back outer transactions on errors', async () => {
    let adapter = createAdapter({
      accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createTestDatabase(adapter)

    await db
      .transaction(async (transactionDatabase) => {
        await transactionDatabase
          .query(accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

        throw new Error('Abort transaction')
      })
      .catch(() => undefined)

    let rows = await db.query(accounts).orderBy('id', 'asc').all()
    assert.deepEqual(
      rows.map((row) => ({ id: row.id, email: row.email, status: row.status })),
      [{ id: 1, email: 'founder@studio.test', status: 'active' }],
    )
  })

  it('throws for nested transactions without savepoints', async () => {
    let adapter = createAdapter(
      {
        accounts: [],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { savepoints: false },
    )

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.transaction(async (transactionDatabase) => {
          await transactionDatabase.transaction(async () => undefined)
        })
      },
      function (error: unknown) {
        return error instanceof DataTableQueryError
      },
    )
  })
})

describe('adapter errors', () => {
  it('wraps adapter failures in DataTableAdapterError', async () => {
    let tokens = 0

    let adapter: DatabaseAdapter = {
      dialect: 'failing',
      capabilities: {
        returning: true,
        savepoints: true,
        upsert: true,
      },
      async execute() {
        throw new Error('boom')
      },
      async beginTransaction() {
        tokens += 1
        return { id: 'tx_' + String(tokens) }
      },
      async commitTransaction() {},
      async rollbackTransaction() {},
      async createSavepoint() {},
      async rollbackToSavepoint() {},
      async releaseSavepoint() {},
    }

    let db = createTestDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.query(accounts).all()
      },
      function (error: unknown) {
        if (!(error instanceof DataTableAdapterError)) {
          return false
        }

        return (
          error.metadata?.dialect === 'failing' &&
          error.metadata?.statementKind === 'select' &&
          error.cause instanceof Error &&
          error.cause.message === 'boom'
        )
      },
    )
  })
})

function createAdapter(
  seed: SqliteTestSeed = {},
  options?: SqliteTestAdapterOptions,
): DatabaseAdapter {
  let { adapter, close } = createSqliteTestAdapter(seed, options)
  cleanups.add(close)
  return adapter
}

function createTestDatabase(adapter: DatabaseAdapter) {
  return createDatabase(adapter, {
    now() {
      return '2026-01-01T00:00:00.000Z'
    },
  })
}
