import * as s from 'remix/data-schema'
import { ilike, or } from 'remix/data-table'
import { Model } from 'remix/data-model'
import type { InferModelProperties } from 'remix/data-model'

export class Book extends Model {
  static columns = {
    id: s.number(),
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
  }

  static override normalizeLookupValue(value: unknown): unknown | null {
    return parseBookId(value)
  }

  static override normalizeUpdateValues(changes: Record<string, unknown>): Record<string, unknown> {
    let updates = changes as Partial<Book>
    let filtered: Record<string, unknown> = {}
    if (updates.slug !== undefined) filtered.slug = updates.slug
    if (updates.title !== undefined) filtered.title = updates.title
    if (updates.author !== undefined) filtered.author = updates.author
    if (updates.description !== undefined) filtered.description = updates.description
    if (updates.price !== undefined) filtered.price = updates.price
    if (updates.genre !== undefined) filtered.genre = updates.genre
    if (updates.image_urls !== undefined) filtered.image_urls = updates.image_urls
    if (updates.cover_url !== undefined) filtered.cover_url = updates.cover_url
    if (updates.isbn !== undefined) filtered.isbn = updates.isbn
    if (updates.published_year !== undefined) filtered.published_year = updates.published_year
    if (updates.in_stock !== undefined) filtered.in_stock = updates.in_stock
    return filtered
  }

  static override all<self extends typeof Model>(this: self): Promise<Array<InstanceType<self>>> {
    return this.findMany({ orderBy: ['id', 'asc'] })
  }

  static getBySlug(slug: string): Promise<Book | null> {
    return this.findOne({ where: { slug } })
  }

  static getByGenre(genre: string): Promise<Book[]> {
    return this.findMany({
      where: ilike('genre', genre),
      orderBy: ['id', 'asc'],
    })
  }

  static search(query: string): Promise<Book[]> {
    let lowerQuery = '%' + query.toLowerCase() + '%'

    return this.findMany({
      where: or(
        ilike('title', lowerQuery),
        ilike('author', lowerQuery),
        ilike('description', lowerQuery),
      ),
      orderBy: ['id', 'asc'],
    })
  }

  static async getAvailableGenres(): Promise<string[]> {
    let rows = await this.query().select('genre').distinct().orderBy('genre', 'asc').all()
    return rows.map((row: any) => row.genre)
  }
}

export interface Book extends InferModelProperties<typeof Book.columns> {}

function parseBookId(id: unknown): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}
