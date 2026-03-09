import { belongsTo, column as c, table, hasMany } from 'remix/data-table'
import type { TableRow, TableRowWith } from 'remix/data-table'

export const books = table({
  name: 'books',
  columns: {
    id: c.integer(),
    slug: c.text(),
    title: c.text(),
    author: c.text(),
    description: c.text(),
    price: c.decimal(10, 2),
    genre: c.text(),
    image_urls: c.text(),
    cover_url: c.text(),
    isbn: c.text(),
    published_year: c.integer(),
    in_stock: c.boolean(),
  },
  beforeWrite({ value }) {
    let next = { ...value }

    if (typeof next.slug === 'string') {
      next.slug = normalizeSlug(next.slug)
    }

    if (typeof next.title === 'string') {
      next.title = normalizeText(next.title)
    }

    if (typeof next.author === 'string') {
      next.author = normalizeText(next.author)
    }

    if (typeof next.description === 'string') {
      next.description = normalizeText(next.description)
    }

    if (typeof next.genre === 'string') {
      next.genre = normalizeText(next.genre)
    }

    if (typeof next.isbn === 'string') {
      next.isbn = normalizeText(next.isbn)
    }

    if (typeof next.cover_url === 'string' && next.cover_url.trim() === '') {
      next.cover_url = '/images/placeholder.jpg'
    }

    return { value: next }
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []
    let slug = typeof value.slug === 'string' ? normalizeSlug(value.slug) : undefined
    let title = typeof value.title === 'string' ? normalizeText(value.title) : undefined

    if (operation === 'create' && !slug) {
      issues.push({ message: 'Book slug is required.', path: ['slug'] })
    }

    if (slug !== undefined && slug.length === 0) {
      issues.push({ message: 'Book slug is required.', path: ['slug'] })
    }

    if (operation === 'create' && !title) {
      issues.push({ message: 'Book title is required.', path: ['title'] })
    }

    if (title !== undefined && title.length === 0) {
      issues.push({ message: 'Book title is required.', path: ['title'] })
    }

    if (typeof value.price === 'number' && (!Number.isFinite(value.price) || value.price < 0)) {
      issues.push({ message: 'Price must be a non-negative number.', path: ['price'] })
    }

    if (
      typeof value.published_year === 'number' &&
      (!Number.isInteger(value.published_year) || value.published_year < 0)
    ) {
      issues.push({
        message: 'Published year must be a valid positive integer.',
        path: ['published_year'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  afterRead({ value }) {
    if (typeof value.cover_url !== 'string' || value.cover_url.trim() !== '') {
      return { value }
    }

    return {
      value: {
        ...value,
        cover_url: '/images/placeholder.jpg',
      },
    }
  },
})

export const users = table({
  name: 'users',
  columns: {
    id: c.integer(),
    email: c.text(),
    password: c.text(),
    name: c.text(),
    role: c.enum(['customer', 'admin']),
    created_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (typeof next.name === 'string') {
      next.name = normalizeText(next.name)
    }

    if (typeof next.email === 'string') {
      next.email = normalizeEmail(next.email)
    }

    if (typeof next.password === 'string') {
      next.password = next.password.trim()
    }

    if (operation === 'create' && next.role === undefined) {
      next.role = 'customer'
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }

    return { value: next }
  },
  validate({ operation, value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []
    let email = typeof value.email === 'string' ? normalizeEmail(value.email) : undefined
    let name = typeof value.name === 'string' ? normalizeText(value.name) : undefined

    if (operation === 'create' && !name) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    if (name !== undefined && name.length === 0) {
      issues.push({ message: 'Name is required.', path: ['name'] })
    }

    if (operation === 'create' && !email) {
      issues.push({ message: 'Email is required.', path: ['email'] })
    }

    if (email !== undefined && !isValidEmail(email)) {
      issues.push({ message: 'Email address is invalid.', path: ['email'] })
    }

    if (
      (operation === 'create' && typeof value.password !== 'string') ||
      (typeof value.password === 'string' && value.password.length < 8)
    ) {
      issues.push({
        message: 'Password must be at least 8 characters long.',
        path: ['password'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
  afterRead({ value }) {
    if (typeof value.email !== 'string' || typeof value.name !== 'string') {
      return { value }
    }

    let email = normalizeEmail(value.email)
    let name = normalizeText(value.name)

    if (email === value.email && name === value.name) {
      return { value }
    }

    return {
      value: {
        ...value,
        email,
        name,
      },
    }
  },
})

export const orders = table({
  name: 'orders',
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    total: c.decimal(10, 2),
    status: c.enum(['pending', 'processing', 'shipped', 'delivered']),
    shipping_address_json: c.text(),
    created_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }

    if (operation === 'create' && next.status === undefined) {
      next.status = 'pending'
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = Date.now()
    }

    return { value: next }
  },
  validate({ value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []

    if (typeof value.total === 'number' && (!Number.isFinite(value.total) || value.total < 0)) {
      issues.push({ message: 'Order total must be a non-negative number.', path: ['total'] })
    }

    if (
      typeof value.shipping_address_json === 'string' &&
      !isJsonObject(value.shipping_address_json)
    ) {
      issues.push({
        message: 'Shipping address must be a valid JSON object string.',
        path: ['shipping_address_json'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
})

export const orderItems = table({
  name: 'order_items',
  primaryKey: ['order_id', 'book_id'],
  columns: {
    order_id: c.integer(),
    book_id: c.integer(),
    title: c.text(),
    unit_price: c.decimal(10, 2),
    quantity: c.integer(),
  },
  beforeWrite({ value }) {
    let next = { ...value }

    if (typeof next.title === 'string') {
      next.title = normalizeText(next.title)
    }

    return { value: next }
  },
  validate({ value }) {
    let issues: Array<{ message: string; path?: Array<string | number> }> = []

    if (
      typeof value.quantity === 'number' &&
      (!Number.isInteger(value.quantity) || value.quantity < 1)
    ) {
      issues.push({ message: 'Quantity must be an integer greater than 0.', path: ['quantity'] })
    }

    if (
      typeof value.unit_price === 'number' &&
      (!Number.isFinite(value.unit_price) || value.unit_price < 0)
    ) {
      issues.push({
        message: 'Unit price must be a non-negative number.',
        path: ['unit_price'],
      })
    }

    return issues.length > 0 ? { issues } : { value }
  },
})

export const itemsByOrder = hasMany(orders, orderItems)
export const bookForOrderItem = belongsTo(orderItems, books)
export const orderItemsWithBook = itemsByOrder
  .orderBy('book_id', 'asc')
  .with({ book: bookForOrderItem })

export const passwordResetTokens = table({
  name: 'password_reset_tokens',
  primaryKey: ['token'],
  columns: {
    token: c.text(),
    user_id: c.integer(),
    expires_at: c.integer(),
  },
})

export type Book = TableRow<typeof books>
export type User = TableRow<typeof users>
export type Order = TableRowWith<typeof orders, { items: OrderItem[] }>
export type OrderItem = TableRowWith<
  typeof itemsByOrder.targetTable,
  { book: TableRow<typeof bookForOrderItem.targetTable> | null }
>

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeText(value: string): string {
  return value.trim()
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isJsonObject(value: string): boolean {
  try {
    let parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}
