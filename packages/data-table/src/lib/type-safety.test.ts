import * as assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { column } from './column.ts'
import { createDatabase } from './database.ts'
import type {
  QueryBuilder,
  QueryColumnTypesForTable,
  QueryForTable,
  WriteResult,
} from './database.ts'
import { table, hasMany } from './table.ts'
import type { TableReference, TableRow } from './table.ts'
import { eq } from './operators.ts'
import type { SqliteTestSeed } from '../../test/sqlite-test-database.ts'
import { createSqliteTestAdapter } from '../../test/sqlite-test-database.ts'

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectType<condition extends true>(_value?: condition): void {}

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
    archived: column.boolean(),
  },
})

let accountProjects = hasMany(accounts, projects)

let inferredColumns = table({
  name: 'inferred_columns',
  columns: {
    id: column.integer(),
    title: column.text(),
    is_active: column.boolean(),
    amount: column.decimal(10, 2),
    status: column.enum(['draft', 'published'] as const),
    metadata: column.json(),
    happened_at: column.timestamp(),
    big_counter: column.bigint(),
    validated_payload: column.json(),
  },
})

let cleanups = new Set<() => void>()

afterEach(() => {
  for (let cleanup of cleanups) {
    cleanup()
  }

  cleanups.clear()
})

describe('type safety', () => {
  it('infers unvalidated column types from physical types and falls back to unknown', () => {
    type Row = TableRow<typeof inferredColumns>

    expectType<Equal<Row['title'], string>>()
    expectType<Equal<Row['is_active'], boolean>>()
    expectType<Equal<Row['amount'], number>>()
    expectType<Equal<Row['status'], 'draft' | 'published'>>()
    expectType<Equal<Row['metadata'], unknown>>()
    expectType<Equal<Row['happened_at'], unknown>>()
    expectType<Equal<Row['big_counter'], unknown>>()
    expectType<Equal<Row['validated_payload'], unknown>>()
  })

  it('exposes query builder generics as column and row output maps', () => {
    let db = createDatabase(createAdapter())
    let query = db.query(accounts)

    type Query = typeof query
    type QueryColumns =
      Query extends QueryBuilder<infer columnTypes, any, any, any, any> ? columnTypes : never
    type QueryRow = Query extends QueryBuilder<any, infer row, any, any, any> ? row : never
    type QueryTableName = Query extends QueryBuilder<any, any, any, infer name, any> ? name : never
    type QueryPrimaryKey = Query extends QueryBuilder<any, any, any, any, infer key> ? key : never
    type QueryFromTableAlias = QueryForTable<typeof accounts>
    type QueryColumnsFromAlias = QueryColumnTypesForTable<typeof accounts>
    type AccountsReference = TableReference<typeof accounts>
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

    let rows = await db.query(accounts).select('id').with({ projects: accountProjects }).all()

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
      .query(accounts)
      .join(projects, eq(accounts.id, projects.account_id))
      .select({
        accountId: accounts.id,
        accountEmail: accounts.email,
        projectId: projects.id,
        projectArchived: projects.archived,
      })
      .orderBy(projects.id, 'asc')
      .all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].accountId, 1)
    assert.equal(rows[0].accountEmail, 'a@example.com')
    assert.equal(rows[0].projectId, 100)
    assert.equal(Boolean(rows[0].projectArchived), false)

    let groupedCount = await db
      .query(accounts)
      .join(projects, eq(accounts.id, projects.account_id))
      .groupBy(projects.account_id)
      .having(eq(projects.account_id, 1))
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
      db.query(accounts)
        .join(projects, eq(accounts.id, projects.account_id))
        // @ts-expect-error unknown joined column for orderBy
        .orderBy(projects.nope)
      db.query(accounts)
        .join(projects, eq(accounts.id, projects.account_id))
        // @ts-expect-error unknown joined column for groupBy
        .groupBy(projects.nope)
      db.query(accounts)
        .join(projects, eq(accounts.id, projects.account_id))
        // @ts-expect-error unknown source column in alias selection
        .select({ bad: projects.nope })
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

    let filtered = await db.query(accounts).where({ status: 'active' }).all()
    let groupedCount = await db
      .query(accounts)
      .groupBy('status')
      .having({ status: 'active' })
      .count()
    let joined = await db
      .query(accounts)
      .join(projects, eq(accounts.id, projects.account_id))
      .where(eq(projects.archived, false))
      .all()
    let withRelations = await db
      .query(accounts)
      .with({ projects: accountProjects.where({ archived: false }) })
      .all()

    assert.equal(filtered.length, 1)
    assert.equal(groupedCount, 1)
    assert.equal(joined.length, 1)
    assert.equal(withRelations[0].projects.length, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown predicate key
      db.query(accounts).where({ not_a_column: 'active' })
      // @ts-expect-error unknown predicate key
      db.query(accounts).having({ not_a_column: 'active' })
      // @ts-expect-error join predicate key must be from source or target table
      db.query(accounts).join(projects, eq('not_a_column', true))
      // @ts-expect-error right-hand column reference must be from source or target table
      db.query(accounts).join(projects, eq(accounts.id, 'projects.not_a_column'))
      // @ts-expect-error relation predicate key must be from relation target table
      accountProjects.where({ not_a_column: true })
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

    let first = await db.find(accounts, 1)
    let active = await db.findOne(accounts, {
      where: { status: 'active' },
      orderBy: ['accounts.id', 'asc'],
    })
    let rows = await db.findMany(accounts, {
      where: eq('status', 'active'),
      orderBy: [
        ['status', 'asc'],
        ['id', 'desc'],
      ],
      with: { projects: accountProjects },
    })
    let count = await db.count(accounts, { where: { status: 'active' } })

    assert.equal(first?.id, 1)
    assert.equal(active?.email, 'a@example.com')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].projects.length, 1)
    assert.equal(count, 1)

    type Row = (typeof rows)[number]
    expectType<Equal<Row['projects'][number]['id'], number>>()
    expectType<Equal<Row['projects'][number]['account_id'], number>>()
    expectType<Equal<Row['projects'][number]['archived'], boolean>>()

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown where key
      db.findOne(accounts, { where: { not_a_column: 'active' } })
      // @ts-expect-error unknown orderBy column
      db.findMany(accounts, { orderBy: ['not_a_column', 'asc'] })
      db.findMany(accounts, {
        orderBy: [
          ['id', 'asc'],
          // @ts-expect-error unknown orderBy column in tuple list
          ['not_a_column', 'desc'],
        ],
      })
      // @ts-expect-error unknown where key
      db.count(accounts, { where: { not_a_column: 'active' } })
      // @ts-expect-error orderBy is not supported by db.count()
      db.count(accounts, { orderBy: ['id', 'asc'] })
      // @ts-expect-error limit is not supported by db.count()
      db.count(accounts, { limit: 1 })
      // @ts-expect-error offset is not supported by db.count()
      db.count(accounts, { offset: 1 })
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
      accounts,
      1,
      { status: 'inactive' },
      { with: { projects: accountProjects } },
    )
    let updateManyResult = await db.updateMany(
      accounts,
      { status: 'active' },
      {
        where: { status: 'inactive' },
        orderBy: ['id', 'asc'],
        limit: 1,
      },
    )
    let deleted = await db.delete(accounts, 2)
    let deleteManyResult = await db.deleteMany(accounts, {
      where: eq('status', 'active'),
      orderBy: [['id', 'desc']],
      limit: 1,
    })

    assert.equal(updated.id, 1)
    assert.equal(updated.projects.length, 1)
    assert.equal(updateManyResult.affectedRows, 1)
    assert.equal(deleted, true)
    assert.equal(deleteManyResult.affectedRows, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown update key
      db.update(accounts, 1, { not_a_column: 'x' })
      // @ts-expect-error unknown where key
      db.updateMany(accounts, { status: 'active' }, { where: { not_a_column: 'x' } })
      db.updateMany(
        accounts,
        { status: 'active' },
        {
          where: { status: 'active' },
          // @ts-expect-error unknown orderBy key
          orderBy: ['nope', 'asc'],
        },
      )
      // @ts-expect-error unknown where key
      db.deleteMany(accounts, { where: { not_a_column: 'x' } })
      // @ts-expect-error unknown orderBy key
      db.deleteMany(accounts, { where: { status: 'active' }, orderBy: [['nope', 'asc']] })
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

    let createResult = await db.create(accounts, {
      id: 2,
      email: 'b@example.com',
      status: 'active',
    })
    let created = await db.create(
      accounts,
      {
        id: 3,
        email: 'c@example.com',
        status: 'inactive',
      },
      {
        returnRow: true,
        with: { projects: accountProjects },
      },
    )
    let createManyResult = await db.createMany(accounts, [
      { id: 4, email: 'd@example.com', status: 'active' },
      { id: 5, email: 'e@example.com', status: 'inactive' },
    ])
    let createdRows = await db.createMany(
      accounts,
      [{ id: 6, email: 'f@example.com', status: 'active' }],
      { returnRows: true },
    )

    expectType<Equal<typeof createResult, WriteResult>>()
    expectType<Equal<typeof createManyResult, WriteResult>>()
    expectType<Equal<(typeof created)['id'], number>>()
    expectType<Equal<(typeof created)['projects'][number]['id'], number>>()
    expectType<Equal<(typeof createdRows)[number]['id'], number>>()
    expectType<Equal<(typeof createdRows)[number]['email'], string>>()

    assert.equal(createResult.affectedRows, 1)
    assert.equal(created.id, 3)
    assert.equal(created.projects.length, 1)
    assert.equal(createManyResult.affectedRows, 2)
    assert.equal(createdRows.length, 1)

    function verifyTypeErrors(): void {
      // @ts-expect-error unknown insert key
      db.create(accounts, { not_a_column: 'x' })
      db.create(
        accounts,
        { id: 7, email: 'g@example.com', status: 'active' },
        // @ts-expect-error with is only supported when returnRow: true
        { with: { projects: accountProjects } },
      )
      // @ts-expect-error unknown createMany insert key
      db.createMany(accounts, [{ not_a_column: 'x' }])
      db.createMany(
        accounts,
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
