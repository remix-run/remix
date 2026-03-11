import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { column, createDatabase, table, eq } from '@remix-run/data-table'
import sql, { type ConnectionPool } from 'mssql'

import {
  resetAdapterIntegrationSchema,
  setupAdapterIntegrationSchema,
  teardownAdapterIntegrationSchema,
} from '../../../data-table/test/adapter-integration-schema.ts'
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
    await setupAdapterIntegrationSchema(async (statement) => {
      await pool.request().query(statement)
    }, 'mssql')
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    await teardownAdapterIntegrationSchema(async (statement) => {
      await pool.request().query(statement)
    }, 'mssql')
    await pool.close()
  })

  runAdapterIntegrationContract({
    integrationEnabled,
    createDatabase: () => createDatabase(createMssqlDatabaseAdapter(pool)),
    resetDatabase: async () => {
      await resetAdapterIntegrationSchema(async (statement) => {
        await pool.request().query(statement)
      }, 'mssql')
    },
  })

  // MSSQL-specific transaction tests: The shared integration contract does not
  // verify that committed rows are visible or that rolled-back rows are discarded
  // at the driver level, so these tests confirm the mssql driver's transaction
  // semantics directly.
  let txAccounts = table({
    name: 'accounts',
    columns: {
      id: column.integer(),
      email: column.text(),
      status: column.text(),
      nickname: column.text().nullable(),
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

        await db.transaction(async (tx) => {
          await tx
            .query(txAccounts)
            .insertMany([{ id: 1, email: 'a@test.com', status: 'active', nickname: null }])
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
          db.transaction(async (tx) => {
            await tx
              .query(txAccounts)
              .insertMany([{ id: 2, email: 'b@test.com', status: 'active', nickname: null }])
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

        let count = await db.transaction(async (tx) => tx.count(txAccounts), {
          isolationLevel: 'serializable',
        })

        assert.equal(count, 2)
      },
    )
  })

  describe('limit and offset pagination', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it('paginates results with limit and offset', { skip: !integrationEnabled }, async () => {
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
    })
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

        let count = await db.transaction(async (tx) => tx.count(txAccounts), { readOnly: true })

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

        let count = await db.transaction(async (tx) => tx.count(txAccounts), {
          isolationLevel: 'serializable',
          readOnly: true,
        })

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

    it('supports nested transactions via savepoints', { skip: !integrationEnabled }, async () => {
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

      let result = await pool.request().query('select [id] from [accounts] order by [id]')
      assert.deepEqual(
        result.recordset.map((r: { id: number }) => r.id),
        [1],
        'inner savepoint rollback should discard inner row but keep outer row',
      )
    })
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

        await db
          .query(txAccounts)
          .upsert(
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
            db
              .query(txAccounts)
              .upsert(
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

  // ── Data type output ─────────────────────────────────────────────────

  describe('data type output', () => {
    before(async () => {
      if (!integrationEnabled) return
      await pool
        .request()
        .query("if object_id('data_types', 'U') is not null drop table [data_types]")
      await pool
        .request()
        .query(
          [
            'create table [data_types] (',
            '  [id] int primary key,',
            '  [col_tinyint] tinyint null,',
            '  [col_smallint] smallint null,',
            '  [col_int] int null,',
            '  [col_bigint] bigint null,',
            '  [col_decimal] decimal(10,2) null,',
            '  [col_numeric] numeric(18,4) null,',
            '  [col_float] float null,',
            '  [col_real] real null,',
            '  [col_money] money null,',
            '  [col_smallmoney] smallmoney null,',
            '  [col_bit] bit null,',
            '  [col_char] char(10) null,',
            '  [col_varchar] varchar(50) null,',
            '  [col_nchar] nchar(10) null,',
            '  [col_nvarchar] nvarchar(50) null,',
            '  [col_date] date null,',
            '  [col_datetime] datetime null,',
            '  [col_datetime2] datetime2 null,',
            '  [col_uniqueidentifier] uniqueidentifier null',
            ')',
          ].join('\n'),
        )
    })

    after(async () => {
      if (!integrationEnabled) return
      await pool
        .request()
        .query("if object_id('data_types', 'U') is not null drop table [data_types]")
    })

    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [data_types]')
    })

    let dataTypes = table({
      name: 'data_types',
      columns: {
        id: column.integer(),
        col_tinyint: column.integer().nullable(),
        col_smallint: column.integer().nullable(),
        col_int: column.integer().nullable(),
        col_bigint: column.bigint().nullable(),
        col_decimal: column.decimal(10, 2).nullable(),
        col_numeric: column.decimal(18, 4).nullable(),
        col_float: column.decimal(15, 10).nullable(),
        col_real: column.decimal(7, 5).nullable(),
        col_money: column.decimal(19, 4).nullable(),
        col_smallmoney: column.decimal(10, 4).nullable(),
        col_bit: column.boolean().nullable(),
        col_char: column.text().nullable(),
        col_varchar: column.text().nullable(),
        col_nchar: column.text().nullable(),
        col_nvarchar: column.text().nullable(),
        col_date: column.date().nullable(),
        col_datetime: column.timestamp().nullable(),
        col_datetime2: column.timestamp().nullable(),
        col_uniqueidentifier: column.uuid().nullable(),
      },
    })

    it(
      'returns correct JS types for all common SQL Server column types',
      { skip: !integrationEnabled },
      async () => {
        await pool
          .request()
          .query(
            [
              'insert into [data_types] values (',
              '  1,',
              '  255, -32768, 2147483647, 9223372036854775807,',
              '  12345.67, 1234567890.1234, 3.141592653589793, 1.5,',
              '  12345.6789, 1234.5678,',
              '  1,',
              "  'hello', 'world', N'日本語', N'unicode test',",
              "  '2025-06-15', '2025-06-15 10:30:00', '2025-06-15T10:30:00.1234567',",
              "  'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'",
              ')',
            ].join('\n'),
          )

        let db = createDatabase(createMssqlDatabaseAdapter(pool))
        let rows = await db.query(dataTypes).all()
        assert.equal(rows.length, 1)
        let row = rows[0]

        // Integer types → number
        assert.equal(typeof row.col_tinyint, 'number')
        assert.equal(row.col_tinyint, 255)

        assert.equal(typeof row.col_smallint, 'number')
        assert.equal(row.col_smallint, -32768)

        assert.equal(typeof row.col_int, 'number')
        assert.equal(row.col_int, 2147483647)

        // bigint → string (mssql driver default for 64-bit integers)
        assert.equal(String(row.col_bigint), '9223372036854775807')

        // Decimal/numeric → number
        assert.equal(typeof row.col_decimal, 'number')
        assert.equal(row.col_decimal, 12345.67)

        assert.equal(typeof row.col_numeric, 'number')
        assert.equal(row.col_numeric, 1234567890.1234)

        // Float/real → number
        assert.equal(typeof row.col_float, 'number')
        assert.ok(Math.abs((row.col_float as number) - 3.141592653589793) < 1e-10)

        assert.equal(typeof row.col_real, 'number')
        assert.ok(Math.abs((row.col_real as number) - 1.5) < 1e-5)

        // Money → number
        assert.equal(typeof row.col_money, 'number')
        assert.equal(row.col_money, 12345.6789)

        assert.equal(typeof row.col_smallmoney, 'number')
        assert.equal(row.col_smallmoney, 1234.5678)

        // Bit → boolean
        assert.equal(typeof row.col_bit, 'boolean')
        assert.equal(row.col_bit, true)

        // Character types → string
        assert.equal(typeof row.col_char, 'string')
        assert.equal((row.col_char as string).trimEnd(), 'hello')

        assert.equal(typeof row.col_varchar, 'string')
        assert.equal(row.col_varchar, 'world')

        assert.equal(typeof row.col_nchar, 'string')
        assert.equal((row.col_nchar as string).trimEnd(), '日本語')

        assert.equal(typeof row.col_nvarchar, 'string')
        assert.equal(row.col_nvarchar, 'unicode test')

        // Date/time types → Date
        assert.ok(row.col_date instanceof Date)
        assert.ok(row.col_datetime instanceof Date)
        assert.ok(row.col_datetime2 instanceof Date)

        // Uniqueidentifier → string (GUID format)
        assert.equal(typeof row.col_uniqueidentifier, 'string')
        assert.match(
          (row.col_uniqueidentifier as string).toLowerCase(),
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        )
      },
    )

    it('returns null for all nullable column types', { skip: !integrationEnabled }, async () => {
      await pool.request().query('insert into [data_types] ([id]) values (1)')

      let db = createDatabase(createMssqlDatabaseAdapter(pool))
      let rows = await db.query(dataTypes).where(eq('id', 1)).all()
      assert.equal(rows.length, 1)
      let row = rows[0]

      assert.equal(row.col_tinyint, null)
      assert.equal(row.col_smallint, null)
      assert.equal(row.col_int, null)
      assert.equal(row.col_bigint, null)
      assert.equal(row.col_decimal, null)
      assert.equal(row.col_numeric, null)
      assert.equal(row.col_float, null)
      assert.equal(row.col_real, null)
      assert.equal(row.col_money, null)
      assert.equal(row.col_smallmoney, null)
      assert.equal(row.col_bit, null)
      assert.equal(row.col_char, null)
      assert.equal(row.col_varchar, null)
      assert.equal(row.col_nchar, null)
      assert.equal(row.col_nvarchar, null)
      assert.equal(row.col_date, null)
      assert.equal(row.col_datetime, null)
      assert.equal(row.col_datetime2, null)
      assert.equal(row.col_uniqueidentifier, null)
    })
  })

  // ── Data type parameter inference ────────────────────────────────────

  describe('data type parameter inference', () => {
    before(async () => {
      if (!integrationEnabled) return
      await pool
        .request()
        .query("if object_id('type_params', 'U') is not null drop table [type_params]")
      await pool
        .request()
        .query(
          [
            'create table [type_params] (',
            '  [id] int primary key,',
            '  [int_val] int null,',
            '  [float_val] float null,',
            '  [decimal_val] decimal(10,2) null,',
            '  [bit_val] bit null,',
            '  [varchar_val] varchar(50) null,',
            '  [nvarchar_val] nvarchar(50) null,',
            '  [datetime2_val] datetime2 null',
            ')',
          ].join('\n'),
        )
    })

    after(async () => {
      if (!integrationEnabled) return
      await pool
        .request()
        .query("if object_id('type_params', 'U') is not null drop table [type_params]")
    })

    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [type_params]')
    })

    let typeParams = table({
      name: 'type_params',
      columns: {
        id: column.integer(),
        int_val: column.integer().nullable(),
        float_val: column.decimal(15, 10).nullable(),
        decimal_val: column.decimal(10, 2).nullable(),
        bit_val: column.boolean().nullable(),
        varchar_val: column.text().nullable(),
        nvarchar_val: column.text().nullable(),
        datetime2_val: column.timestamp().nullable(),
      },
    })

    it(
      'roundtrips JS values through adapter insert and select',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))
        let testDate = new Date('2025-06-15T10:30:00.000Z')

        await db.query(typeParams).insert({
          id: 1,
          int_val: 42,
          float_val: 3.14,
          decimal_val: 99.95,
          bit_val: true,
          varchar_val: 'hello world',
          nvarchar_val: '日本語テスト',
          datetime2_val: testDate,
        })

        let rows = await db.query(typeParams).all()
        assert.equal(rows.length, 1)
        let row = rows[0]

        assert.equal(row.int_val, 42)
        assert.ok(Math.abs((row.float_val as number) - 3.14) < 1e-10)
        assert.equal(row.decimal_val, 99.95)
        assert.equal(row.bit_val, true)
        assert.equal(row.varchar_val, 'hello world')
        assert.equal(row.nvarchar_val, '日本語テスト')
        assert.ok(row.datetime2_val instanceof Date)
        assert.equal((row.datetime2_val as Date).toISOString(), testDate.toISOString())
      },
    )

    it(
      'roundtrips null values through adapter insert and select',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(typeParams).insert({
          id: 1,
          int_val: null,
          float_val: null,
          decimal_val: null,
          bit_val: null,
          varchar_val: null,
          nvarchar_val: null,
          datetime2_val: null,
        })

        let rows = await db.query(typeParams).where(eq('id', 1)).all()
        assert.equal(rows.length, 1)
        let row = rows[0]

        assert.equal(row.int_val, null)
        assert.equal(row.float_val, null)
        assert.equal(row.decimal_val, null)
        assert.equal(row.bit_val, null)
        assert.equal(row.varchar_val, null)
        assert.equal(row.nvarchar_val, null)
        assert.equal(row.datetime2_val, null)
      },
    )
  })

  describe('raw sql', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'returns affectedRows for raw update statements',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.exec('insert into [accounts] ([id], [email], [status]) values (1, ?, ?)', [
          'a@test.com',
          'active',
        ])
        await db.exec('insert into [accounts] ([id], [email], [status]) values (2, ?, ?)', [
          'b@test.com',
          'inactive',
        ])
        await db.exec('insert into [accounts] ([id], [email], [status]) values (3, ?, ?)', [
          'c@test.com',
          'active',
        ])

        let result = await db.exec('update [accounts] set [status] = ? where [status] = ?', [
          'disabled',
          'active',
        ])

        assert.equal(result.affectedRows, 2)
      },
    )
  })

  // ── DDL migration operations ─────────────────────────────────────────

  describe('DDL migration operations', () => {
    before(async () => {
      if (!integrationEnabled) return
      await pool.request().query("if object_id('ddl_test', 'U') is not null drop table [ddl_test]")
      await pool
        .request()
        .query("if object_id('ddl_renamed', 'U') is not null drop table [ddl_renamed]")
    })

    after(async () => {
      if (!integrationEnabled) return
      await pool.request().query("if object_id('ddl_test', 'U') is not null drop table [ddl_test]")
      await pool
        .request()
        .query("if object_id('ddl_renamed', 'U') is not null drop table [ddl_renamed]")
    })

    it(
      'creates a table, alters columns, creates/drops indexes, and renames table via DDL ops',
      { skip: !integrationEnabled },
      async () => {
        let adapter = createMssqlDatabaseAdapter(pool)

        // createTable with ifNotExists
        await adapter.migrate({
          operation: {
            kind: 'createTable',
            table: { name: 'ddl_test' },
            ifNotExists: true,
            columns: {
              id: { type: 'integer', nullable: false },
              name: { type: 'varchar', length: 100, nullable: false },
              email: { type: 'text' },
            },
            primaryKey: { name: 'ddl_test_pk', columns: ['id'] },
          },
          transaction: undefined,
        })

        let hasTable = await adapter.hasTable({ name: 'ddl_test' })
        assert.equal(hasTable, true)

        let hasIdColumn = await adapter.hasColumn({ name: 'ddl_test' }, 'id')
        assert.equal(hasIdColumn, true)

        // createIndex with ifNotExists
        await adapter.migrate({
          operation: {
            kind: 'createIndex',
            ifNotExists: true,
            index: {
              table: { name: 'ddl_test' },
              name: 'ddl_test_name_idx',
              columns: ['name'],
            },
          },
          transaction: undefined,
        })

        // idempotent — running again should not throw
        await adapter.migrate({
          operation: {
            kind: 'createIndex',
            ifNotExists: true,
            index: {
              table: { name: 'ddl_test' },
              name: 'ddl_test_name_idx',
              columns: ['name'],
            },
          },
          transaction: undefined,
        })

        // alterTable: addColumn, changeColumn with nullable: true, changeColumn with nullable: false
        await adapter.migrate({
          operation: {
            kind: 'alterTable',
            table: { name: 'ddl_test' },
            changes: [
              {
                kind: 'addColumn',
                column: 'status',
                definition: { type: 'varchar', length: 32, nullable: true },
              },
              {
                kind: 'changeColumn',
                column: 'name',
                definition: { type: 'varchar', length: 200 },
              },
              {
                kind: 'changeColumn',
                column: 'email',
                definition: { type: 'varchar', length: 320, nullable: false },
              },
            ],
          },
          transaction: undefined,
        })

        let hasStatusColumn = await adapter.hasColumn({ name: 'ddl_test' }, 'status')
        assert.equal(hasStatusColumn, true)

        // Insert a row to verify the schema change actually worked
        let db = createDatabase(createMssqlDatabaseAdapter(pool))
        let ddlTable = table({
          name: 'ddl_test',
          columns: {
            id: column.integer(),
            name: column.text(),
            email: column.text(),
            status: column.text().nullable(),
          },
        })

        await db.query(ddlTable).insert({
          id: 1,
          name: 'a'.repeat(200),
          email: 'test@example.com',
          status: null,
        })

        let rows = await db.query(ddlTable).where(eq('id', 1)).all()
        assert.equal(rows.length, 1)
        assert.equal(rows[0].name.length, 200)
        assert.equal(rows[0].status, null)

        // dropIndex
        await adapter.migrate({
          operation: {
            kind: 'dropIndex',
            table: { name: 'ddl_test' },
            name: 'ddl_test_name_idx',
            ifExists: true,
          },
          transaction: undefined,
        })

        // dropTable with ifExists (idempotent)
        await adapter.migrate({
          operation: {
            kind: 'dropTable',
            table: { name: 'ddl_test' },
            ifExists: true,
          },
          transaction: undefined,
        })

        let hasTableAfterDrop = await adapter.hasTable({ name: 'ddl_test' })
        assert.equal(hasTableAfterDrop, false)

        // idempotent — should not throw
        await adapter.migrate({
          operation: {
            kind: 'dropTable',
            table: { name: 'ddl_test' },
            ifExists: true,
          },
          transaction: undefined,
        })
      },
    )
  })

  // ── Offset without explicit orderBy ──────────────────────────────────

  describe('offset without explicit orderBy', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'returns results when offset is used without an explicit orderBy',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(createMssqlDatabaseAdapter(pool))

        await db.query(txAccounts).insertMany([
          { id: 1, email: 'a@test.com', status: 'active', nickname: null },
          { id: 2, email: 'b@test.com', status: 'active', nickname: null },
          { id: 3, email: 'c@test.com', status: 'active', nickname: null },
        ])

        let rows = await db.query(txAccounts).offset(1).all()

        assert.equal(rows.length, 2)
      },
    )
  })

  // ── Returning with update and delete ─────────────────────────────────

  describe('returning with update and delete', () => {
    beforeEach(async () => {
      if (!integrationEnabled) return
      await pool.request().query('delete from [accounts]')
    })

    it(
      'returns affected rows for update with OUTPUT clause',
      { skip: !integrationEnabled },
      async () => {
        let db = createDatabase(
          createMssqlDatabaseAdapter(pool, { capabilities: { returning: true } }),
        )

        await db.query(txAccounts).insertMany([
          { id: 1, email: 'a@test.com', status: 'active', nickname: null },
          { id: 2, email: 'b@test.com', status: 'active', nickname: null },
        ])

        let result = await db
          .query(txAccounts)
          .where(eq('status', 'active'))
          .update({ status: 'paused' }, { returning: '*' })

        assert.equal(result.affectedRows, 2)
        assert.ok('rows' in result)
        if ('rows' in result) {
          assert.equal(result.rows.length, 2)
        }
      },
    )

    it('returns deleted rows with OUTPUT clause', { skip: !integrationEnabled }, async () => {
      let db = createDatabase(
        createMssqlDatabaseAdapter(pool, { capabilities: { returning: true } }),
      )

      await db.query(txAccounts).insertMany([
        { id: 1, email: 'a@test.com', status: 'active', nickname: null },
        { id: 2, email: 'b@test.com', status: 'inactive', nickname: null },
      ])

      let result = await db
        .query(txAccounts)
        .where(eq('status', 'active'))
        .delete({ returning: '*' })

      assert.equal(result.affectedRows, 1)
      assert.ok('rows' in result)
      if ('rows' in result) {
        assert.equal(result.rows.length, 1)
        assert.equal(result.rows[0].id, 1)
      }

      let remaining = await db.query(txAccounts).all()
      assert.equal(remaining.length, 1)
      assert.equal(remaining[0].id, 2)
    })
  })
})
