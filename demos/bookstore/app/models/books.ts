import type { TableRow } from 'remix/data-table'
import { ilike, or } from 'remix/data-table'

import { BooksTable, db } from './database.ts'

export type Book = TableRow<typeof BooksTable>

export async function getAllBooks(): Promise<Book[]> {
  return db.query(BooksTable).orderBy('id', 'asc').all()
}

export async function getBookBySlug(slug: string): Promise<Book | null> {
  return db.query(BooksTable).where({ slug }).first()
}

export async function getBookById(id: string): Promise<Book | null> {
  return db.query(BooksTable).where({ id }).first()
}

export async function getBooksByGenre(genre: string): Promise<Book[]> {
  return db.query(BooksTable).where(ilike('genre', genre)).orderBy('id', 'asc').all()
}

export async function searchBooks(query: string): Promise<Book[]> {
  let lowerQuery = '%' + query.toLowerCase() + '%'

  return db
    .query(BooksTable)
    .where(
      or(ilike('title', lowerQuery), ilike('author', lowerQuery), ilike('description', lowerQuery)),
    )
    .orderBy('id', 'asc')
    .all()
}

export async function getAvailableGenres(): Promise<string[]> {
  let rows = await db
    .query(BooksTable)
    .select('genre')
    .distinct()
    .orderBy('genre', 'asc')
    .all()

  return rows.map((row) => row.genre)
}

export async function createBook(data: Omit<Book, 'id'>): Promise<Book> {
  let count = await db.query(BooksTable).count()
  let id = String(count + 1)

  await db.query(BooksTable).insert({ id, ...data })

  let created = await getBookById(id)
  if (!created) {
    throw new Error('Failed to create book')
  }

  return created
}

export async function updateBook(id: string, data: Partial<Book>): Promise<Book | null> {
  let existing = await getBookById(id)
  if (!existing) {
    return null
  }

  let changes: Record<string, unknown> = {}
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
    await db.query(BooksTable).where({ id }).update(changes)
  }

  return getBookById(id)
}

export async function deleteBook(id: string): Promise<boolean> {
  let result = await db.query(BooksTable).where({ id }).delete()
  return result.affectedRows > 0
}
