import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import BetterSqlite3 from 'better-sqlite3'
import * as s from 'remix/data-schema'
import { createDatabase, createTable, sql } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

export let BooksTable = createTable({
  name: 'books',
  columns: {
    id: s.string(),
    slug: s.string(),
    title: s.string(),
    author: s.string(),
    description: s.string(),
    price: s.number(),
    genre: s.string(),
    image_urls: s.string(),
    cover_url: s.string(),
    isbn: s.string(),
    published_year: s.number(),
    in_stock: s.boolean(),
  },
})

export let UsersTable = createTable({
  name: 'users',
  columns: {
    id: s.string(),
    email: s.string(),
    password: s.string(),
    name: s.string(),
    role: s.enum_(['customer', 'admin']),
    created_at: s.number(),
  },
})

export let OrdersTable = createTable({
  name: 'orders',
  columns: {
    id: s.string(),
    user_id: s.string(),
    items_json: s.string(),
    total: s.number(),
    status: s.enum_(['pending', 'processing', 'shipped', 'delivered']),
    shipping_address_json: s.string(),
    created_at: s.number(),
  },
})

export let PasswordResetTokensTable = createTable({
  name: 'password_reset_tokens',
  primaryKey: ['token'],
  columns: {
    token: s.string(),
    user_id: s.string(),
    expires_at: s.number(),
  },
})

let databaseFilePath = getDatabaseFilePath()

fs.mkdirSync(fileURLToPath(new URL('../../tmp/', import.meta.url)), { recursive: true })

if (process.env.NODE_ENV === 'test' && fs.existsSync(databaseFilePath)) {
  fs.unlinkSync(databaseFilePath)
}

let sqlite = new BetterSqlite3(databaseFilePath)
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
  await db.exec(sql`
    create table if not exists books (
      id text primary key,
      slug text not null unique,
      title text not null,
      author text not null,
      description text not null,
      price real not null,
      genre text not null,
      image_urls text not null,
      cover_url text not null,
      isbn text not null,
      published_year integer not null,
      in_stock integer not null
    )
  `)

  await db.exec(sql`
    create table if not exists users (
      id text primary key,
      email text not null unique,
      password text not null,
      name text not null,
      role text not null,
      created_at integer not null
    )
  `)

  await db.exec(sql`
    create table if not exists orders (
      id text primary key,
      user_id text not null,
      items_json text not null,
      total real not null,
      status text not null,
      shipping_address_json text not null,
      created_at integer not null
    )
  `)

  await db.exec(sql`
    create table if not exists password_reset_tokens (
      token text primary key,
      user_id text not null,
      expires_at integer not null
    )
  `)

  let booksCount = await db.query(BooksTable).count()
  if (booksCount === 0) {
    await db.query(BooksTable).insertMany([
      {
        id: '001',
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
        id: '002',
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
        id: '003',
        slug: 'three-ways',
        title: 'Three Ways to Change Your Life',
        author: 'Britney Spears',
        description: 'A practical guide to changing your life for the better.',
        price: 28.99,
        genre: 'self-help',
        image_urls: JSON.stringify([
          '/images/three-ways-1.png',
          '/images/three-ways-2.png',
          '/images/three-ways-3.png',
        ]),
        cover_url: '/images/three-ways-1.png',
        isbn: '978-0593135204',
        published_year: 2021,
        in_stock: true,
      },
    ])
  }

  let usersCount = await db.query(UsersTable).count()
  if (usersCount === 0) {
    await db.query(UsersTable).insertMany([
      {
        id: '1',
        email: 'admin@bookstore.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin',
        created_at: new Date('2024-01-01').getTime(),
      },
      {
        id: '2',
        email: 'customer@example.com',
        password: 'password123',
        name: 'John Doe',
        role: 'customer',
        created_at: new Date('2024-02-15').getTime(),
      },
    ])
  }

  let ordersCount = await db.query(OrdersTable).count()
  if (ordersCount === 0) {
    await db.query(OrdersTable).insertMany([
      {
        id: '1001',
        user_id: '2',
        items_json: JSON.stringify([
          { bookId: '1', title: 'The Midnight Library', price: 16.99, quantity: 1 },
          { bookId: '3', title: 'Project Hail Mary', price: 28.99, quantity: 1 },
        ]),
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
        id: '1002',
        user_id: '2',
        items_json: JSON.stringify([
          { bookId: '2', title: 'Atomic Habits', price: 27.0, quantity: 2 },
        ]),
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
}

function getDatabaseFilePath(): string {
  let tempDirectoryUrl = new URL('../../tmp/', import.meta.url)
  let fileName =
    process.env.NODE_ENV === 'test'
      ? `bookstore.test.${process.pid}.${Date.now()}.sqlite`
      : 'bookstore.sqlite'

  return fileURLToPath(new URL(fileName, tempDirectoryUrl))
}
