import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'

import type { DatabaseAdapter } from './adapter.ts'
import { createDatabase } from './database.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import { MemoryDatabaseAdapter } from './memory-adapter.ts'
import { createTable, timestamps } from './model.ts'
import { eq } from './operators.ts'
import { sql } from './sql.ts'

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

describe('query builder', () => {
  it('is immutable and supports eager hasMany loading', async () => {
    let adapter = new MemoryDatabaseAdapter({
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

    let db = createDatabase(adapter)
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
    let adapter = new MemoryDatabaseAdapter({
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

    let db = createDatabase(adapter)
    let openTasks = AccountTasks.where({ state: 'open' }).orderBy('id', 'asc')

    let accounts = await db.query(Accounts).orderBy('id', 'asc').with({ tasks: openTasks }).all()

    assert.equal(accounts[0].tasks.length, 2)
    assert.equal(accounts[0].tasks[0].title, 'Define Ad Sets')
    assert.equal(accounts[0].tasks[1].title, 'Draft Landing Page')
    assert.equal(accounts[1].tasks.length, 1)
    assert.equal(accounts[1].tasks[0].title, 'Collect Testimonials')
  })

  it('supports composite primary keys in find()', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [
        { organization_id: 9, account_id: 1, role: 'owner' },
        { organization_id: 9, account_id: 2, role: 'member' },
      ],
    })

    let db = createDatabase(adapter)
    let membership = await db.query(Memberships).find({ organization_id: 9, account_id: 2 })

    assert.ok(membership)
    assert.equal(membership.role, 'member')
  })

  it('passes join/groupBy/having to adapter statements', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [{ id: 100, account_id: 1, name: 'Campaign', archived: false }],
      profiles: [],
      tasks: [],
      memberships: [],
    })

    let db = createDatabase(adapter)

    await db
      .query(Accounts)
      .join(Projects, eq('archived', false))
      .groupBy('status')
      .having({ status: 'active' })
      .count()

    let request = adapter.statements[0]
    assert.equal(request.statement.kind, 'count')

    if (request.statement.kind === 'count') {
      assert.equal(request.statement.joins.length, 1)
      assert.deepEqual(request.statement.groupBy, ['status'])
      assert.equal(request.statement.having.length, 1)
    }
  })

  it('supports count() and exists()', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [
        { id: 1, email: 'amy@studio.test', status: 'active' },
        { id: 2, email: 'brad@studio.test', status: 'inactive' },
      ],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

    let activeCount = await db.query(Accounts).where({ status: 'active' }).count()
    let hasInactive = await db.query(Accounts).where({ status: 'inactive' }).exists()
    let hasArchived = await db.query(Accounts).where({ status: 'archived' }).exists()

    assert.equal(activeCount, 1)
    assert.equal(hasInactive, true)
    assert.equal(hasArchived, false)
  })

  it('supports eager loading for hasOne and belongsTo', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'amy@studio.test', status: 'active' }],
      projects: [{ id: 100, account_id: 1, name: 'Campaign', archived: false }],
      profiles: [{ id: 10, account_id: 1, display_name: 'Amy' }],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

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
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [],
      tasks: [],
      memberships: [],
    })
    let createdAt = new Date('2026-01-15T10:00:00.000Z')
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

    let savedAccount = adapter.snapshot('accounts')[0]
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

  it('scopes fallback update returning to ordered/limited rows', async () => {
    let adapter = new MemoryDatabaseAdapter(
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
    let db = createDatabase(adapter)

    let result = await db
      .query(Accounts)
      .where({ status: 'active' })
      .orderBy('id', 'asc')
      .limit(1)
      .update({ status: 'inactive' }, { returning: ['id', 'status'] })

    assert.ok('rows' in result)
    if ('rows' in result) {
      assert.equal(result.rows.length, 1)
      assert.equal(result.rows[0].id, 1)
      assert.equal(result.rows[0].status, 'inactive')
    }

    let rows = adapter.snapshot('accounts')
    assert.equal(rows.length, 2)
    assert.equal(rows[0].id, 1)
    assert.equal(rows[0].status, 'inactive')
    assert.ok(rows[0].updated_at instanceof Date)
    assert.equal(rows[1].id, 2)
    assert.equal(rows[1].status, 'active')
  })

  it('scopes fallback delete returning to ordered/limited rows', async () => {
    let adapter = new MemoryDatabaseAdapter(
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
    let db = createDatabase(adapter)

    let result = await db
      .query(Accounts)
      .where({ status: 'active' })
      .orderBy('id', 'asc')
      .limit(1)
      .delete({ returning: ['id'] })

    assert.ok('rows' in result)
    if ('rows' in result) {
      assert.equal(result.rows.length, 1)
      assert.equal(result.rows[0].id, 1)
    }

    assert.deepEqual(adapter.snapshot('accounts'), [
      { id: 2, email: 'brad@studio.test', status: 'active' },
      { id: 3, email: 'cara@studio.test', status: 'inactive' },
    ])
  })

  it('uses returning fallback queries when adapter has no RETURNING support', async () => {
    let adapter = new MemoryDatabaseAdapter(
      {
        accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { returning: false },
    )

    let db = createDatabase(adapter)
    let insertResult = await db.query(Accounts).insert(
      {
        id: 2,
        email: 'finance@studio.test',
        status: 'active',
      },
      { returning: ['id', 'email'] },
    )

    assert.ok('row' in insertResult)
    if ('row' in insertResult) {
      assert.equal(insertResult.row?.id, 2)
      assert.equal(insertResult.row?.email, 'finance@studio.test')
    }

    let updateResult = await db
      .query(Accounts)
      .where({ id: 2 })
      .update({ status: 'inactive' }, { returning: ['id', 'status'] })

    assert.ok('rows' in updateResult)
    if ('rows' in updateResult) {
      assert.equal(updateResult.rows.length, 1)
      assert.equal(updateResult.rows[0].status, 'inactive')
    }
  })

  it('supports insertMany() and delete() returning with RETURNING adapters', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

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
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'a@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

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
    let adapter = new MemoryDatabaseAdapter(
      {
        accounts: [],
        projects: [],
        profiles: [],
        tasks: [],
        memberships: [],
      },
      { upsert: false },
    )
    let db = createDatabase(adapter)

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
})

describe('transactions and raw sql', () => {
  it('supports nested transactions using savepoints', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

    await db.transaction(async function (outerTransaction) {
      await outerTransaction
        .query(Accounts)
        .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

      await outerTransaction
        .transaction(async function (innerTransaction) {
          await innerTransaction
            .query(Accounts)
            .insert({ id: 3, email: 'design@studio.test', status: 'active' })

          throw new Error('Abort inner transaction')
        })
        .catch(function swallow() {
          return undefined
        })
    })

    let rows = adapter.snapshot('accounts')

    assert.equal(rows.length, 2)
    assert.equal(rows[1].email, 'pm@studio.test')
    assert.deepEqual(adapter.events, [
      'begin:tx_1',
      'savepoint:tx_1:sp_0',
      'rollback-to-savepoint:tx_1:sp_0',
      'release-savepoint:tx_1:sp_0',
      'commit:tx_1',
    ])
  })

  it('routes raw sql through db.exec', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

    await db.exec(sql`select * from accounts where id = ${42}`)

    let request = adapter.statements[0]

    assert.equal(request.statement.kind, 'raw')

    if (request.statement.kind === 'raw') {
      assert.equal(request.statement.sql.text, 'select * from accounts where id = ?')
      assert.deepEqual(request.statement.sql.values, [42])
    }
  })

  it('rolls back outer transactions on errors', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'founder@studio.test', status: 'active' }],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    let db = createDatabase(adapter)

    await db
      .transaction(async function (transactionDatabase) {
        await transactionDatabase
          .query(Accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })

        throw new Error('Abort transaction')
      })
      .catch(function swallow() {
        return undefined
      })

    assert.deepEqual(adapter.snapshot('accounts'), [
      { id: 1, email: 'founder@studio.test', status: 'active' },
    ])
    assert.deepEqual(adapter.events, ['begin:tx_1', 'rollback:tx_1'])
  })

  it('throws for nested transactions without savepoints', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [],
      projects: [],
      profiles: [],
      tasks: [],
      memberships: [],
    })
    adapter.capabilities.savepoints = false

    let db = createDatabase(adapter)

    await assert.rejects(
      async function () {
        await db.transaction(async function (transactionDatabase) {
          await transactionDatabase.transaction(async function noop() {
            return undefined
          })
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
        ilike: true,
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

    let db = createDatabase(adapter)

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
