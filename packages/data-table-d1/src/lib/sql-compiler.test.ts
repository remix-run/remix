import * as assert from '@remix-run/assert'
import {
  and,
  column,
  createDatabase,
  eq,
  ilike,
  inList,
  notInList,
  or,
  table,
  type DataManipulationOperation,
  type DatabaseAdapter,
} from '@remix-run/data-table'
import { beforeEach, describe, it } from '@remix-run/test'

import { compileD1Operation } from './sql-compiler.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    deleted: column.boolean(),
  },
})

const tasks = table({
  name: 'tasks',
  columns: {
    id: column.integer(),
    name: column.text(),
    account_id: column.integer(),
  },
})

let operations: DataManipulationOperation[] = []

const adapter = {
  dialect: 'd1',
  capabilities: {
    returning: true,
    savepoints: false,
    upsert: true,
    transactionalDdl: false,
    migrationLock: false,
  },
  compileSql(operation) {
    return [compileD1Operation(operation)]
  },
  async execute(request) {
    operations.push(request.operation)

    if (request.operation.kind === 'select') {
      return { rows: [{ id: 1 }] }
    }

    if (request.operation.kind === 'insert' && request.operation.returning) {
      return { rows: [{ id: 10 }] }
    }

    return {}
  },
  async executeScript() {},
  async hasTable() {
    return false
  },
  async hasColumn() {
    return false
  },
  async beginTransaction() {
    throw new Error('not used')
  },
  async commitTransaction() {},
  async rollbackTransaction() {},
  async createSavepoint() {},
  async rollbackToSavepoint() {},
  async releaseSavepoint() {},
} satisfies DatabaseAdapter

const db = createDatabase(adapter)

describe('d1 sql-compiler', () => {
  beforeEach(() => {
    operations = []
  })

  it('compiles wildcard and selected reads', async () => {
    await db.query(accounts).all()
    await db.query(accounts).select({ accountId: accounts.id, accountEmail: accounts.email }).all()

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'select * from "accounts"',
      values: [],
    })
    assert.deepEqual(compileD1Operation(operations[1]), {
      text: 'select "accounts"."id" as "accountId", "accounts"."email" as "accountEmail" from "accounts"',
      values: [],
    })
  })

  it('compiles joins and column comparisons', async () => {
    await db.query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all()

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'select * from "accounts" inner join "tasks" on "accounts"."id" = "tasks"."account_id"',
      values: [],
    })
  })

  it('compiles predicate values and empty list predicates', async () => {
    await db
      .query(accounts)
      .where(
        and(
          eq('status', 'active'),
          ilike('email', '%@example.com'),
          inList('id', [1, 2]),
          notInList('id', []),
        ),
      )
      .all()

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'select * from "accounts" where (("status" = ?) and (lower("email") like lower(?)) and ("id" in (?, ?)) and (1 = 1))',
      values: ['active', '%@example.com', 1, 2],
    })
  })

  it('compiles grouped counts', async () => {
    await db
      .query(accounts)
      .join(tasks, eq(accounts.id, tasks.account_id))
      .where(or(eq('status', 'active'), eq('status', 'trial')))
      .groupBy('accounts.id')
      .having(eq('accounts.id', 1))
      .count()

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'select count(*) as "count" from (select 1 from "accounts" inner join "tasks" on "accounts"."id" = "tasks"."account_id" where (("status" = ?) or ("status" = ?)) group by "accounts"."id" having ("accounts"."id" = ?)) as "__dt_count"',
      values: ['active', 'trial', 1],
    })
  })

  it('compiles inserts, updates, deletes, and returning clauses', async () => {
    await db.query(accounts).insert({ id: 1, email: 'a@example.com', status: 'active' })
    await db
      .query(accounts)
      .insert({ id: 2, email: 'b@example.com', status: 'active' }, { returning: ['id'] })
    await db
      .query(accounts)
      .where({ id: 1 })
      .update({ status: 'inactive' }, { returning: ['id', 'status'] })
    await db.query(accounts).where({ id: 2 }).delete({ returning: ['id'] })

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'insert into "accounts" ("id", "email", "status") values (?, ?, ?)',
      values: [1, 'a@example.com', 'active'],
    })
    assert.deepEqual(compileD1Operation(operations[1]), {
      text: 'insert into "accounts" ("id", "email", "status") values (?, ?, ?) returning "id"',
      values: [2, 'b@example.com', 'active'],
    })
    assert.deepEqual(compileD1Operation(operations[2]), {
      text: 'update "accounts" set "status" = ? where (("id" = ?)) returning "id", "status"',
      values: ['inactive', 1],
    })
    assert.deepEqual(compileD1Operation(operations[3]), {
      text: 'delete from "accounts" where (("id" = ?)) returning "id"',
      values: [2],
    })
  })

  it('compiles upserts with conflict targets', async () => {
    await db
      .query(accounts)
      .upsert(
        { id: 1, email: 'a@example.com', status: 'inactive' },
        { conflictTarget: ['id'], update: { status: 'inactive' }, returning: ['id', 'status'] },
      )

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'insert into "accounts" ("id", "email", "status") values (?, ?, ?) on conflict ("id") do update set "status" = ? returning "id", "status"',
      values: ['inactive', 1, 'a@example.com', 'inactive'],
    })
  })

  it('normalizes booleans to D1 integer values during compilation', async () => {
    await db.query(accounts).where(eq('deleted', false)).all()

    assert.deepEqual(compileD1Operation(operations[0]), {
      text: 'select * from "accounts" where ("deleted" = ?)',
      values: [0],
    })
  })
})
