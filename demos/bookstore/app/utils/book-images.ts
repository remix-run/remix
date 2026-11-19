import * as path from 'node:path'

import type { Book } from '../data/schema.ts'
import { assets } from './assets.ts'

export interface BookImage {
  src: string
  srcSet?: string
}

export interface BookWithCover extends Book {
  cover_srcset?: string
}

export async function getBookImageHref(
  href: string,
  transform: 'book-image-640' | 'book-thumbnail' = 'book-image-640',
): Promise<string> {
  if (!href.startsWith('/images/') || href === '/images/placeholder.jpg') return href

  return assets.getHref(path.resolve(import.meta.dirname, '..', href.slice(1)), {
    transform: [transform],
  })
}

export async function getBookImage(href: string): Promise<BookImage> {
  let src = await getBookImageHref(href)
  if (src === href) return { src }

  let candidates = await Promise.all(
    (
      [
        ['book-image-320', 320],
        ['book-image-480', 480],
        ['book-image-640', 640],
        ['book-image-768', 768],
        ['book-image-960', 960],
      ] as const
    ).map(async ([transform, width]) => {
      let url = await assets.getHref(path.resolve(import.meta.dirname, '..', href.slice(1)), {
        transform: [transform],
      })
      return `${url} ${width}w`
    }),
  )
  return { src, srcSet: candidates.join(', ') }
}

export async function resolveBookCover(book: Book): Promise<BookWithCover> {
  let image = await getBookImage(book.cover_url)
  return { ...book, cover_url: image.src, cover_srcset: image.srcSet }
}
