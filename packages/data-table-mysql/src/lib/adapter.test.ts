import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import { createDatabase, createTable, eq, ilike, inList } from '@remix-run/data-table'

import { createMysqlDatabaseAdapter } from './adapter.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
  },
})

let projects = createTable({
  name: 'projects',
  columns: {
    id: number(),
    account_id: number(),
    name: string(),
  },
})

let invoices = createTable({
  name: 'billing.invoices',
  columns: {
    id: number(),
    account_id: number(),
  },
})

describe('mysql adapter', () => {
  it('compiles ilike() with lower() and parses count results', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })

        return [[{ count: '3' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    let count = await db.query(accounts).where(ilike('email', '%EXAMPLE%')).count()

    assert.equal(count, 3)
    assert.match(statements[0].text, /lower\(`email`\) like lower\(\?\)/)
    assert.deepEqual(statements[0].values, ['%EXAMPLE%'])
  })

  it('starts and commits transactions on pooled connections', async () => {
    let lifecycle: string[] = []

    let poolConnection = {
      async query() {
        return [{ affectedRows: 1, insertId: 1 }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
      release() {
        lifecycle.push('release')
      },
    }

    let pool = {
      async query() {
        throw new Error('unexpected root query')
      },
      async getConnection() {
        lifecycle.push('getConnection')
        return poolConnection
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(pool as never))

    await db.transaction(async (transactionDatabase) => {
      await transactionDatabase.query(accounts).insert({ id: 1, email: 'a@example.com' })
    })

    assert.deepEqual(lifecycle, ['getConnection', 'begin', 'commit', 'release'])
  })

  it('applies transaction options when provided', async () => {
    let lifecycle: string[] = []

    let connection = {
      async query(text: string) {
        lifecycle.push(text)
        return [{ affectedRows: 0, insertId: undefined }, []]
      },
      async beginTransaction() {
        lifecycle.push('begin')
      },
      async commit() {
        lifecycle.push('commit')
      },
      async rollback() {
        lifecycle.push('rollback')
      },
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    assert.deepEqual(lifecycle, [
      'set transaction isolation level serializable',
      'set transaction read only',
      'begin',
      'commit',
    ])
  })

  it('compiles column-to-column comparisons from string references', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'ops@example.com'))
      .count()

    assert.match(statements[0].text, /`accounts`\.`id`\s*=\s*`projects`\.`account_id`/)
    assert.match(statements[0].text, /`accounts`\.`email`\s*=\s*\?/)
    assert.deepEqual(statements[0].values, ['ops@example.com'])
  })

  it('compiles cross-schema table references in joins', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db
      .query(invoices)
      .join(accounts, eq(accounts.id, invoices.account_id))
      .count()

    assert.match(statements[0].text, /from `billing`\.`invoices`/)
    assert.match(statements[0].text, /join `accounts`/)
    assert.match(statements[0].text, /`accounts`\.`id`\s*=\s*`billing`\.`invoices`\.`account_id`/)
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.match(statements[0].text, /as `account\.email`/)
  })

  it('does not create dangling bind parameters for inList predicates', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        return [[{ count: '0' }], []]
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    await db
      .query(accounts)
      .where(inList('id', [1, 3]))
      .count()

    assert.match(statements[0].text, /`id`\s+in\s+\(\?,\s*\?\)/)
    assert.deepEqual(statements[0].values, [1, 3])
  })

  it('loads the inserted row for create({ returnRow: true }) without RETURNING support', async () => {
    let statements: Array<{ text: string; values: unknown[] }> = []
    let calls = 0

    let connection = {
      async query(text: string, values: unknown[] = []) {
        statements.push({ text, values })
        calls += 1

        if (calls === 1) {
          return [{ affectedRows: 1, insertId: 2 }, []]
        }

        if (calls === 2) {
          return [[{ id: 2, email: 'fallback@example.com' }], []]
        }

        throw new Error('unexpected query call')
      },
      async beginTransaction() {},
      async commit() {},
      async rollback() {},
    }

    let db = createDatabase(createMysqlDatabaseAdapter(connection as never))

    let created = await db.create(
      accounts,
      {
        email: 'fallback@example.com',
      },
      { returnRow: true },
    )

    assert.equal(created.id, 2)
    assert.equal(created.email, 'fallback@example.com')
    assert.equal(statements.length, 2)
    assert.match(statements[0].text, /^insert into `accounts`/)
    assert.match(statements[1].text, /^select \* from `accounts`/)
    assert.match(statements[1].text, /where \(\(`id` = \?\)\)/)
    assert.deepEqual(statements[1].values, [2])
  })
})
