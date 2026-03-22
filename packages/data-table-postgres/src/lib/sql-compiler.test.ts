import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  and,
  between,
  column,
  createDatabase,
  table,
  eq,
  gt,
  gte,
  ilike,
  inList,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInList,
  notNull,
  or,
  query
} from '@remix-run/data-table'
import type { DataManipulationOperation, DatabaseAdapter } from '@remix-run/data-table/adapter'

import { compilePostgresOperation } from './sql-compiler.ts'

let accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    deleted: column.boolean(),
  },
})

let tasks = table({
  name: 'tasks',
  columns: {
    id: column.integer(),
    name: column.text(),
    account_id: column.integer(),
  },
})

let statements: DataManipulationOperation[] = []

function createRecordingAdapter(): DatabaseAdapter {
  return {
    dialect: 'postgres',
    capabilities: {
      returning: true,
      savepoints: true,
      upsert: true,
      transactionalDdl: true,
      migrationLock: true,
    },
    compileSql() {
      return []
    },
    async execute(request) {
      statements.push(request.operation)
      return {}
    },
    async migrate() {
      return { affectedOperations: 0 }
    },
    async hasTable() {
      return false
    },
    async hasColumn() {
      return false
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
}

let db = createDatabase(createRecordingAdapter())

describe('postgres sql-compiler', () => {
  beforeEach(() => {
    statements = []
  })

  describe('select statement', () => {
    it('compile wildcard selection', async () => {
      await db.exec(query(accounts).all())
      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts"',
        values: [],
      })
    })

    it('compile selected aliases', async () => {
      await db.exec(query(accounts)
        .select({
          accountId: accounts.id,
          accountEmail: accounts.email,
        })
        .all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select "accounts"."id" as "accountId", "accounts"."email" as "accountEmail" from "accounts"',
        values: [],
      })
    })

    it('compile joins', async () => {
      await db.exec(query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" inner join "tasks" on "accounts"."id" = "tasks"."account_id"',
        values: [],
      })
    })

    it('compile left join', async () => {
      await db.exec(query(accounts).leftJoin(tasks, eq(accounts.id, tasks.account_id)).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" left join "tasks" on "accounts"."id" = "tasks"."account_id"',
        values: [],
      })
    })

    it('compile right join', async () => {
      await db.exec(query(accounts).rightJoin(tasks, eq(accounts.id, tasks.account_id)).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" right join "tasks" on "accounts"."id" = "tasks"."account_id"',
        values: [],
      })
    })

    it('compile object where filters', async () => {
      await db.exec(query(accounts).where({ status: 'enabled' }).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("status" = $1))',
        values: ['enabled'],
      })
    })

    it('compile null where filters', async () => {
      await db.exec(query(accounts).where({ status: null }).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("status" is null))',
        values: [],
      })
    })

    it('compile predicate operators', async () => {
      await db.exec(query(accounts).where(ne('status', 'disabled')).where(gt('id', 10)).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("status" <> $1) and ("id" > $2)',
        values: ['disabled', 10],
      })
    })

    it('compile gte/lt/lte/between/like/ilike predicates', async () => {
      await db.exec(query(accounts)
        .where(gte('id', 1))
        .where(lt('id', 20))
        .where(lte('id', 30))
        .where(between('id', 2, 9))
        .where(like('email', '%@example.com'))
        .where(ilike('email', '%@example.com'))
        .all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("id" >= $1) and ("id" < $2) and ("id" <= $3) and ("id" between $4 and $5) and ("email" like $6) and ("email" ilike $7)',
        values: [1, 20, 30, 2, 9, '%@example.com', '%@example.com'],
      })
    })

    it('compile in-list predicates', async () => {
      await db.exec(query(accounts)
        .where(inList('id', [1, 2]))
        .all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("id" in ($1, $2))',
        values: [1, 2],
      })
    })

    it('compile empty in-list predicates', async () => {
      await db.exec(query(accounts).where(inList('id', [])).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (1 = 0)',
        values: [],
      })
    })

    it('compile not-in predicates', async () => {
      await db.exec(query(accounts)
        .where(notInList('id', [1, 2]))
        .all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("id" not in ($1, $2))',
        values: [1, 2],
      })
    })

    it('compile logical combinators', async () => {
      await db.exec(query(accounts)
        .where(
          and(
            eq(accounts.id, 1),
            or(eq(accounts.status, 'enabled'), eq(accounts.status, 'disabled')),
          ),
        )
        .all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("accounts"."id" = $1) and (("accounts"."status" = $2) or ("accounts"."status" = $3)))',
        values: [1, 'enabled', 'disabled'],
      })
    })

    it('compile empty logical combinators', async () => {
      await db.exec(query(accounts).where(and()).where(or()).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (1 = 1) and (1 = 0)',
        values: [],
      })
    })

    it('compile group by and having', async () => {
      await db.exec(query(tasks).groupBy(tasks.account_id).having({ account_id: 20 }).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "tasks" group by "tasks"."account_id" having (("account_id" = $1))',
        values: [20],
      })
    })

    it('compile pagination', async () => {
      await db.exec(query(accounts).offset(5).limit(10).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" limit 10 offset 5',
        values: [],
      })
    })

    it('compile distinct selection with order by', async () => {
      await db.exec(query(accounts).distinct().orderBy('id', 'desc').all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select distinct * from "accounts" order by "id" DESC',
        values: [],
      })
    })

    it('compile boolean bindings', async () => {
      await db.exec(query(accounts).where({ deleted: true }).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where (("deleted" = $1))',
        values: [true],
      })
    })

    it('compile boolean predicates', async () => {
      await db.exec(query(accounts).where(isNull(accounts.status)).where(notNull(accounts.email)).all())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from "accounts" where ("accounts"."status" is null) and ("accounts"."email" is not null)',
        values: [],
      })
    })

    it('compile wildcard segment path', () => {
      let compiled = compilePostgresOperation({
        kind: 'select',
        table: accounts,
        select: [{ column: 'accounts.*', alias: 'allColumns' }],
        joins: [],
        where: [],
        groupBy: [],
        having: [],
        orderBy: [],
        limit: undefined,
        offset: undefined,
        distinct: false,
      })

      assert.deepEqual(compiled, {
        text: 'select "accounts".* as "allColumns" from "accounts"',
        values: [],
      })
    })
  })

  describe('count - exists statement', () => {
    it('compile count', async () => {
      await db.exec(query(tasks).where({ account_id: 1 }).count())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as "count" from (select 1 from "tasks" where (("account_id" = $1))) as "__dt_count"',
        values: [1],
      })
    })

    it('compile exists', async () => {
      await db.exec(query(tasks).where({ account_id: 1 }).exists())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as "count" from (select 1 from "tasks" where (("account_id" = $1))) as "__dt_count"',
        values: [1],
      })
    })
  })

  describe('insert statement', () => {
    it('compile for one', async () => {
      await db.exec(query(accounts).insert({
        id: 1,
        email: 'info@remix.run',
        status: 'enabled',
      }))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one and return values', async () => {
      await db.exec(query(accounts).insert(
        {
          id: 1,
          email: 'info@remix.run',
          status: 'enabled',
        },
        { returning: '*' },
      ))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3) returning *',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one and return selected columns', async () => {
      await db.exec(query(accounts).insert(
        {
          id: 2,
          email: 'contact@remix.run',
          status: 'active',
        },
        { returning: ['id', 'email'] },
      ))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3) returning "id", "email"',
        values: [2, 'contact@remix.run', 'active'],
      })
    })

    it('compile for one with default values', async () => {
      await db.exec(query(accounts).insert({}))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" default values',
        values: [],
      })
    })

    it('compile for many', async () => {
      await db.exec(query(accounts).insertMany([
        { id: 1, email: 'info@remix.run', status: 'enabled' },
        { id: 2, email: 'contact@remix.run', status: 'draft' },
      ]))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("id", "email", "status") values ($1, $2, $3), ($4, $5, $6)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many with default values', () => {
      let compiled = compilePostgresOperation({
        kind: 'insertMany',
        table: accounts,
        values: [{}, {}],
      })
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" default values',
        values: [],
      })
    })

    it('compile for many without data', async () => {
      await db.exec(query(accounts).insertMany([]))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select 0 where 1 = 0',
        values: [],
      })
    })
  })

  describe('update statement', () => {
    it('compile for one', async () => {
      await db.exec(query(accounts).where({ id: 1 }).update({
        email: 'info@remix.run',
        status: 'enabled',
      }))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'update "accounts" set "email" = $1, "status" = $2 where (("id" = $3))',
        values: ['info@remix.run', 'enabled', 1],
      })
    })

    it('compile for many', async () => {
      await db.exec(query(accounts).where({
            status: 'disabled',
          }).update({
          email: 'info@remix.run',
          status: 'enabled',
        }))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'update "accounts" set "email" = $1, "status" = $2 where (("status" = $3))',
        values: ['info@remix.run', 'enabled', 'disabled'],
      })
    })
  })

  describe('upsert statement', () => {
    it('throws without values', async () => {
      await db.exec(query(accounts).upsert(
        {},
        {
          conflictTarget: ['id'],
        },
      ))

      assert.throws(() => compilePostgresOperation(statements[0]))
    })

    it('compile with update columns', async () => {
      await db.exec(query(accounts).upsert(
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
      ))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("status", "email") values ($1, $2) on conflict ("id") do update set "email" = $3',
        values: ['enabled', 'info@remix.run', 'contact@remix.run'],
      })
    })

    it('compile without update columns', async () => {
      await db.exec(query(accounts).upsert(
        {
          status: 'enabled',
          email: 'info@remix.run',
        },
        {
          conflictTarget: ['id'],
          update: {},
        },
      ))

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into "accounts" ("status", "email") values ($1, $2) on conflict ("id") do nothing',
        values: ['enabled', 'info@remix.run'],
      })
    })
  })

  describe('delete statement', () => {
    it('compile for one', async () => {
      await db.exec(query(accounts).where({ id: 10 }).delete())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from "accounts" where (("id" = $1))',
        values: [10],
      })
    })

    it('compile for many', async () => {
      await db.exec(query(accounts).where({
          status: 'enabled',
        }).delete())

      let compiled = compilePostgresOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from "accounts" where (("status" = $1))',
        values: ['enabled'],
      })
    })
  })

  describe('raw statement', () => {
    it('compile', () => {
      let compiled = compilePostgresOperation({
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

    it('compile without placeholders', () => {
      let compiled = compilePostgresOperation({
        kind: 'raw',
        sql: {
          text: 'select 1',
          values: [],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select 1',
        values: [],
      })
    })
  })

  describe('error handling', () => {
    it('throws for unsupported statements', () => {
      assert.throws(
        () => {
          // @ts-expect-error deliberate unsupported operation kind for fallback coverage
          compilePostgresOperation({ kind: 'unknown' })
        },
        /Unsupported operation kind/,
      )
    })

    it('throws for unsupported predicates', () => {
      assert.throws(
        () =>
          compilePostgresOperation({
            kind: 'select',
            table: accounts,
            select: '*',
            joins: [],
            where: [
              // @ts-expect-error deliberate unsupported predicate kind for fallback coverage
              { type: 'unknown' },
            ],
            groupBy: [],
            having: [],
            orderBy: [],
            limit: undefined,
            offset: undefined,
            distinct: false,
          }),
        /Unsupported predicate/,
      )
    })
  })
})
