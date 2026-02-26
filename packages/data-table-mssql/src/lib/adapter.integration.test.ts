import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { nullable, number, string } from '@remix-run/data-schema'
import { createDatabase, createTable, eq } from '@remix-run/data-table'
import sql, { type ConnectionPool } from 'mssql'

import { runAdapterIntegrationContract } from '../../../data-table/test/adapter-integration-contract.ts'

import { createMssqlDatabaseAdapter } from './adapter.ts'

let integrationEnabled =
  process.env.DATA_TABLE_INTEGRATION === '1' && typeof process.env.DATA_TABLE_MSSQL_URL === 'string'

describe('mssql adapter integration', () => {
  let pool: ConnectionPool

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    pool = await sql.connect(process.env.DATA_TABLE_MSSQL_URL as string)

    await pool.request().query('if object_id(\'tasks\', \'U\') is not null drop table [tasks]')
    await pool.request().query('if object_id(\'projects\', \'U\') is not null drop table [projects]')
    await pool.request().query('if object_id(\'accounts\', \'U\') is not null drop table [accounts]')

    await pool.request().query(
      [
        'create table [accounts] (',
        '  [id] int primary key,',
        '  [email] nvarchar(255) not null,',
        '  [status] nvarchar(32) not null,',
        '  [nickname] nvarchar(255) null',
        ')',
      ].join('\n'),
    )

    await pool.request().query(
      [
        'create table [projects] (',
        '  [id] int primary key,',
        '  [account_id] int not null,',
        '  [name] nvarchar(255) not null,',
        '  [archived] bit not null',
        ')',
      ].join('\n'),
    )

    await pool.request().query(
      [
        'create table [tasks] (',
        '  [id] int primary key,',
        '  [project_id] int not null,',
        '  [title] nvarchar(255) not null,',
        '  [state] nvarchar(32) not null',
        ')',
      ].join('\n'),
    )
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await pool.request().query('if object_id(\'tasks\', \'U\') is not null drop table [tasks]')
    await pool.request().query('if object_id(\'projects\', \'U\') is not null drop table [projects]')
    await pool.request().query('if object_id(\'accounts\', \'U\') is not null drop table [accounts]')
    await pool.close()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createMssqlDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await pool.request().query('delete from [tasks]')
      await pool.request().query('delete from [projects]')
      await pool.request().query('delete from [accounts]')
    },
  })

  // MSSQL-specific transaction tests: The shared integration contract does not
  // verify that committed rows are visible or that rolled-back rows are discarded
  // at the driver level, so these tests confirm the mssql driver's transaction
  // semantics directly.
  let txAccounts = createTable({
    name: 'accounts',
    columns: {
      id: number(),
      email: string(),
      status: string(),
      nickname: nullable(string()),
    },
  })

  describe('transaction commit', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'persists rows inserted inside a committed transaction',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.transaction(async tx => {
          await tx.query(txAccounts).insertMany([
            { id: 1, email: 'a@test.com', status: 'active', nickname: null },
          ])
        })

        let result = await pool.request().query('select [id] from [accounts] order by [id]')
        assert.deepEqual(
          result.recordset.map((r: { id: number }) => r.id),
          [1],
          'row inserted inside committed transaction must be visible after commit',
        )
      },
    )
  })

  describe('transaction rollback', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'discards rows inserted inside a rolled-back transaction',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await assert.rejects(() =>
          db.transaction(async tx => {
            await tx.query(txAccounts).insertMany([
              { id: 2, email: 'b@test.com', status: 'active', nickname: null },
            ])
            throw new Error('forced rollback')
          }),
        )

        let result = await pool.request().query('select [id] from [accounts] order by [id]')
        assert.deepEqual(
          result.recordset.map((r: { id: number }) => r.id),
          [],
          'row inserted inside rolled-back transaction must not be visible after rollback',
        )
      },
    )
  })

  describe('transaction isolation level', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'applies the requested isolation level without error',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insertMany([
          { id: 1, email: 'a@test.com', status: 'active', nickname: null },
          { id: 2, email: 'b@test.com', status: 'active', nickname: null },
        ])

        let count = await db.transaction(
          async (tx) => tx.count(txAccounts),
          { isolationLevel: 'serializable' },
        )

        assert.equal(count, 2)
      },
    )
  })

  describe('limit and offset pagination', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'paginates results with limit and offset',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insertMany([
          { id: 1, email: 'a@test.com', status: 'active', nickname: null },
          { id: 2, email: 'b@test.com', status: 'active', nickname: null },
          { id: 3, email: 'c@test.com', status: 'active', nickname: null },
          { id: 4, email: 'd@test.com', status: 'active', nickname: null },
        ])

        let page1 = await db.query(txAccounts).orderBy('id', 'asc').limit(2).offset(0).all()

        assert.deepEqual(
          page1.map((r) => r.id),
          [1, 2],
        )

        let page2 = await db.query(txAccounts).orderBy('id', 'asc').limit(2).offset(2).all()

        assert.deepEqual(
          page2.map((r) => r.id),
          [3, 4],
        )
      },
    )
  })

  // ── Transaction option permutations ──────────────────────────────────

  describe('transaction with readOnly option', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'ignores readOnly true and completes without error',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insert({
          id: 1,
          email: 'ro@test.com',
          status: 'active',
          nickname: null,
        })

        let count = await db.transaction(
          async (tx) => tx.count(txAccounts),
          { readOnly: true },
        )

        assert.equal(count, 1)
      },
    )
  })

  describe('transaction with isolationLevel and readOnly combined', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'applies isolation level and ignores readOnly when both are set',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insert({
          id: 1,
          email: 'both@test.com',
          status: 'active',
          nickname: null,
        })

        let count = await db.transaction(
          async (tx) => tx.count(txAccounts),
          { isolationLevel: 'serializable', readOnly: true },
        )

        assert.equal(count, 1)
      },
    )
  })

  // ── Capability override tests ────────────────────────────────────────

  describe('capabilities returning: true', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'uses OUTPUT clause for insert when returning is enabled',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(
          createMssqlDatabaseAdapter(pool, { capabilities: { returning: true } }),
        )

        let created = await db.create(
          txAccounts,
          { id: 1, email: 'ret@test.com', status: 'active', nickname: null },
          { returnRow: true },
        )

        assert.equal(created.id, 1)
        assert.equal(created.email, 'ret@test.com')
      },
    )
  })

  describe('capabilities returning: false (default)', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'falls back to a SELECT after insert when returning is disabled',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        let created = await db.create(
          txAccounts,
          { id: 1, email: 'noret@test.com', status: 'active', nickname: null },
          { returnRow: true },
        )

        assert.equal(created.id, 1)
        assert.equal(created.email, 'noret@test.com')
      },
    )
  })

  describe('capabilities savepoints: true (default)', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'supports nested transactions via savepoints',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.transaction(async (outerTx) => {
          await outerTx.query(txAccounts).insert({
            id: 1,
            email: 'outer@test.com',
            status: 'active',
            nickname: null,
          })

          await outerTx
            .transaction(async (innerTx) => {
              await innerTx.query(txAccounts).insert({
                id: 2,
                email: 'inner@test.com',
                status: 'active',
                nickname: null,
              })
              throw new Error('rollback inner savepoint')
            })
            .catch(() => undefined)
        })

        let result = await pool
          .request()
          .query('select [id] from [accounts] order by [id]')
        assert.deepEqual(
          result.recordset.map((r: { id: number }) => r.id),
          [1],
          'inner savepoint rollback should discard inner row but keep outer row',
        )
      },
    )
  })

  describe('capabilities savepoints: false', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'throws when attempting nested transactions without savepoint support',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(
          createMssqlDatabaseAdapter(pool, { capabilities: { savepoints: false } }),
        )

        await assert.rejects(
          () =>
            db.transaction(async (outerTx) => {
              await outerTx.transaction(async () => undefined)
            }),
          (error: Error) => {
            assert.match(error.message, /savepoint/i)
            return true
          },
        )
      },
    )
  })

  describe('capabilities upsert: true (default)', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'performs upsert using MERGE when upsert capability is enabled',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insert({
          id: 1,
          email: 'before@test.com',
          status: 'active',
          nickname: null,
        })

        await db.query(txAccounts).upsert(
          { id: 1, email: 'after@test.com', status: 'active', nickname: null },
          { conflictTarget: ['id'] },
        )

        let rows = await db.query(txAccounts).where(eq('id', 1)).all()
        assert.equal(rows.length, 1)
        assert.equal(rows[0].email, 'after@test.com')
      },
    )
  })

  describe('capabilities upsert: false', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'throws when attempting upsert without upsert capability',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(
          createMssqlDatabaseAdapter(pool, { capabilities: { upsert: false } }),
        )

        await assert.rejects(
          () =>
            db.query(txAccounts).upsert(
              { id: 1, email: 'x@test.com', status: 'active', nickname: null },
              { conflictTarget: ['id'] },
            ),
          (error: Error) => {
            assert.match(error.message, /upsert/i)
            return true
          },
        )
      },
    )
  })

  // ── Transaction rollback with isolation level ────────────────────────

  describe('transaction rollback with isolation level', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'rolls back writes under serializable isolation',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await assert.rejects(() =>
          db.transaction(
            async (tx) => {
              await tx.query(txAccounts).insert({
                id: 1,
                email: 'rollser@test.com',
                status: 'active',
                nickname: null,
              })
              throw new Error('forced rollback')
            },
            { isolationLevel: 'serializable' },
          ),
        )

        let result = await pool.request().query('select [id] from [accounts]')
        assert.equal(result.recordset.length, 0)
      },
    )
  })
})
