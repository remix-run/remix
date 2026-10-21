import * as path from 'node:path'

import type { Book } from '../data/schema.ts'
import { assets } from './assets.ts'

export async function getBookImageHref(href: string): Promise<string> {
  if (!href.startsWith('/images/') || href === '/images/placeholder.jpg') return href

  return assets.getHref(path.resolve(import.meta.dirname, '..', href.slice(1)))
}

export async function resolveBookCover(book: Book): Promise<Book> {
  return { ...book, cover_url: await getBookImageHref(book.cover_url) }
}
