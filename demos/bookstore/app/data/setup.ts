import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

import { books, orderItems, orders, users } from './schema.ts'

let dataDirectoryUrl = new URL('../../data/', import.meta.url)
let migrationsDirectoryPath = fileURLToPath(new URL('migrations/', dataDirectoryUrl))
let databaseFilePath = getDatabaseFilePath()

fs.mkdirSync(fileURLToPath(dataDirectoryUrl), { recursive: true })

if (process.env.NODE_ENV === 'test' && fs.existsSync(databaseFilePath)) {
  fs.unlinkSync(databaseFilePath)
}

let sqlite = new BetterSqlite3(databaseFilePath)
sqlite.pragma('foreign_keys = ON')
let adapter = createSqliteDatabaseAdapter(sqlite)

export let db = createDatabase(adapter)

let initializePromise: Promise<void> | null = null

export async function initializeBookstoreDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = initialize()
  }

  await initializePromise
}

async function initialize(): Promise<void> {
  let migrations = await loadMigrations(migrationsDirectoryPath)
  let migrationRunner = createMigrationRunner(adapter, migrations)
  await migrationRunner.up()

  let booksCount = await db.count(books)
  if (booksCount === 0) {
    await db.createMany(books, [
      {
        id: 1,
        slug: 'bbq',
        title: 'Ash & Smoke',
        author: 'Rusty Char-Broil',
        description: 'The perfect gift for the BBQ enthusiast in your life!',
        price: 16.99,
        genre: 'cookbook',
        image_urls: JSON.stringify(['/images/bbq-1.png', '/images/bbq-2.png', '/images/bbq-3.png']),
        cover_url: '/images/bbq-1.png',
        isbn: '978-0525559474',
        published_year: 2020,
        in_stock: true,
      },
      {
        id: 2,
        slug: 'heavy-metal',
        title: 'Heavy Metal Guitar Riffs',
        author: 'Axe Master Krush',
        description: 'The ultimate guide to heavy metal guitar riffs!',
        price: 27.0,
        genre: 'music',
        image_urls: JSON.stringify([
          '/images/heavy-metal-1.png',
          '/images/heavy-metal-2.png',
          '/images/heavy-metal-3.png',
        ]),
        cover_url: '/images/heavy-metal-1.png',
        isbn: '978-0735211292',
        published_year: 2018,
        in_stock: true,
      },
      {
        id: 3,
        slug: 'three-ways',
        title: 'Three Ways to Change Your Life',
        author: 'Wisdom Sage',
        description: 'Life-changing strategies for modern living and personal growth.',
        price: 28.99,
        genre: 'self-help',
        image_urls: JSON.stringify([
          '/images/three-ways-1.png',
          '/images/three-ways-2.png',
          '/images/three-ways-3.png',
        ]),
        cover_url: '/images/three-ways-1.png',
        isbn: '978-0061120084',
        published_year: 2021,
        in_stock: false,
      },
    ])
  }

  let usersCount = await db.count(users)
  if (usersCount === 0) {
    await db.createMany(users, [
      {
        id: 1,
        email: 'admin@bookstore.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin',
        created_at: new Date('2024-01-15').getTime(),
      },
      {
        id: 2,
        email: 'customer@example.com',
        password: 'password123',
        name: 'John Doe',
        role: 'customer',
        created_at: new Date('2024-03-01').getTime(),
      },
    ])
  }

  let ordersCount = await db.count(orders)
  if (ordersCount === 0) {
    await db.createMany(orders, [
      {
        id: 1001,
        user_id: 2,
        total: 45.98,
        status: 'delivered',
        shipping_address_json: JSON.stringify({
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          zip: '02101',
        }),
        created_at: new Date('2024-09-15').getTime(),
      },
      {
        id: 1002,
        user_id: 2,
        total: 54.0,
        status: 'shipped',
        shipping_address_json: JSON.stringify({
          street: '123 Main St',
          city: 'Boston',
          state: 'MA',
          zip: '02101',
        }),
        created_at: new Date('2024-10-01').getTime(),
      },
    ])
  }

  let orderItemsCount = await db.count(orderItems)
  if (orderItemsCount === 0) {
    await db.createMany(orderItems, [
      {
        order_id: 1001,
        book_id: 1,
        title: 'Ash & Smoke',
        unit_price: 16.99,
        quantity: 1,
      },
      {
        order_id: 1001,
        book_id: 3,
        title: 'Three Ways to Change Your Life',
        unit_price: 28.99,
        quantity: 1,
      },
      {
        order_id: 1002,
        book_id: 2,
        title: 'Heavy Metal Guitar Riffs',
        unit_price: 27.0,
        quantity: 2,
      },
    ])
  }
}

function getDatabaseFilePath(): string {
  let fileName =
    process.env.NODE_ENV === 'test'
      ? `bookstore.test.${process.pid}.${Date.now()}.sqlite`
      : 'bookstore.sqlite'

  return fileURLToPath(new URL(fileName, dataDirectoryUrl))
}
