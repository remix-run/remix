import type { TableRow } from 'remix/data-table'
import { ilike, or } from 'remix/data-table'

import { books } from './database.ts'
import { getRequestDatabase } from './request-database.ts'

export type Book = TableRow<typeof books>

export async function getAllBooks(): Promise<Book[]> {
  let db = getRequestDatabase()
  return db.findMany(books, { orderBy: ['id', 'asc'] })
}

export async function getBookBySlug(slug: string): Promise<Book | null> {
  let db = getRequestDatabase()
  return db.findOne(books, { where: { slug } })
}

export async function getBookById(id: string): Promise<Book | null> {
  let bookId = parseBookId(id)
  if (bookId === null) {
    return null
  }

  let db = getRequestDatabase()
  return db.find(books, bookId)
}

export async function getBooksByGenre(genre: string): Promise<Book[]> {
  let db = getRequestDatabase()
  let rows = await db.findMany(books, {
    where: ilike('genre', genre),
    orderBy: ['id', 'asc'],
  })
  return rows
}

export async function searchBooks(query: string): Promise<Book[]> {
  let lowerQuery = '%' + query.toLowerCase() + '%'
  let db = getRequestDatabase()

  let rows = await db.findMany(books, {
    where: or(
      ilike('title', lowerQuery),
      ilike('author', lowerQuery),
      ilike('description', lowerQuery),
    ),
    orderBy: ['id', 'asc'],
  })
  return rows
}

export async function getAvailableGenres(): Promise<string[]> {
  let db = getRequestDatabase()
  let rows = await db.query(books).select('genre').distinct().orderBy('genre', 'asc').all()

  return rows.map((row) => row.genre)
}

export async function createBook(data: Omit<Book, 'id'>): Promise<Book> {
  let db = getRequestDatabase()
  return db.create(books, data, { returnRow: true })
}

export async function updateBook(id: string, data: Partial<Book>): Promise<Book | null> {
  let bookId = parseBookId(id)
  if (bookId === null) {
    return null
  }
  let db = getRequestDatabase()

  let changes: Partial<Book> = {}
  if (data.slug !== undefined) changes.slug = data.slug
  if (data.title !== undefined) changes.title = data.title
  if (data.author !== undefined) changes.author = data.author
  if (data.description !== undefined) changes.description = data.description
  if (data.price !== undefined) changes.price = data.price
  if (data.genre !== undefined) changes.genre = data.genre
  if (data.image_urls !== undefined) changes.image_urls = data.image_urls
  if (data.cover_url !== undefined) changes.cover_url = data.cover_url
  if (data.isbn !== undefined) changes.isbn = data.isbn
  if (data.published_year !== undefined) changes.published_year = data.published_year
  if (data.in_stock !== undefined) changes.in_stock = data.in_stock

  if (Object.keys(changes).length > 0) {
    return db.update(books, bookId, changes)
  }

  return getBookById(String(bookId))
}

export async function deleteBook(id: string): Promise<boolean> {
  let bookId = parseBookId(id)
  if (bookId === null) {
    return false
  }

  let db = getRequestDatabase()
  return db.delete(books, bookId)
}

function parseBookId(id: string): number | null {
  let parsed = Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}
