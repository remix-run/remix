import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import BetterSqlite3 from 'better-sqlite3'
import * as s from '@remix-run/data-schema'
import { createDatabase, getTableName, getTablePrimaryKey, sql } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

import { Model } from './model.ts'
import type { InferModelProperties } from './model.ts'
import { createModelRegistry } from './registry.ts'

class User extends Model {
  static columns = {
    id: s.number(),
    email: s.string(),
  }
}

interface User extends InferModelProperties<typeof User.columns> {}

async function createSqliteFixture() {
  let sqlite = new BetterSqlite3(':memory:')
  sqlite.pragma('foreign_keys = ON')

  let database = createDatabase(createSqliteDatabaseAdapter(sqlite))
  await database.exec(sql`
    create table users (
      id integer primary key autoincrement,
      email text not null unique
    )
  `)

  await database.create(User.table, { id: 1, email: 'admin@bookstore.com' })
  await database.create(User.table, { id: 2, email: 'customer@example.com' })

  return {
    database,
    close() {
      sqlite.close()
    },
  }
}

describe('Model', () => {
  it('infers table from model metadata', () => {
    class OrderItem extends Model {
      static primaryKey = ['order_id', 'book_id'] as const
      static columns = {
        order_id: s.number(),
        book_id: s.number(),
      }
    }

    assert.equal(getTableName(OrderItem.table), 'order_items')
    assert.deepEqual(getTablePrimaryKey(OrderItem.table), ['order_id', 'book_id'])
  })

  it('supports tableName overrides', () => {
    class AuditEntry extends Model {
      static tableName = 'custom_name'
      static columns = {
        id: s.number(),
      }
    }

    assert.equal(getTableName(AuditEntry.table), 'custom_name')
  })

  it('throws when columns metadata is missing', () => {
    class MissingColumns extends Model {}

    assert.throws(
      () => MissingColumns.table,
      /No columns defined for model "MissingColumns"\. Set MissingColumns\.columns first\./,
    )
  })

  it('applies lookup/create/update normalization hooks', async () => {
    class NormalizedUser extends Model {
      static columns = {
        id: s.number(),
        email: s.string(),
        name: s.string(),
      }

      static override normalizeLookupValue(value: unknown): unknown | null {
        let parsed = typeof value === 'number' ? value : Number(value)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null
      }

      static override normalizeCreateValues(
        values: Record<string, unknown>,
      ): Record<string, unknown> {
        let output = { ...values }
        if (typeof output.email === 'string') {
          output.email = output.email.trim().toLowerCase()
        }

        return output
      }

      static override normalizeUpdateValues(
        changes: Record<string, unknown>,
      ): Record<string, unknown> {
        let output: Record<string, unknown> = {}
        if (typeof changes.email === 'string') {
          output.email = changes.email.trim().toLowerCase()
        }
        if (typeof changes.name === 'string') {
          output.name = changes.name
        }

        return output
      }
    }

    interface NormalizedUser extends InferModelProperties<typeof NormalizedUser.columns> {}

    let sqlite = new BetterSqlite3(':memory:')
    sqlite.pragma('foreign_keys = ON')
    let database = createDatabase(createSqliteDatabaseAdapter(sqlite))
    await database.exec(sql`
      create table normalized_users (
        id integer primary key autoincrement,
        email text not null,
        name text not null
      )
    `)

    let registry = createModelRegistry({ NormalizedUser })
    let models = registry.bind(database)

    try {
      let invalidLookup = await models.NormalizedUser.find('not-a-number')
      assert.equal(invalidLookup, null)

      let created = await models.NormalizedUser.create({
        email: '  ADMIN@BOOKSTORE.COM  ',
        name: 'Admin',
      })
      assert.equal(created.email, 'admin@bookstore.com')

      let updated = await models.NormalizedUser.update(String(created.id), {
        email: 'UPDATED@BOOKSTORE.COM',
        ignored: 'value',
      })
      assert.ok(updated)
      assert.equal(updated.email, 'updated@bookstore.com')

      let unchanged = await models.NormalizedUser.update(String(created.id), { ignored: true })
      assert.ok(unchanged)
      assert.equal(unchanged.id, created.id)

      let deleted = await models.NormalizedUser.delete('NaN')
      assert.equal(deleted, false)
    } finally {
      sqlite.close()
    }
  })

  it('hydrates model instances for bound CRUD operations', async () => {
    let fixture = await createSqliteFixture()
    let registry = createModelRegistry({ User })
    let models = registry.bind(fixture.database)

    try {
      let user = await models.User.find(1)
      assert.ok(user)
      assert.ok(user instanceof models.User)
      assert.equal(user.id, 1)

      let users = await models.User.findMany({ orderBy: ['id', 'asc'] })
      assert.equal(users.length, 2)
      assert.ok(users[0] instanceof models.User)

      let created = await models.User.create({ email: 'new@example.com' })
      assert.ok(created instanceof models.User)
      assert.equal(created.email, 'new@example.com')

      let updated = await models.User.update(1, { email: 'updated@example.com' })
      assert.ok(updated)
      assert.equal(updated.email, 'updated@example.com')

      let deleted = await models.User.destroy(1)
      assert.equal(deleted, true)

      let deletedWithAlias = await models.User.delete(1)
      assert.equal(deletedWithAlias, false)
    } finally {
      fixture.close()
    }
  })

  it('binds a model class with Model.bind(database)', async () => {
    let fixture = await createSqliteFixture()

    try {
      let BoundUser = User.bind(fixture.database)
      assert.notEqual(BoundUser, User)
      assert.equal(getTableName(BoundUser.table), 'users')

      let user = await BoundUser.find(1)
      assert.ok(user)
      assert.ok(user instanceof BoundUser)
      assert.ok(user instanceof User)
    } finally {
      fixture.close()
    }
  })

  it('throws when calling static methods on an unbound model', async () => {
    await assert.rejects(
      async () => User.find(1),
      /No database bound for model "User"\. Use modelRegistry\.bind\(database\)/,
    )
  })
})

describe('createModelRegistry', () => {
  it('returns a registry object with a bind method', () => {
    let registry = createModelRegistry({ User })
    assert.deepEqual(Object.keys(registry), ['bind'])
  })
})
