import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { number, string } from '@remix-run/data-schema'
import { createDatabase, createTable, eq, inList, sql } from '@remix-run/data-table'

import { createPostgresDatabaseAdapter } from './adapter.ts'

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

describe('postgres adapter', () => {
  it('converts raw sql placeholders and normalizes count rows', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        if (text.startsWith('select count(*)')) {
          return {
            rows: [{ count: '2' }],
            rowCount: 1,
            command: 'SELECT',
            oid: 0,
            fields: [],
          }
        }

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    let count = await db.query(accounts).count()
    await db.exec(sql`select * from accounts where id = ${42}`)

    assert.equal(count, 2)
    assert.equal(statements[1].text, 'select * from accounts where id = $1')
    assert.deepEqual(statements[1].values, [42])
  })

  it('uses savepoints for nested transactions', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.transaction(async (outerTransaction) => {
      await outerTransaction
        .transaction(async () => {
          throw new Error('Abort nested transaction')
        })
        .catch(() => undefined)
    })

    assert.deepEqual(statements, [
      'begin',
      'savepoint "sp_0"',
      'rollback to savepoint "sp_0"',
      'release savepoint "sp_0"',
      'commit',
    ])
  })

  it('applies transaction options when provided', async () => {
    let statements: string[] = []

    let client = {
      async query(text: string) {
        statements.push(text)

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.transaction(async () => undefined, {
      isolationLevel: 'serializable',
      readOnly: true,
    })

    assert.deepEqual(statements, [
      'begin',
      'set transaction isolation level serializable read only',
      'commit',
    ])
  })

  it('compiles column-to-column comparisons from string references', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db
      .query(accounts)
      .join(projects, eq('accounts.id', 'projects.account_id'))
      .where(eq('accounts.email', 'ops@example.com'))
      .count()

    assert.match(statements[0].text, /"accounts"\."id"\s*=\s*"projects"\."account_id"/)
    assert.match(statements[0].text, /"accounts"\."email"\s*=\s*\$1/)
    assert.deepEqual(statements[0].values, ['ops@example.com'])
  })

  it('compiles cross-schema table references in joins', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db
      .query(invoices)
      .join(accounts, eq(accounts.id, invoices.account_id))
      .count()

    assert.match(statements[0].text, /from "billing"\."invoices"/)
    assert.match(statements[0].text, /join "accounts"/)
    assert.match(statements[0].text, /"accounts"\."id"\s*=\s*"billing"\."invoices"\."account_id"/)
  })

  it('treats dotted select aliases as single identifiers', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db.query(accounts).select({ 'account.email': accounts.email }).all()

    assert.match(statements[0].text, /as "account\.email"/)
  })

  it('does not create dangling bind parameters for inList predicates', async () => {
    let statements: Array<{ text: string; values: unknown[] | undefined }> = []

    let client = {
      async query(text: string, values?: unknown[]) {
        statements.push({ text, values })

        return {
          rows: [{ count: '0' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        }
      },
    }

    let db = createDatabase(createPostgresDatabaseAdapter(client as never))

    await db
      .query(accounts)
      .where(inList('id', [1, 3]))
      .count()

    assert.match(statements[0].text, /"id"\s+in\s+\(\$1,\s*\$2\)/)
    assert.deepEqual(statements[0].values, [1, 3])
  })
})
