import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'
import { sql } from 'remix/data-table'

import { db, loadAppMigrations, loadAppSeed } from './db.ts'
import { books, users } from './data/schema.ts'
import { bookGenres } from './data/book-genres.ts'
import { verifyPassword } from './utils/password-hash.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })
})

describe('bookstore database seed', () => {
  it('distributes all 50 books across the ten supported categories', async () => {
    let catalog = await db.findMany(books)
    assert.equal(catalog.length, 50)
    assert.deepEqual([...new Set(catalog.map((book) => book.genre))].sort(), [...bookGenres].sort())
  })

  it('consolidates existing genres without changing books or orders and rolls back original genres', async () => {
    let migrations = await loadAppMigrations()
    let consolidated = await db.findMany(books, { orderBy: ['id', 'asc'] })
    await db.migrate(migrations, { direction: 'down', step: 1 })
    await db.exec(sql`
      update books set genre = case id
        when 2 then 'music'
        when 8 then 'science-fiction'
        when 9 then 'romance'
        when 12 then 'science'
        when 13 then 'poetry'
        when 14 then 'crafts'
        when 16 then 'music'
        when 18 then 'nature'
        when 22 then 'science-fiction'
        when 24 then 'thriller'
        when 25 then 'romance'
        when 27 then 'historical-fiction'
        when 28 then 'biography'
        when 29 then 'history'
        when 30 then 'science'
        when 31 then 'nature'
        when 36 then 'photography'
        when 37 then 'crafts'
        when 38 then 'crafts'
        when 39 then 'music'
        when 42 then 'poetry'
        when 44 then 'philosophy'
        when 47 then 'adventure'
        when 48 then 'horror'
        when 49 then 'sports'
        when 50 then 'technology'
        else genre
      end
    `)
    let original = await db.findMany(books, { orderBy: ['id', 'asc'] })
    assert.equal(new Set(original.map((book) => book.genre)).size, 26)
    let orderItems = await db.exec(sql`select * from order_items order by order_id, book_id`)

    await db.migrate(migrations)
    await db.migrate(migrations)

    assert.deepEqual(await db.findMany(books, { orderBy: ['id', 'asc'] }), consolidated)
    assert.deepEqual(
      (await db.exec(sql`select * from order_items order by order_id, book_id`)).rows,
      orderItems.rows,
    )
    assert.deepEqual((await db.exec(sql`pragma foreign_key_check`)).rows, [])

    await db.migrate(migrations, { direction: 'down', step: 1 })
    assert.deepEqual(await db.findMany(books, { orderBy: ['id', 'asc'] }), original)
  })

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
    let seed = await loadAppSeed()
    await seed(db)

    let journalAfter = await db.exec(sql`select count(*) as count from data_table_migrations`)
    let seededUsers = await db.exec(sql`select count(*) as count from users`)

    assert.deepEqual(journalAfter.rows, journalBefore.rows)
    assert.equal(Number(seededUsers.rows?.[0]?.count), 2)
  })
})
