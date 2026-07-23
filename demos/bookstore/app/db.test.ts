import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'
import { sql } from 'remix/data-table'

import { seed } from './data/seed.ts'
import { db, loadAppMigrations } from './db.ts'
import { users } from './data/schema.ts'
import { verifyPassword } from './utils/password-hash.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed })
})

describe('bookstore database seed', () => {
  it('stores verifiable password hashes for seeded users', async () => {
    let admin = await db.find(users, 1)
    let customer = await db.find(users, 2)

    assert.ok(admin)
    assert.ok(customer)
    assert.equal(admin.email, 'admin@bookstore.com')
    assert.equal(customer.email, 'customer@example.com')
    assert.notEqual(admin.password_hash, 'admin123')
    assert.notEqual(customer.password_hash, 'password123')
    assert.equal(await verifyPassword('admin123', admin.password_hash), true)
    assert.equal(await verifyPassword('password123', customer.password_hash), true)
  })

  it('does not duplicate journal entries or seed data when migrated again', async () => {
    let journalBefore = await db.exec(sql`select count(*) as count from data_table_migrations`)

    await db.migrate(await loadAppMigrations())
    await seed(db)

    let journalAfter = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let seededUsers = await db.exec(sql`select count(*) as count from users`)

    assert.deepEqual(journalAfter.rows, journalBefore.rows)
    assert.equal(Number(seededUsers.rows?.[0]?.count), 2)
  })
})
