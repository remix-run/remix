import * as s from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'
import { belongsTo, createTable, hasMany } from 'remix/data-table'
import type { TableRow, TableRowWith } from 'remix/data-table'

export const books = createTable({
  name: 'books',
  columns: {
    id: coerce.number(),
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

export const users = createTable({
  name: 'users',
  columns: {
    id: coerce.number(),
    email: s.string(),
    password: s.string(),
    name: s.string(),
    role: s.enum_(['customer', 'admin']),
    created_at: s.number(),
  },
})

export const orders = createTable({
  name: 'orders',
  columns: {
    id: coerce.number(),
    user_id: coerce.number(),
    total: s.number(),
    status: s.enum_(['pending', 'processing', 'shipped', 'delivered']),
    shipping_address_json: s.string(),
    created_at: s.number(),
  },
})

export const orderItems = createTable({
  name: 'order_items',
  primaryKey: ['order_id', 'book_id'],
  columns: {
    order_id: coerce.number(),
    book_id: coerce.number(),
    title: s.string(),
    unit_price: s.number(),
    quantity: s.number(),
  },
})

export const itemsByOrder = hasMany(orders, orderItems)
export const bookForOrderItem = belongsTo(orderItems, books)
export const orderItemsWithBook = itemsByOrder
  .orderBy('book_id', 'asc')
  .with({ book: bookForOrderItem })

export const passwordResetTokens = createTable({
  name: 'password_reset_tokens',
  primaryKey: ['token'],
  columns: {
    token: s.string(),
    user_id: coerce.number(),
    expires_at: s.number(),
  },
})

export type Book = TableRow<typeof books>
export type User = TableRow<typeof users>
export type Order = TableRowWith<typeof orders, { items: OrderItem[] }>
export type OrderItem = TableRowWith<
  typeof itemsByOrder.targetTable,
  { book: TableRow<typeof bookForOrderItem.targetTable> | null }
>
