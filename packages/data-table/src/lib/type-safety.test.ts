import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'

import { createDatabase } from './database.ts'
import { MemoryDatabaseAdapter } from './memory-adapter.ts'
import { createTable } from './model.ts'
import { eq } from './operators.ts'

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

describe('type safety', () => {
  it('narrows select() result types while preserving relation types', async () => {
    let db = createDatabase(
      new MemoryDatabaseAdapter({
        accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
        projects: [{ id: 100, account_id: 1, archived: false }],
      }),
    )

    let rows = await db.query(Accounts).select('id').with({ projects: AccountProjects }).all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 1)
    assert.equal(rows[0].projects.length, 1)
    assert.equal(rows[0].projects[0].archived, false)
    assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'projects'])

    type Row = (typeof rows)[number]
    expectType<Equal<Row['id'], number>>()
    expectType<Equal<Row['projects'][number]['id'], number>>()
    expectType<Equal<Row['projects'][number]['account_id'], number>>()
    expectType<Equal<Row['projects'][number]['archived'], boolean>>()

    // @ts-expect-error select('id') should not expose non-selected account columns
    rows[0].email
  })

  it('enforces typed keys for where/having/join/relation filters while running real queries', async () => {
    let adapter = new MemoryDatabaseAdapter({
      accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
      projects: [{ id: 100, account_id: 1, archived: false }],
    })
    let db = createDatabase(adapter)

    let filtered = await db.query(Accounts).where({ status: 'active' }).all()
    await db.query(Accounts).groupBy('status').having({ status: 'active' }).count()
    await db
      .query(Accounts)
      .join(Projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('projects.archived', false))
      .all()
    let withRelations = await db
      .query(Accounts)
      .with({ projects: AccountProjects.where({ archived: false }) })
      .all()

    assert.equal(filtered.length, 1)
    assert.equal(withRelations[0].projects.length, 1)

    let havingStatement = adapter.statements[1]?.statement
    assert.equal(havingStatement?.kind, 'count')
    if (havingStatement?.kind === 'count') {
      assert.equal(havingStatement.having.length, 1)
      assert.deepEqual(havingStatement.groupBy, ['status'])
    }

    let joinStatement = adapter.statements[2]?.statement
    assert.equal(joinStatement?.kind, 'select')
    if (joinStatement?.kind === 'select') {
      assert.equal(joinStatement.joins.length, 1)
      assert.equal(joinStatement.where.length, 1)
    }

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
})
