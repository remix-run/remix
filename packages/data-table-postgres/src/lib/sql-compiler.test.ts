import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'
import {
  and,
  createDatabase,
  createTable,
  eq,
  gt,
  inList,
  isNull,
  ne,
  notInList,
  type AdapterStatement,
  type DatabaseAdapter,
  or,
} from '@remix-run/data-table'

import { compilePostgresStatement } from './sql-compiler.ts'

let accounts = createTable({
  name: 'accounts',
  columns: {
    id: number(),
    email: string(),
    status: string(),
    deleted: boolean(),
  },
})

let tasks = createTable({
  name: 'tasks',
  columns: {
    id: number(),
    name: string(),
    account_id: number(),
  },
})

let statements: AdapterStatement[] = []

let fakeAdapter = {
  capabilities: {
    upsert: true,
    returning: true,
  },

  execute: async (request) => {
    statements.push(request.statement)
    return {}
  },
} as DatabaseAdapter

let db = createDatabase(fakeAdapter)

describe('postgres sql-compiler', () => {
  beforeEach(() => {
    statements = []
  })

  describe('select statement', () => {
    it('compile wildcard selection', async () => {
      await db.query(accounts).all()
      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts"',
        values: [],
      })
    })

    it('compile selected aliases', async () => {
      await db
        .query(accounts)
        .select({
          accountId: accounts.id,
          accountEmail: accounts.email,
        })
        .all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select "accounts"."id" as "accountId", "accounts"."email" as "accountEmail" from "accounts"',
        values: [],
      })
    })

    it('compile joins', async () => {
      await db.query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" inner join "tasks" on "accounts"."id" = "tasks"."account_id"',
        values: [],
      })
    })

    it('compile object where filters', async () => {
      await db.query(accounts).where({ status: 'enabled' }).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("status" = $1))',
        values: ['enabled'],
      })
    })

    it('compile null where filters', async () => {
      await db.query(accounts).where({ status: null }).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("status" is null))',
        values: [],
      })
    })

    it('compile predicate operators', async () => {
      await db.query(accounts).where(ne('status', 'disabled')).where(gt('id', 10)).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("status" <> $1) and ("id" > $2)',
        values: ['disabled', 10],
      })
    })

    it('compile in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [1, 2])).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("id" in ($1, $2))',
        values: [1, 2],
      })
    })

    it('compile empty in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [])).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (1 = 0)',
        values: [],
      })
    })

    it('compile not-in predicates', async () => {
      await db.query(accounts).where(notInList('id', [1, 2])).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("id" not in ($1, $2))',
        values: [1, 2],
      })
    })

    it('compile logical combinators', async () => {
      await db
        .query(accounts)
        .where(
          and(
            eq(accounts.id, 1),
            or(eq(accounts.status, 'enabled'), eq(accounts.status, 'disabled')),
          ),
        )
        .all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("accounts"."id" = $1) and (("accounts"."status" = $2) or ("accounts"."status" = $3)))',
        values: [1, 'enabled', 'disabled'],
      })
    })

    it('compile group by and having', async () => {
      await db.query(tasks).groupBy(tasks.account_id).having({ account_id: 20 }).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "tasks" group by "tasks"."account_id" having (("account_id" = $1))',
        values: [20],
      })
    })

    it('compile pagination', async () => {
      await db.query(accounts).offset(5).limit(10).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" limit 10 offset 5',
        values: [],
      })
    })

    it('compile boolean bindings', async () => {
      await db.query(accounts).where({ deleted: true }).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("deleted" = $1))',
        values: [true],
      })
    })

    it('compile boolean predicates', async () => {
      await db.query(accounts).where(isNull(accounts.status)).all()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("accounts"."status" is null)',
        values: [],
      })
    })
  })

  describe('count - exists statement', () => {
    it('compile count', async () => {
      await db.query(tasks).where({ account_id: 1 }).count()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as "count" from (select 1 from "tasks" where (("account_id" = $1))) as "__dt_count"',
        values: [1],
      })
    })

    it('compile exists', async () => {
      await db.query(tasks).where({ account_id: 1 }).exists()

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as "count" from (select 1 from "tasks" where (("account_id" = $1))) as "__dt_count"',
        values: [1],
      })
    })
  })

  describe('insert statement', () => {
    it('compile for one', async () => {
      await db.create(accounts, {
        id: 1,
        email: 'info@remix.run',
        status: 'enabled',
      })

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one and return values', async () => {
      await db.query(accounts).insert(
        {
          id: 1,
          email: 'info@remix.run',
          status: 'enabled',
        },
        { returning: '*' },
      )

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3) returning *',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one with default values', async () => {
      await db.create(accounts, {})

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" default values',
        values: [],
      })
    })

    it('compile for many', async () => {
      await db.createMany(accounts, [
        { id: 1, email: 'info@remix.run', status: 'enabled' },
        { id: 2, email: 'contact@remix.run', status: 'draft' },
      ])

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3), ($4, $5, $6)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many with default values', async () => {
      await db.createMany(accounts, [{}, {}])

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" default values',
        values: [],
      })
    })

    it('compile for many without data', async () => {
      await db.createMany(accounts, [])

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select 0 where 1 = 0',
        values: [],
      })
    })
  })

  describe('update statement', () => {
    it('compile for one', async () => {
      await db.query(accounts).where({ id: 1 }).update({
        email: 'info@remix.run',
        status: 'enabled',
      })

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update "accounts" set "email" = $1, "status" = $2 where (("id" = $3))',
        values: ['info@remix.run', 'enabled', 1],
      })
    })

    it('compile for many', async () => {
      await db.updateMany(
        accounts,
        {
          email: 'info@remix.run',
          status: 'enabled',
        },
        {
          where: {
            status: 'disabled',
          },
        },
      )

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update "accounts" set "email" = $1, "status" = $2 where (("status" = $3))',
        values: ['info@remix.run', 'enabled', 'disabled'],
      })
    })
  })

  describe('upsert statement', () => {
    it('throws without values', async () => {
      await db.query(accounts).upsert(
        {},
        {
          conflictTarget: ['id'],
        },
      )

      assert.throws(() => compilePostgresStatement(statements[0]))
    })

    it('compile with update columns', async () => {
      await db.query(accounts).upsert(
        {
          status: 'enabled',
          email: 'info@remix.run',
        },
        {
          conflictTarget: ['id'],
          update: {
            email: 'contact@remix.run',
          },
        },
      )

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("status", "email") values ($1, $2) on conflict ("id") do update set "email" = $3',
        values: ['enabled', 'info@remix.run', 'contact@remix.run'],
      })
    })

    it('compile without update columns', async () => {
      await db.query(accounts).upsert(
        {
          status: 'enabled',
          email: 'info@remix.run',
        },
        {
          conflictTarget: ['id'],
          update: {},
        },
      )

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("status", "email") values ($1, $2) on conflict ("id") do nothing',
        values: ['enabled', 'info@remix.run'],
      })
    })
  })

  describe('delete statement', () => {
    it('compile for one', async () => {
      await db.delete(accounts, 10)

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from "accounts" where (("id" = $1))',
        values: [10],
      })
    })

    it('compile for many', async () => {
      await db.deleteMany(accounts, {
        where: {
          status: 'enabled',
        },
      })

      let compiled = compilePostgresStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from "accounts" where (("status" = $1))',
        values: ['enabled'],
      })
    })
  })

  describe('raw statement', () => {
    it('compile', () => {
      let compiled = compilePostgresStatement({
        kind: 'raw',
        sql: {
          text: 'select * from accounts where id = ? and status = ?',
          values: [10, 'active'],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select * from accounts where id = $1 and status = $2',
        values: [10, 'active'],
      })
    })
  })
})
