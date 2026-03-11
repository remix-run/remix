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
  type DataManipulationOperation,
  type DatabaseAdapter,
  or,
} from '@remix-run/data-table'

import { compileMssqlOperation } from './sql-compiler.ts'

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

let fakeAdapter = {
  capabilities: {
    upsert: true,
    returning: true,
  },

  execute: async (request) => {
    statements.push(request.operation)
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
      let compiled = compileMssqlOperation(statements[0])
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select [accounts].[id] as [accountId], [accounts].[email] as [accountEmail] from [accounts]',
        values: [],
      })
    })

    it('compile joins', async () => {
      await db.query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] inner join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile left join', async () => {
      await db.query(accounts).leftJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] left join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile right join', async () => {
      await db.query(accounts).rightJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] right join [tasks] on [accounts].[id] = [tasks].[account_id]',
        values: [],
      })
    })

    it('compile object where filters', async () => {
      await db.query(accounts).where({ status: 'enabled' }).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([status] = @dt_p1))',
        values: ['enabled'],
      })
    })

    it('compile null where filters', async () => {
      await db.query(accounts).where({ status: null }).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([status] is null))',
        values: [],
      })
    })

    it('compile predicate operators', async () => {
      await db.query(accounts).where(ne('status', 'disabled')).where(gt('id', 10)).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([status] <> @dt_p1) and ([id] > @dt_p2)',
        values: ['disabled', 10],
      })
    })

    it('compile in-list predicates', async () => {
      await db
        .query(accounts)
        .where(inList('id', [1, 2]))
        .all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([id] in (@dt_p1, @dt_p2))',
        values: [1, 2],
      })
    })

    it('compile empty in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [])).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (1 = 0)',
        values: [],
      })
    })

    it('compile not-in predicates', async () => {
      await db
        .query(accounts)
        .where(notInList('id', [1, 2]))
        .all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([id] not in (@dt_p1, @dt_p2))',
        values: [1, 2],
      })
    })

    it('compile empty not-in predicates', async () => {
      await db.query(accounts).where(notInList('id', [])).all()

      let compiled = compileMssqlOperation(statements[0])
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([accounts].[id] = @dt_p1) and (([accounts].[status] = @dt_p2) or ([accounts].[status] = @dt_p3)))',
        values: [1, 'enabled', 'disabled'],
      })
    })

    it('compile group by and having', async () => {
      await db.query(tasks).groupBy(tasks.account_id).having({ account_id: 20 }).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [tasks] group by [tasks].[account_id] having (([account_id] = @dt_p1))',
        values: [20],
      })
    })

    it('compile boolean predicates', async () => {
      await db.query(accounts).where(isNull(accounts.status)).where(notNull(accounts.email)).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([accounts].[status] is null) and ([accounts].[email] is not null)',
        values: [],
      })
    })

    it('compile gte/lt/lte/between/like/ilike predicates', async () => {
      await db
        .query(accounts)
        .where(gte('id', 1))
        .where(lt('id', 20))
        .where(lte('id', 30))
        .where(between('id', 2, 9))
        .where(like('email', '%@example.com'))
        .where(ilike('email', '%@example.com'))
        .all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where ([id] >= @dt_p1) and ([id] < @dt_p2) and ([id] <= @dt_p3) and ([id] between @dt_p4 and @dt_p5) and ([email] like @dt_p6) and (lower([email]) like lower(@dt_p7))',
        values: [1, 20, 30, 2, 9, '%@example.com', '%@example.com'],
      })
    })

    it('compile empty logical combinators', async () => {
      await db.query(accounts).where(and()).where(or()).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (1 = 1) and (1 = 0)',
        values: [],
      })
    })

    it('compile distinct selection with order by', async () => {
      await db.query(accounts).distinct().orderBy('id', 'desc').all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select distinct * from [accounts] order by [id] DESC',
        values: [],
      })
    })

    it('compile boolean bindings', async () => {
      await db.query(accounts).where({ deleted: true }).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] where (([deleted] = @dt_p1))',
        values: [true],
      })
    })

    it('compile wildcard segment path', () => {
      let compiled = compileMssqlOperation({
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
        text: 'select [accounts].* as [allColumns] from [accounts]',
        values: [],
      })
    })

    it('compile pagination with limit-only via top', async () => {
      await db.query(accounts).limit(10).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select top (10) * from [accounts]',
        values: [],
      })
    })

    it('compile pagination with explicit order for offset/fetch', async () => {
      await db.query(accounts).orderBy(accounts.id).offset(5).limit(10).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] order by [accounts].[id] ASC offset 5 rows fetch next 10 rows only',
        values: [],
      })
    })

    it('compile pagination with synthetic order for offset-only queries', async () => {
      await db.query(accounts).offset(5).all()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from [accounts] order by (select 1) offset 5 rows',
        values: [],
      })
    })
  })

  describe('count - exists statement', () => {
    it('compile count', async () => {
      await db.query(tasks).where({ account_id: 1 }).count()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as [count] from (select 1 as [__dt_col] from [tasks] where (([account_id] = @dt_p1))) as [__dt_count]',
        values: [1],
      })
    })

    it('compile exists', async () => {
      await db.query(tasks).where({ account_id: 1 }).exists()

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as [count] from (select 1 as [__dt_col] from [tasks] where (([account_id] = @dt_p1))) as [__dt_count]',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) values (@dt_p1, @dt_p2, @dt_p3)',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) output inserted.* values (@dt_p1, @dt_p2, @dt_p3)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one and return selected columns', async () => {
      await db.query(accounts).insert(
        {
          id: 2,
          email: 'contact@remix.run',
          status: 'active',
        },
        { returning: ['id', 'email'] },
      )

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) output inserted.[id], inserted.[email] values (@dt_p1, @dt_p2, @dt_p3)',
        values: [2, 'contact@remix.run', 'active'],
      })
    })

    it('compile for one with default values', async () => {
      await db.create(accounts, {})

      let compiled = compileMssqlOperation(statements[0])
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) values (@dt_p1, @dt_p2, @dt_p3), (@dt_p4, @dt_p5, @dt_p6)',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] ([id], [email], [status]) output inserted.* values (@dt_p1, @dt_p2, @dt_p3), (@dt_p4, @dt_p5, @dt_p6)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many with default values (single row)', () => {
      let compiled = compileMssqlOperation({
        kind: 'insertMany',
        table: accounts,
        values: [{}],
      })
      assert.deepEqual(compiled, {
        text: 'insert into [accounts] default values',
        values: [],
      })
    })

    it('compile for many with default values collapses multiple empty rows to one insert', () => {
      // When all rows are empty objects, collectColumns returns [] and the
      // compiler falls back to DEFAULT VALUES — which only inserts a single row.
      // This is a known limitation shared across all adapter SQL compilers.
      let compiled = compileMssqlOperation({
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

      let compiled = compileMssqlOperation(statements[0])
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'update [accounts] set [email] = @dt_p1, [status] = @dt_p2 where (([id] = @dt_p3))',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'update [accounts] set [email] = @dt_p1 output inserted.* where (([id] = @dt_p2))',
        values: ['info@remix.run', 1],
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'update [accounts] set [email] = @dt_p1, [status] = @dt_p2 where (([status] = @dt_p3))',
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

      assert.throws(() => compileMssqlOperation(statements[0]))
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@dt_p1, @dt_p2)) as source ([status], [email]) on target.[id] = source.[id] when matched then update set target.[email] = @dt_p3 when not matched then insert ([status], [email]) values (source.[status], source.[email]);',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@dt_p1, @dt_p2)) as source ([status], [email]) on target.[id] = source.[id] when not matched then insert ([status], [email]) values (source.[status], source.[email]);',
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

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'merge [accounts] with (holdlock) as target using (values (@dt_p1, @dt_p2, @dt_p3)) as source ([id], [status], [email]) on target.[id] = source.[id] when matched then update set target.[status] = @dt_p4 when not matched then insert ([id], [status], [email]) values (source.[id], source.[status], source.[email]) output inserted.*;',
        values: [1, 'enabled', 'info@remix.run', 'disabled'],
      })
    })
  })

  describe('delete statement', () => {
    it('compile for one', async () => {
      await db.delete(accounts, 10)

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] where (([id] = @dt_p1))',
        values: [10],
      })
    })

    it('compile for many', async () => {
      await db.deleteMany(accounts, {
        where: {
          status: 'enabled',
        },
      })

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] where (([status] = @dt_p1))',
        values: ['enabled'],
      })
    })

    it('compile with output values', async () => {
      await db.query(accounts).where({ id: 10 }).delete({ returning: '*' })

      let compiled = compileMssqlOperation(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from [accounts] output deleted.* where (([id] = @dt_p1))',
        values: [10],
      })
    })
  })

  describe('raw statement', () => {
    it('compile', () => {
      let compiled = compileMssqlOperation({
        kind: 'raw',
        sql: {
          text: 'select * from accounts where id = ? and status = ?',
          values: [10, 'active'],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select * from accounts where id = @dt_p1 and status = @dt_p2',
        values: [10, 'active'],
      })
    })

    it('compile without placeholders', () => {
      let compiled = compileMssqlOperation({
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

  describe('error handling', () => {
    it('throws for unsupported statements', () => {
      assert.throws(
        () => compileMssqlOperation({ kind: 'unknown' } as never),
        /Unsupported operation kind/,
      )
    })

    it('throws for unsupported predicates', () => {
      assert.throws(
        () =>
          compileMssqlOperation({
            kind: 'select',
            table: accounts,
            select: '*',
            joins: [],
            where: [{ type: 'unknown' } as never],
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
