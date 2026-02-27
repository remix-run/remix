import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { boolean, number, string } from '@remix-run/data-schema'
import {
  and,
  between,
  createDatabase,
  createTable,
  eq,
  gt,
  gte,
  inList,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInList,
  notNull,
  type AdapterStatement,
  type DatabaseAdapter,
  or,
} from '@remix-run/data-table'

import { compileMysqlStatement } from './sql-compiler.ts'

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
    returning: false,
  },

  execute: async (request) => {
    statements.push(request.statement)
    return {}
  },
} as DatabaseAdapter

let db = createDatabase(fakeAdapter)

describe('mysql sql-compiler', () => {
  beforeEach(() => {
    statements = []
  })

  describe('select statement', () => {
    it('compile wildcard selection', async () => {
      await db.query(accounts).all()
      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts`',
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select `accounts`.`id` as `accountId`, `accounts`.`email` as `accountEmail` from `accounts`',
        values: [],
      })
    })

    it('compile joins', async () => {
      await db.query(accounts).join(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` inner join `tasks` on `accounts`.`id` = `tasks`.`account_id`',
        values: [],
      })
    })

    it('compile left join', async () => {
      await db.query(accounts).leftJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` left join `tasks` on `accounts`.`id` = `tasks`.`account_id`',
        values: [],
      })
    })

    it('compile right join', async () => {
      await db.query(accounts).rightJoin(tasks, eq(accounts.id, tasks.account_id)).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` right join `tasks` on `accounts`.`id` = `tasks`.`account_id`',
        values: [],
      })
    })

    it('compile object where filters', async () => {
      await db.query(accounts).where({ status: 'enabled' }).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where ((`status` = ?))',
        values: ['enabled'],
      })
    })

    it('compile null where filters', async () => {
      await db.query(accounts).where({ status: null }).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where ((`status` is null))',
        values: [],
      })
    })

    it('compile predicate operators', async () => {
      await db.query(accounts).where(ne('status', 'disabled')).where(gt('id', 10)).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (`status` <> ?) and (`id` > ?)',
        values: ['disabled', 10],
      })
    })

    it('compile gte/lt/lte/between/like predicates', async () => {
      await db
        .query(accounts)
        .where(gte('id', 1))
        .where(lt('id', 20))
        .where(lte('id', 30))
        .where(between('id', 2, 9))
        .where(like('email', '%@example.com'))
        .all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (`id` >= ?) and (`id` < ?) and (`id` <= ?) and (`id` between ? and ?) and (`email` like ?)',
        values: [1, 20, 30, 2, 9, '%@example.com'],
      })
    })

    it('compile in-list predicates', async () => {
      await db
        .query(accounts)
        .where(inList('id', [1, 2]))
        .all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (`id` in (?, ?))',
        values: [1, 2],
      })
    })

    it('compile empty in-list predicates', async () => {
      await db.query(accounts).where(inList('id', [])).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (1 = 0)',
        values: [],
      })
    })

    it('compile not-in predicates', async () => {
      await db
        .query(accounts)
        .where(notInList('id', [1, 2]))
        .all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (`id` not in (?, ?))',
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where ((`accounts`.`id` = ?) and ((`accounts`.`status` = ?) or (`accounts`.`status` = ?)))',
        values: [1, 'enabled', 'disabled'],
      })
    })

    it('compile empty logical combinators', async () => {
      await db.query(accounts).where(and()).where(or()).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (1 = 1) and (1 = 0)',
        values: [],
      })
    })

    it('compile group by and having', async () => {
      await db.query(tasks).groupBy(tasks.account_id).having({ account_id: 20 }).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `tasks` group by `tasks`.`account_id` having ((`account_id` = ?))',
        values: [20],
      })
    })

    it('compile pagination', async () => {
      await db.query(accounts).offset(5).limit(10).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` limit 10 offset 5',
        values: [],
      })
    })

    it('compile distinct selection with order by', async () => {
      await db.query(accounts).distinct().orderBy('id', 'desc').all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select distinct * from `accounts` order by `id` DESC',
        values: [],
      })
    })

    it('compile boolean bindings', async () => {
      await db.query(accounts).where({ deleted: true }).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where ((`deleted` = ?))',
        values: [true],
      })
    })

    it('compile boolean predicates', async () => {
      await db.query(accounts).where(isNull(accounts.status)).where(notNull(accounts.email)).all()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select * from `accounts` where (`accounts`.`status` is null) and (`accounts`.`email` is not null)',
        values: [],
      })
    })

    it('compile wildcard segment path', () => {
      let compiled = compileMysqlStatement({
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
        text: 'select `accounts`.* as `allColumns` from `accounts`',
        values: [],
      })
    })
  })

  describe('count - exists statement', () => {
    it('compile count', async () => {
      await db.query(tasks).where({ account_id: 1 }).count()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as `count` from (select 1 from `tasks` where ((`account_id` = ?))) as `__dt_count`',
        values: [1],
      })
    })

    it('compile exists', async () => {
      await db.query(tasks).where({ account_id: 1 }).exists()

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'select count(*) as `count` from (select 1 from `tasks` where ((`account_id` = ?))) as `__dt_count`',
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` (`id`, `email`, `status`) values (?, ?, ?)',
        values: [1, 'info@remix.run', 'enabled'],
      })
    })

    it('compile for one with default values', async () => {
      await db.create(accounts, {})

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` () values ()',
        values: [],
      })
    })

    it('compile for many', async () => {
      await db.createMany(accounts, [
        { id: 1, email: 'info@remix.run', status: 'enabled' },
        { id: 2, email: 'contact@remix.run', status: 'draft' },
      ])

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` (`id`, `email`, `status`) values (?, ?, ?), (?, ?, ?)',
        values: [1, 'info@remix.run', 'enabled', 2, 'contact@remix.run', 'draft'],
      })
    })

    it('compile for many with default values', () => {
      let compiled = compileMysqlStatement({
        kind: 'insertMany',
        table: accounts,
        values: [{}, {}],
      })
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` () values ()',
        values: [],
      })
    })

    it('compile for many without data', async () => {
      await db.createMany(accounts, [])

      let compiled = compileMysqlStatement(statements[0])
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update `accounts` set `email` = ?, `status` = ? where ((`id` = ?))',
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'update `accounts` set `email` = ?, `status` = ? where ((`status` = ?))',
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

      assert.throws(() => compileMysqlStatement(statements[0]))
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` (`status`, `email`) values (?, ?) on duplicate key update `email` = ?',
        values: ['contact@remix.run', 'enabled', 'info@remix.run'],
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

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'insert into `accounts` (`status`, `email`) values (?, ?) on duplicate key update `id` = `id`',
        values: ['enabled', 'info@remix.run'],
      })
    })
  })

  describe('delete statement', () => {
    it('compile for one', async () => {
      await db.delete(accounts, 10)

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from `accounts` where ((`id` = ?))',
        values: [10],
      })
    })

    it('compile for many', async () => {
      await db.deleteMany(accounts, {
        where: {
          status: 'enabled',
        },
      })

      let compiled = compileMysqlStatement(statements[0])
      assert.deepEqual(compiled, {
        text: 'delete from `accounts` where ((`status` = ?))',
        values: ['enabled'],
      })
    })
  })

  describe('raw statement', () => {
    it('compile', () => {
      let compiled = compileMysqlStatement({
        kind: 'raw',
        sql: {
          text: 'select * from accounts where id = ? and status = ?',
          values: [10, 'active'],
        },
      })

      assert.deepEqual(compiled, {
        text: 'select * from accounts where id = ? and status = ?',
        values: [10, 'active'],
      })
    })
  })

  describe('error handling', () => {
    it('throws for unsupported statements', () => {
      assert.throws(
        () => compileMysqlStatement({ kind: 'unknown' } as never),
        /Unsupported statement kind/,
      )
    })

    it('throws for unsupported predicates', () => {
      assert.throws(
        () =>
          compileMysqlStatement({
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
