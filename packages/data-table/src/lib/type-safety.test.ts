import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'

import { createDatabase } from './database.ts'
import type { QueryBuilder, QueryColumnTypesForTable, QueryForTable, WriteResult } from './database.ts'
import { createTable } from './table.ts'
import type { TableReference } from './table.ts'
import { eq } from './operators.ts'
import type { SqliteTestSeed } from '../../test/sqlite-test-database.ts'
import { createSqliteTestAdapter } from '../../test/sqlite-test-database.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectType<condition extends true>(): void {}

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

let AccountProjects = Accounts.hasMany(Projects)

let cleanups = new Set<() => void>()

afterEach(() => {
  for (let cleanup of cleanups) {
    cleanup()
  }

  cleanups.clear()
})

describe('type safety', () => {
  it('exposes query builder generics as column and row output maps', () => {
    let db = createDatabase(createAdapter())
    let query = db.query(Accounts)

    type Query = typeof query
    type QueryColumns =
      Query extends QueryBuilder<infer columnTypes, any, any, any, any> ? columnTypes : never
    type QueryRow = Query extends QueryBuilder<any, infer row, any, any, any> ? row : never
    type QueryTableName = Query extends QueryBuilder<any, any, any, infer name, any> ? name : never
    type QueryPrimaryKey = Query extends QueryBuilder<any, any, any, any, infer key> ? key : never
    type QueryFromTableAlias = QueryForTable<typeof Accounts>
    type QueryColumnsFromAlias = QueryColumnTypesForTable<typeof Accounts>
    type AccountsReference = TableReference<typeof Accounts>
    type AccountsReferenceColumns = keyof AccountsReference['columns'] & string

    type ExpectedColumns = {
      id: number
      email: string
      status: string
      'accounts.id': number
      'accounts.email': string
      'accounts.status': string
    }
    type ExpectedRow = {
      id: number
      email: string
      status: string
    }

    expectType<Equal<QueryColumns, ExpectedColumns>>()
    expectType<Equal<QueryRow, ExpectedRow>>()
    expectType<Equal<QueryTableName, 'accounts'>>()
    expectType<Equal<QueryPrimaryKey, readonly ['id']>>()
    expectType<Equal<Query, QueryFromTableAlias>>()
    expectType<Equal<QueryColumns, QueryColumnsFromAlias>>()
    expectType<Equal<AccountsReference['kind'], 'table'>>()
    expectType<Equal<AccountsReference['name'], 'accounts'>>()
    expectType<Equal<AccountsReference['primaryKey'], readonly ['id']>>()
    expectType<Equal<AccountsReferenceColumns, 'email' | 'id' | 'status'>>()
  })

  it('narrows select() result types while preserving relation types', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [
          { id: 100, account_id: 1, archived: false },
          { id: 101, account_id: 3, archived: false },
        ],
      }),
    )

    let rows = await db.query(Accounts).select('id').with({ projects: AccountProjects }).all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 1)
    assert.equal(rows[0].projects.length, 1)
    assert.equal(Boolean(rows[0].projects[0].archived), false)
    assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'projects'])

    type Row = (typeof rows)[number]
    expectType<Equal<Row['id'], number>>()
    expectType<Equal<Row['projects'][number]['id'], number>>()
    expectType<Equal<Row['projects'][number]['account_id'], number>>()
    expectType<Equal<Row['projects'][number]['archived'], boolean>>()

    // @ts-expect-error select('id') should not expose non-selected account columns
    rows[0].email
  })

  it('supports typed alias select() and joined order/group columns', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [
          { id: 100, account_id: 1, archived: false },
          { id: 101, account_id: 3, archived: false },
        ],
      }),
    )

    let rows = await db
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
      .select({
        accountId: 'accounts.id',
        accountEmail: 'accounts.email',
        projectId: 'projects.id',
        projectArchived: 'projects.archived',
      })
      .orderBy('projects.id', 'asc')
      .all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].accountId, 1)
    assert.equal(rows[0].accountEmail, 'a@example.com')
    assert.equal(rows[0].projectId, 100)
    assert.equal(Boolean(rows[0].projectArchived), false)

    let groupedCount = await db
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
      .groupBy('projects.account_id')
      .having(eq('projects.account_id', 1))
      .count()

    assert.equal(groupedCount, 1)

    type Row = (typeof rows)[number]
    expectType<Equal<Row['accountId'], number>>()
    expectType<Equal<Row['accountEmail'], string>>()
    expectType<Equal<Row['projectId'], number>>()
    expectType<Equal<Row['projectArchived'], boolean>>()

    // @ts-expect-error alias select should not expose original source column names
    rows[0].email

    function verifyTypeErrors(): void {
      db.query(Accounts)
        .join(Projects, eq('accounts.id', 'projects.account_id'))
        // @ts-expect-error unknown joined column for orderBy
        .orderBy('projects.nope')
      db.query(Accounts)
        .join(Projects, eq('accounts.id', 'projects.account_id'))
        // @ts-expect-error unknown joined column for groupBy
        .groupBy('projects.nope')
      db.query(Accounts)
        .join(Projects, eq('accounts.id', 'projects.account_id'))
        // @ts-expect-error unknown source column in alias selection
        .select({ bad: 'projects.nope' })
    }

    void verifyTypeErrors
  })

  it('enforces typed keys for where/having/join/relation filters while running real queries', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [{ id: 100, account_id: 1, archived: false }],
      }),
    )

    let filtered = await db.query(Accounts).where({ status: 'active' }).all()
    let groupedCount = await db
      .query(Accounts)
      .groupBy('status')
      .having({ status: 'active' })
      .count()
    let joined = await db
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('projects.archived', false))
      .all()
    let withRelations = await db
      .query(Accounts)
      .with({ projects: AccountProjects.where({ archived: false }) })
      .all()

    assert.equal(filtered.length, 1)
    assert.equal(groupedCount, 1)
    assert.equal(joined.length, 1)
    assert.equal(withRelations[0].projects.length, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown predicate key
      db.query(Accounts).where({ not_a_column: 'active' })
      // @ts-expect-error unknown predicate key
      db.query(Accounts).having({ not_a_column: 'active' })
      // @ts-expect-error join predicate key must be from source or target table
      db.query(Accounts).join(Projects, eq('not_a_column', true))
      // @ts-expect-error right-hand column reference must be from source or target table
      db.query(Accounts).join(Projects, eq('accounts.id', 'projects.not_a_column'))
      // @ts-expect-error relation predicate key must be from relation target table
      AccountProjects.where({ not_a_column: true })
    }

    void verifyTypeErrors
  })

  it('keeps findOne/findMany where and orderBy typing symmetric for single-table queries', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [{ id: 100, account_id: 1, archived: false }],
      }),
    )

    let first = await db.find(Accounts, 1)
    let active = await db.findOne(Accounts, {
      where: { status: 'active' },
      orderBy: ['accounts.id', 'asc'],
    })
    let rows = await db.findMany(Accounts, {
      where: eq('status', 'active'),
      orderBy: [
        ['status', 'asc'],
        ['id', 'desc'],
      ],
      with: { projects: AccountProjects },
    })

    assert.equal(first?.id, 1)
    assert.equal(active?.email, 'a@example.com')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].projects.length, 1)

    type Row = (typeof rows)[number]
    expectType<Equal<Row['projects'][number]['id'], number>>()
    expectType<Equal<Row['projects'][number]['account_id'], number>>()
    expectType<Equal<Row['projects'][number]['archived'], boolean>>()

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown where key
      db.findOne(Accounts, { where: { not_a_column: 'active' } })
      // @ts-expect-error unknown orderBy column
      db.findMany(Accounts, { orderBy: ['not_a_column', 'asc'] })
      // @ts-expect-error unknown orderBy column in tuple list
      db.findMany(Accounts, { orderBy: [['id', 'asc'], ['not_a_column', 'desc']] })
    }

    void verifyTypeErrors
  })

  it('keeps update/delete helper typing symmetric for single-table queries', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [
          { id: 1, email: 'a@example.com', status: 'active' },
          { id: 2, email: 'b@example.com', status: 'inactive' },
        ],
        projects: [{ id: 100, account_id: 1, archived: false }],
      }),
    )

    let updated = await db.update(
      Accounts,
      1,
      { status: 'inactive' },
      { with: { projects: AccountProjects } },
    )
    let updateManyResult = await db.updateMany(
      Accounts,
      { status: 'active' },
      {
        where: { status: 'inactive' },
        orderBy: ['id', 'asc'],
        limit: 1,
      },
    )
    let deleted = await db.delete(Accounts, 2)
    let deleteManyResult = await db.deleteMany(Accounts, {
      where: eq('status', 'active'),
      orderBy: [['id', 'desc']],
      limit: 1,
    })

    assert.equal(updated?.id, 1)
    assert.equal(updated?.projects.length, 1)
    assert.equal(updateManyResult.affectedRows, 1)
    assert.equal(deleted, true)
    assert.equal(deleteManyResult.affectedRows, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown update key
      db.update(Accounts, 1, { not_a_column: 'x' })
      // @ts-expect-error unknown where key
      db.updateMany(Accounts, { status: 'active' }, { where: { not_a_column: 'x' } })
      // @ts-expect-error unknown orderBy key
      db.updateMany(Accounts, { status: 'active' }, { where: { status: 'active' }, orderBy: ['nope', 'asc'] })
      // @ts-expect-error unknown where key
      db.deleteMany(Accounts, { where: { not_a_column: 'x' } })
      // @ts-expect-error unknown orderBy key
      db.deleteMany(Accounts, { where: { status: 'active' }, orderBy: [['nope', 'asc']] })
    }

    void verifyTypeErrors
  })

  it('supports typed create/createMany helper return modes', async () => {
    let db = createDatabase(
      createAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [
          { id: 100, account_id: 1, archived: false },
          { id: 101, account_id: 3, archived: false },
        ],
      }),
    )

    let createResult = await db.create(Accounts, {
      id: 2,
      email: 'b@example.com',
      status: 'active',
    })
    let created = await db.create(
      Accounts,
      {
        id: 3,
        email: 'c@example.com',
        status: 'inactive',
      },
      {
        returnRow: true,
        with: { projects: AccountProjects },
      },
    )
    let createManyResult = await db.createMany(Accounts, [
      { id: 4, email: 'd@example.com', status: 'active' },
      { id: 5, email: 'e@example.com', status: 'inactive' },
    ])
    let createdRows = await db.createMany(
      Accounts,
      [{ id: 6, email: 'f@example.com', status: 'active' }],
      { returnRows: true },
    )

    expectType<Equal<typeof createResult, WriteResult>>()
    expectType<Equal<typeof createManyResult, WriteResult>>()
    expectType<Equal<typeof created['id'], number>>()
    expectType<Equal<typeof created['projects'][number]['id'], number>>()
    expectType<Equal<(typeof createdRows)[number]['id'], number>>()
    expectType<Equal<(typeof createdRows)[number]['email'], string>>()

    assert.equal(createResult.affectedRows, 1)
    assert.equal(created.id, 3)
    assert.equal(created.projects.length, 1)
    assert.equal(createManyResult.affectedRows, 2)
    assert.equal(createdRows.length, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown insert key
      db.create(Accounts, { not_a_column: 'x' })
      db.create(
        Accounts,
        { id: 7, email: 'g@example.com', status: 'active' },
        // @ts-expect-error with is only supported when returnRow: true
        { with: { projects: AccountProjects } },
      )
      // @ts-expect-error unknown createMany insert key
      db.createMany(Accounts, [{ not_a_column: 'x' }])
      db.createMany(
        Accounts,
        [{ id: 8, email: 'h@example.com', status: 'active' }],
        // @ts-expect-error invalid createMany option key
        { returnRow: true },
      )
    }

    void verifyTypeErrors
  })
})

function createAdapter(seed: SqliteTestSeed = {}) {
  let { adapter, close } = createSqliteTestAdapter(seed)
  cleanups.add(close)
  return adapter
}
