import * as assert from '@remix-run/assert'
import { after, before, it } from '@remix-run/test'

import { column } from '../src/lib/column.ts'
import type { Database, DatabaseResource } from '../src/lib/database.ts'
import { DataTableQueryError } from '../src/lib/errors.ts'
import { table, hasMany, hasManyThrough } from '../src/lib/table.ts'
import { between, eq, ilike, inList, ne } from '../src/lib/operators.ts'
import { sql } from '../src/lib/sql.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    nickname: column.text().nullable(),
  },
})

const projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
    name: column.text(),
    archived: column.boolean(),
  },
})

const tasks = table({
  name: 'tasks',
  columns: {
    id: column.integer(),
    project_id: column.integer(),
    title: column.text(),
    state: column.text(),
  },
})

const accountProjects = hasMany(accounts, projects)
const accountTasks = hasManyThrough(accounts, tasks, {
  through: accountProjects,
})

type IntegrationContractState = {
  database: DatabaseResource
  client: Database
}

const rollbackTestTransaction = Symbol('rollbackTestTransaction')

async function withRollback<result>(
  state: IntegrationContractState,
  callback: (database: Database) => Promise<result>,
): Promise<result> {
  let result: result | undefined

  try {
    await state.client.transaction(async (database) => {
      result = await callback(database)
      throw rollbackTestTransaction
    })
  } catch (error) {
    if (error !== rollbackTestTransaction) {
      throw error
    }
  }

  return result as result
}

export function runAdapterIntegrationContract(database: DatabaseResource): void {
  let state: IntegrationContractState

  before(async () => {
    let client = await database.connect()

    await client.exec(sql`
      create table accounts (
        id integer primary key,
        email text not null,
        status text not null,
        nickname text
      )
    `)
    await client.exec(sql`
      create table projects (
        id integer primary key,
        account_id integer not null,
        name text not null,
        archived boolean not null
      )
    `)
    await client.exec(sql`
      create table tasks (
        id integer primary key,
        project_id integer not null,
        title text not null,
        state text not null
      )
    `)

    state = { database, client }
  })

  after(async () => {
    await state.client.exec(sql`drop table if exists tasks`)
    await state.client.exec(sql`drop table if exists projects`)
    await state.client.exec(sql`drop table if exists accounts`)

    await state.client.close()
    await state.database.close()
  })

  it('supports joined alias select with groupBy/having', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insertMany([
        {
          id: 1,
          email: 'a@example.com',
          status: 'active',
          nickname: null,
        },
        {
          id: 2,
          email: 'b@example.com',
          status: 'inactive',
          nickname: 'bee',
        },
      ])
      await db.query(projects).insertMany([
        {
          id: 100,
          account_id: 1,
          name: 'Alpha',
          archived: false,
        },
        {
          id: 101,
          account_id: 1,
          name: 'Beta',
          archived: true,
        },
        {
          id: 200,
          account_id: 2,
          name: 'Gamma',
          archived: false,
        },
      ])

      let joined = await db
        .query(accounts)
        .join(projects, eq('accounts.id', 'projects.account_id'))
        .where(eq('projects.archived', false))
        .select({
          accountId: 'accounts.id',
          accountEmail: 'accounts.email',
          projectId: 'projects.id',
          projectName: 'projects.name',
        })
        .orderBy('projects.id', 'asc')
        .all()

      assert.deepEqual(joined, [
        {
          accountId: 1,
          accountEmail: 'a@example.com',
          projectId: 100,
          projectName: 'Alpha',
        },
        {
          accountId: 2,
          accountEmail: 'b@example.com',
          projectId: 200,
          projectName: 'Gamma',
        },
      ])

      let groupedCount = await db
        .query(accounts)
        .join(projects, eq('accounts.id', 'projects.account_id'))
        .where(eq('projects.archived', false))
        .groupBy('accounts.id')
        .having(eq('accounts.id', 1))
        .count()

      assert.equal(groupedCount, 1)
    })
  })

  it('supports eager relations with per-parent relation pagination', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
      ])
      await db.query(projects).insertMany([
        { id: 100, account_id: 1, name: 'A-1', archived: false },
        { id: 101, account_id: 1, name: 'A-2', archived: false },
        { id: 200, account_id: 2, name: 'B-1', archived: false },
        { id: 201, account_id: 2, name: 'B-2', archived: false },
      ])
      await db.query(tasks).insertMany([
        { id: 1000, project_id: 100, title: 'A1-T1', state: 'open' },
        { id: 1001, project_id: 101, title: 'A2-T1', state: 'open' },
        { id: 2000, project_id: 200, title: 'B1-T1', state: 'open' },
        { id: 2001, project_id: 201, title: 'B2-T1', state: 'open' },
      ])

      let accountRows = await db
        .query(accounts)
        .orderBy('id', 'asc')
        .with({
          projects: accountProjects.orderBy('id', 'asc').limit(1),
          tasks: accountTasks.orderBy('id', 'asc').limit(1),
        })
        .all()

      assert.equal(accountRows.length, 2)
      assert.equal(accountRows[0].projects.length, 1)
      assert.equal(accountRows[0].projects[0].id, 100)
      assert.equal(accountRows[1].projects.length, 1)
      assert.equal(accountRows[1].projects[0].id, 200)
      assert.equal(accountRows[0].tasks.length, 1)
      assert.equal(accountRows[0].tasks[0].id, 1000)
      assert.equal(accountRows[1].tasks.length, 1)
      assert.equal(accountRows[1].tasks[0].id, 2000)
    })
  })

  it('scopes update/delete writes with orderBy and limit', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insertMany([
        { id: 1, email: 'a@example.com', status: 'active', nickname: null },
        { id: 2, email: 'b@example.com', status: 'active', nickname: null },
        { id: 3, email: 'c@example.com', status: 'active', nickname: null },
      ])

      await db
        .query(accounts)
        .where({ status: 'active' })
        .orderBy('id', 'asc')
        .limit(1)
        .update({ status: 'paused' })

      await db.query(accounts).where({ status: 'active' }).orderBy('id', 'desc').limit(1).delete()

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.deepEqual(
        rows.map((row) => ({ id: row.id, status: row.status })),
        [
          { id: 1, status: 'paused' },
          { id: 2, status: 'active' },
        ],
      )
    })
  })

  it('supports transactions and nested savepoints', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insert({
        id: 1,
        email: 'a@example.com',
        status: 'active',
        nickname: null,
      })

      await db.transaction(async (outerTransaction) => {
        await outerTransaction.query(accounts).insert({
          id: 2,
          email: 'b@example.com',
          status: 'active',
          nickname: null,
        })

        await outerTransaction
          .transaction(async (innerTransaction) => {
            await innerTransaction.query(accounts).insert({
              id: 3,
              email: 'c@example.com',
              status: 'active',
              nickname: null,
            })

            throw new Error('rollback inner')
          })
          .catch(() => undefined)
      })

      await db
        .transaction(async (transactionDatabase) => {
          await transactionDatabase.query(accounts).insert({
            id: 4,
            email: 'd@example.com',
            status: 'active',
            nickname: null,
          })

          throw new Error('rollback outer')
        })
        .catch(() => undefined)

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.deepEqual(
        rows.map((row) => row.id),
        [1, 2],
      )
    })
  })

  it('handles write returning rows', async function () {
    await withRollback(state, async (db) => {
      if (!db.adapter.capabilities.returning) {
        await assert.rejects(
          async () => {
            await db.query(accounts).insertMany(
              [
                { id: 1, email: 'a@example.com', status: 'active', nickname: null },
                { id: 2, email: 'b@example.com', status: 'active', nickname: null },
              ],
              { returning: ['id', 'email'] },
            )
          },
          (error: unknown) =>
            error instanceof DataTableQueryError &&
            error.message === 'insertMany() returning is not supported by this adapter',
        )

        await db.query(accounts).insert({
          id: 2,
          email: 'b@example.com',
          status: 'active',
          nickname: null,
        })

        await assert.rejects(
          async () => {
            await db
              .query(accounts)
              .where({ id: 2 })
              .delete({ returning: ['id'] })
          },
          (error: unknown) =>
            error instanceof DataTableQueryError &&
            error.message === 'delete() returning is not supported by this adapter',
        )

        return
      }

      let inserted = await db.query(accounts).insertMany(
        [
          { id: 1, email: 'a@example.com', status: 'active', nickname: null },
          { id: 2, email: 'b@example.com', status: 'active', nickname: null },
        ],
        { returning: ['id', 'email'] },
      )

      assert.ok('rows' in inserted)
      if ('rows' in inserted) {
        assert.deepEqual(
          inserted.rows.map((row) => ({ id: row.id, email: row.email })),
          [
            { id: 1, email: 'a@example.com' },
            { id: 2, email: 'b@example.com' },
          ],
        )
      }

      let deleted = await db
        .query(accounts)
        .where({ id: 2 })
        .delete({ returning: ['id'] })

      assert.ok('rows' in deleted)
      if ('rows' in deleted) {
        assert.deepEqual(deleted.rows, [{ id: 2 }])
      }
    })
  })

  it('supports upsert with conflict target', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insert({
        id: 1,
        email: 'a@example.com',
        status: 'active',
        nickname: null,
      })

      await db.query(accounts).upsert(
        {
          id: 1,
          email: 'a@example.com',
          status: 'inactive',
          nickname: 'alpha',
        },
        { conflictTarget: ['id'] },
      )
      await db.query(accounts).upsert(
        {
          id: 2,
          email: 'b@example.com',
          status: 'active',
          nickname: null,
        },
        { conflictTarget: ['id'] },
      )

      let rows = await db.query(accounts).orderBy('id', 'asc').all()

      assert.equal(rows.length, 2)
      assert.equal(rows[0].status, 'inactive')
      assert.equal(rows[0].nickname, 'alpha')
      assert.equal(rows[1].id, 2)
    })
  })

  it('supports null and value operators in real queries', async function () {
    await withRollback(state, async (db) => {
      await db.query(accounts).insertMany([
        {
          id: 1,
          email: 'A@Example.com',
          status: 'active',
          nickname: null,
        },
        {
          id: 2,
          email: 'b@example.com',
          status: 'inactive',
          nickname: 'bee',
        },
        {
          id: 3,
          email: 'c@example.com',
          status: 'active',
          nickname: null,
        },
      ])

      let nullNickname = await db
        .query(accounts)
        .where(eq('nickname', null))
        .orderBy('id', 'asc')
        .all()
      let nonNullNickname = await db.query(accounts).where(ne('nickname', null)).all()
      let inRows = await db
        .query(accounts)
        .where(inList('id', [1, 3]))
        .orderBy('id', 'asc')
        .all()
      let betweenRows = await db
        .query(accounts)
        .where(between('id', 2, 3))
        .orderBy('id', 'asc')
        .all()
      let ilikeRows = await db
        .query(accounts)
        .where(ilike('email', '%@example.com'))
        .orderBy('id', 'asc')
        .all()

      assert.deepEqual(
        nullNickname.map((row) => row.id),
        [1, 3],
      )
      assert.equal(nonNullNickname.length, 1)
      assert.equal(nonNullNickname[0].id, 2)
      assert.deepEqual(
        inRows.map((row) => row.id),
        [1, 3],
      )
      assert.deepEqual(
        betweenRows.map((row) => row.id),
        [2, 3],
      )
      assert.deepEqual(
        ilikeRows.map((row) => row.id),
        [1, 2, 3],
      )
    })
  })
}
