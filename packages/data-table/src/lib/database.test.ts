import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'

import type { DatabaseAdapter } from './adapter.ts'
import { createDatabase } from './database.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import { createTable, timestamps } from './table.ts'
import { eq } from './operators.ts'
import { sql } from './sql.ts'
import type { SqliteTestAdapterOptions, SqliteTestSeed } from '../../test/sqlite-test-database.ts'
import { createSqliteTestAdapter } from '../../test/sqlite-test-database.ts'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
    ...timestamps(),
  },
  timestamps: true,
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

let Profiles = createTable({
  name: 'profiles',
  columns: {
    id: number(),
    account_id: number(),
    display_name: string(),
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

let Memberships = createTable({
  name: 'memberships',
  primaryKey: ['organization_id', 'account_id'],
  columns: {
    organization_id: number(),
    account_id: number(),
    role: string(),
  },
})

let AccountProjects = Accounts.hasMany(Projects)
let AccountProfile = Accounts.hasOne(Profiles)
let ProjectAccount = Projects.belongsTo(Accounts)
let AccountTasks = Accounts.hasManyThrough(Tasks, {
  through: AccountProjects,
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
    let archivedExcludedProjects = AccountProjects.where({ archived: false }).orderBy('id', 'asc')

    let allAccountsQuery = db.query(Accounts)
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
    let openTasks = AccountTasks.where({ state: 'open' }).orderBy('id', 'asc')

    let accounts = await db.query(Accounts).orderBy('id', 'asc').with({ tasks: openTasks }).all()

    assert.equal(accounts[0].tasks.length, 2)
    assert.equal(accounts[0].tasks[0].title, 'Define Ad Sets')
    assert.equal(accounts[0].tasks[1].title, 'Draft Landing Page')
    assert.equal(accounts[1].tasks.length, 1)
    assert.equal(accounts[1].tasks[0].title, 'Collect Testimonials')
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
      .query(Accounts)
      .orderBy('id', 'asc')
      .with({
        projects: AccountProjects.orderBy('id', 'asc').limit(1),
      })
      .all()

    assert.equal(firstProjectPerAccount[0].projects.length, 1)
    assert.equal(firstProjectPerAccount[0].projects[0].id, 100)
    assert.equal(firstProjectPerAccount[1].projects.length, 1)
    assert.equal(firstProjectPerAccount[1].projects[0].id, 200)

    let secondProjectPerAccount = await db
      .query(Accounts)
      .orderBy('id', 'asc')
      .with({
        projects: AccountProjects.orderBy('id', 'asc').offset(1).limit(1),
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
      .query(Accounts)
      .orderBy('id', 'asc')
      .with({
        tasks: AccountTasks.orderBy('id', 'asc').limit(1),
      })
      .all()

    assert.equal(firstTaskPerAccount[0].tasks.length, 1)
    assert.equal(firstTaskPerAccount[0].tasks[0].id, 1000)
    assert.equal(firstTaskPerAccount[1].tasks.length, 1)
    assert.equal(firstTaskPerAccount[1].tasks[0].id, 2000)

    let secondTaskPerAccount = await db
      .query(Accounts)
      .orderBy('id', 'asc')
      .with({
        tasks: AccountTasks.orderBy('id', 'asc').offset(1).limit(1),
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
    let firstProjectPerAccount = AccountProjects.orderBy('id', 'asc').limit(1)
    let tasksThroughFirstProject = Accounts.hasManyThrough(Tasks, {
      through: firstProjectPerAccount,
    }).orderBy('id', 'asc')

    let accounts = await db.query(Accounts).orderBy('id', 'asc').with({ tasks: tasksThroughFirstProject }).all()

    assert.equal(accounts[0].tasks.length, 1)
    assert.equal(accounts[0].tasks[0].id, 1000)
    assert.equal(accounts[1].tasks.length, 1)
    assert.equal(accounts[1].tasks[0].id, 2000)
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
    let membership = await db.query(Memberships).find({ organization_id: 9, account_id: 2 })

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
    let openProjects = AccountProjects.where({ archived: false }).orderBy('id', 'asc')

    let account = await db.find(Accounts, 1)
    let activeAccount = await db.findOne(Accounts, {
      where: { status: 'active' },
      orderBy: ['id', 'asc'],
    })
    let activeAccounts = await db.findMany(Accounts, {
      where: { status: 'active' },
      orderBy: [
        ['status', 'asc'],
        ['id', 'asc'],
      ],
      limit: 1,
    })
    let accountsWithProjects = await db.findMany(Accounts, {
      orderBy: ['id', 'asc'],
      with: { projects: openProjects },
    })

    assert.equal(account?.email, 'amy@studio.test')
    assert.equal(activeAccount?.id, 1)
    assert.equal(activeAccounts.length, 1)
    assert.equal(activeAccounts[0].id, 1)
    assert.equal(accountsWithProjects[0].projects.length, 1)
    assert.equal(accountsWithProjects[0].projects[0].id, 100)
    assert.equal(accountsWithProjects[1].projects.length, 1)
    assert.equal(accountsWithProjects[1].projects[0].id, 102)
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
    let openProjects = AccountProjects.where({ archived: false }).orderBy('id', 'asc')

    let updated = await db.update(
      Accounts,
      1,
      {
        status: 'inactive',
      },
      { with: { projects: openProjects } },
    )
    let missing = await db.update(Accounts, 999, { status: 'active' })

    assert.equal(updated?.status, 'inactive')
    assert.equal(updated?.projects.length, 1)
    assert.equal(updated?.projects[0].id, 100)
    assert.equal(missing, null)
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
      Accounts,
      {
        status: 'archived',
      },
      {
        where: { status: 'inactive' },
        orderBy: ['id', 'asc'],
        limit: 1,
      },
    )

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

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
    let deleted = await db.delete(Accounts, 2)
    let deletedMissing = await db.delete(Accounts, 999)
    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

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
    let result = await db.deleteMany(Accounts, {
      where: { status: 'inactive' },
      orderBy: ['id', 'asc'],
      limit: 1,
    })

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

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
    let result = await db.create(Accounts, {
      email: 'new@studio.test',
      status: 'active',
    })
    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

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
      Accounts,
      {
        id: 99,
        email: 'new@studio.test',
        status: 'active',
      },
      {
        returnRow: true,
        with: { projects: AccountProjects.orderBy('id', 'asc') },
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
    let result = await db.createMany(Accounts, [
      { id: 2, email: 'a@studio.test', status: 'active' },
      { id: 3, email: 'b@studio.test', status: 'inactive' },
    ])
    let rows = await db.createMany(
      Accounts,
      [{ id: 4, email: 'c@studio.test', status: 'active' }],
      { returnRows: true },
    )

    assert.equal(result.affectedRows, 2)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 4)
    assert.equal(rows[0].email, 'c@studio.test')
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
        await db.createMany(
          Accounts,
          [{ id: 1, email: 'a@studio.test', status: 'active' }],
          { returnRows: true },
        )
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
      .query(Accounts)
      .join(Projects, eq('archived', false))
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
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
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

    let activeCount = await db.query(Accounts).where({ status: 'active' }).count()
    let hasInactive = await db.query(Accounts).where({ status: 'inactive' }).exists()
    let hasArchived = await db.query(Accounts).where({ status: 'archived' }).exists()

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

    let accounts = await db.query(Accounts).with({ profile: AccountProfile }).all()
    let projects = await db.query(Projects).with({ account: ProjectAccount }).all()

    assert.equal(accounts.length, 1)
    assert.equal(accounts[0].profile?.display_name, 'Amy')
    assert.equal(projects.length, 1)
    assert.equal(projects[0].account?.email, 'amy@studio.test')
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

    let insertResult = await db.query(Accounts).insert(
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

    let savedAccount = await db.query(Accounts).find(10)
    assert.ok(savedAccount)
    assert.deepEqual(savedAccount.created_at, createdAt)
    assert.deepEqual(savedAccount.updated_at, createdAt)

    await assert.rejects(
      async function () {
        await db
          .query(Accounts)
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
          .query(Accounts)
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
          .query(Accounts)
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
        await db.query(Accounts).insert(
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
        await db.query(Accounts).insertMany(
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
        await db.query(Accounts).upsert(
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

    let inserted = await db.query(Accounts).insertMany(
      [
        { id: 1, email: 'a@studio.test', status: 'active' },
        { id: 2, email: 'b@studio.test', status: 'active' },
      ],
      { returning: ['id', 'email'] },
    )
    assert.ok('rows' in inserted)

    let deleted = await db.query(Accounts).where({ id: 2 }).delete({ returning: ['id'] })
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

    let result = await db.query(Accounts).upsert(
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
          .query(Accounts)
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
          .query(Accounts)
          .join(Projects, eq('accounts.id', 'projects.account_id'))
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
        await db.query(Accounts).groupBy('status').delete()
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
          .query(Accounts)
          .with({ projects: AccountProjects })
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
        await db.query(Accounts).where({ id: 1 }).insert({
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
          .query(Accounts)
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
        await db.query(Accounts).limit(1).upsert({
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
        await db.query(Accounts).where({ id: 'not-a-number' as never }).all()
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
          .query(Accounts)
          .join(Projects, eq('projects.archived', 'nope' as never))
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
        await db.query(Accounts).groupBy('status').having(eq('status', 123 as never)).count()
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
        .query(Accounts)
        .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

      await outerTransaction
        .transaction(async (innerTransaction) => {
          await innerTransaction
            .query(Accounts)
            .insert({ id: 3, email: 'design@studio.test', status: 'active' })

          throw new Error('Abort inner transaction')
        })
        .catch(() => undefined)
    })

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()

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
          .query(Accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })
      },
      {
        isolationLevel: 'serializable',
        readOnly: true,
      },
    )

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()
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
          .query(Accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

        throw new Error('Abort transaction')
      })
      .catch(() => undefined)

    let rows = await db.query(Accounts).orderBy('id', 'asc').all()
    assert.deepEqual(
      rows.map((row) => ({ id: row.id, email: row.email, status: row.status })),
      [{ id: 1, email: 'founder@studio.test', status: 'active' }],
    )
  })

  it('throws for nested transactions without savepoints', async () => {
    let adapter = createAdapter({
      accounts: [],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    }, { savepoints: false })

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
        await db.query(Accounts).all()
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

function createAdapter(seed: SqliteTestSeed = {}, options?: SqliteTestAdapterOptions): DatabaseAdapter {
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
