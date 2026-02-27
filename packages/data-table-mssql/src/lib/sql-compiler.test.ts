import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'
import {
  and,
  createDatabase,
  createTable,
  eq,
  gt,
  ilike,
  inList,
  isNull,
  ne,
  notInList,
  or,
} from '@remix-run/data-table'
import type { AdapterStatement, DatabaseAdapter } from '@remix-run/data-table'

import { compileMssqlStatement } from './sql-compiler.ts'

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

describe('mssql sql-compiler', () => {
  beforeEach(() => {
    statements = []
  })

  describe('select statement', () => {
    it('compile wildcard selection', async () => {
      await db.query(accounts).all()
      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts]',
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select [accounts].[id] as [accountId], [accounts].[email] as [accountEmail] from [accounts]',
        values: [],
      })
    })

    it('compile inner joins', async () => {
      await db.query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] inner join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile left joins', async () => {
      await db.query(accounts).leftJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] left join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile right joins', async () => {
      await db.query(accounts).rightJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] right join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile object where filters', async () => {
      await db.query(accounts).where({ status: 'enabled' }).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([status] = @p1))',
        values: ['enabled'],
      })
    })

    it('compile null where filters', async () => {
      await db.query(accounts).where({ status: null }).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([status] is null))',
        values: [],
      })
    })

    it('compile predicate operators', async () => {
      await db.query(accounts).where(ne('status', 'disabled')).where(gt('id', 10)).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([status] <> @p1) and ([id] > @p2)',
        values: ['disabled', 10],
      })
    })

    it('compile in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [1, 2])).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([id] in (@p1, @p2))',
        values: [1, 2],
      })
    })

    it('compile empty in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [])).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (1 = 0)',
        values: [],
      })
    })

    it('compile not-in predicates', async () => {
      await db.query(accounts).where(notInList('id', [1, 2])).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([id] not in (@p1, @p2))',
        values: [1, 2],
      })
    })

    it('compile empty not-in predicates', async () => {
      await db.query(accounts).where(notInList('id', [])).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (1 = 1)',
        values: [],
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([accounts].[id] = @p1) and (([accounts].[status] = @p2) or ([accounts].[status] = @p3)))',
        values: [1, 'enabled', 'disabled'],
      })
    })

    it('compile group by and having', async () => {
      await db.query(tasks).groupBy(tasks.account_id).having({ account_id: 20 }).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [tasks] group by [tasks].[account_id] having (([account_id] = @p1))',
        values: [20],
      })
    })

    it('compile ilike predicates', async () => {
      await db.query(accounts).where(ilike('status', 'EnA')).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (lower([status]) like lower(@p1))',
        values: ['EnA'],
      })
    })

    it('compile isNull predicates', async () => {
      await db.query(accounts).where(isNull(accounts.status)).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([accounts].[status] is null)',
        values: [],
      })
    })

    it('compile pagination with limit-only via top', async () => {
      await db.query(accounts).limit(10).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select top (10) * from [accounts]',
        values: [],
      })
    })

    it('compile pagination with explicit order for offset/fetch', async () => {
      await db.query(accounts).orderBy(accounts.id).offset(5).limit(10).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] order by [accounts].[id] ASC offset 5 rows fetch next 10 rows only',
        values: [],
      })
    })

    it('compile pagination with synthetic order for offset-only queries', async () => {
      await db.query(accounts).offset(5).all()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] order by (select 1) offset 5 rows',
        values: [],
      })
    })
  })

  describe('count - exists statement', () => {
    it('compile count', async () => {
      await db.query(tasks).where({ account_id: 1 }).count()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as [count] from (select 1 as [__dt_col] from [tasks] where (([account_id] = @p1))) as [__dt_count]',
        values: [1],
      })
    })

    it('compile exists', async () => {
      await db.query(tasks).where({ account_id: 1 }).exists()

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as [count] from (select 1 as [__dt_col] from [tasks] where (([account_id] = @p1))) as [__dt_count]',
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) values (@p1, @p2, @p3)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one with output', async () => {
      await db.query(accounts).insert(
        {
          id: 1,
          email: 'info@remix.run',
          status: 'enabled',
        },
        { returning: '*' },
      )

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) output inserted.* values (@p1, @p2, @p3)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one with default values', async () => {
      await db.create(accounts, {})

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] default values',
        values: [],
      })
    })

    it('compile for many', async () => {
      await db.createMany(accounts, [
        { id: 1, email: 'info@remix.run', status: 'enabled' },
        { id: 2, email: 'contact@remix.run', status: 'draft' },
      ])

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) values (@p1, @p2, @p3), (@p4, @p5, @p6)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many and return values', async () => {
      await db.query(accounts).insertMany(
        [
          { id: 1, email: 'info@remix.run', status: 'enabled' },
          { id: 2, email: 'contact@remix.run', status: 'draft' },
        ],
        { returning: '*' },
      )

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) output inserted.* values (@p1, @p2, @p3), (@p4, @p5, @p6)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many with default values', () => {
      let compiled = compileMssqlStatement({
        kind: 'insertMany',
        table: accounts,
        values: [{}, {}],
      })
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] default values',
        values: [],
      })
    })

    it('compile for many without data', async () => {
      await db.createMany(accounts, [])

      let compiled = compileMssqlStatement(statements[0])
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update [accounts] set [email] = @p1, [status] = @p2 where (([id] = @p3))',
        values: ['info@remix.run', 'enabled', 1],
      })
    })

    it('compile with output values', async () => {
      await db.query(accounts).where({ id: 1 }).update(
        {
          email: 'info@remix.run',
        },
        { returning: '*' },
      )

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update [accounts] set [email] = @p1 output inserted.* where (([id] = @p2))',
        values: ['info@remix.run', 1],
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

      assert.throws(() => compileMssqlStatement(statements[0]))
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@p1, @p2)) as source ([status], [email]) on target.[id] = source.[id] when matched then update set target.[email] = @p3 when not matched then insert ([status], [email]) values (source.[status], source.[email]);',
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

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@p1, @p2)) as source ([status], [email]) on target.[id] = source.[id] when not matched then insert ([status], [email]) values (source.[status], source.[email]);',
        values: ['enabled', 'info@remix.run'],
      })
    })

    it('compile with output values', async () => {
      await db.query(accounts).upsert(
        {
          id: 1,
          status: 'enabled',
          email: 'info@remix.run',
        },
        {
          conflictTarget: ['id'],
          update: {
            status: 'disabled',
          },
          returning: '*',
        },
      )

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@p1, @p2, @p3)) as source ([id], [status], [email]) on target.[id] = source.[id] when matched then update set target.[status] = @p4 when not matched then insert ([id], [status], [email]) values (source.[id], source.[status], source.[email]) output inserted.*;',
        values: [1, 'enabled', 'info@remix.run', 'disabled'],
      })
    })
  })

  describe('delete statement', () => {
    it('compile for one', async () => {
      await db.delete(accounts, 10)

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] where (([id] = @p1))',
        values: [10],
      })
    })

    it('compile for many', async () => {
      await db.deleteMany(accounts, {
        where: {
          status: 'enabled',
        },
      })

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] where (([status] = @p1))',
        values: ['enabled'],
      })
    })

    it('compile with output values', async () => {
      await db.query(accounts).where({ id: 10 }).delete({ returning: '*' })

      let compiled = compileMssqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] output deleted.* where (([id] = @p1))',
        values: [10],
      })
    })
  })

  describe('raw statement', () => {
    it('compile with positional parameters', () => {
      let compiled = compileMssqlStatement({
        kind: 'raw',
        sql: {
          text: 'select * from accounts where id = ? and status = ?',
          values: [10, 'active'],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select * from accounts where id = @p1 and status = @p2',
        values: [10, 'active'],
      })
    })

    it('compile without positional parameters', () => {
      let compiled = compileMssqlStatement({
        kind: 'raw',
        sql: {
          text: 'select * from accounts',
          values: [],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select * from accounts',
        values: [],
      })
    })
  })
})
