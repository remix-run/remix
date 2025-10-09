import { routes } from '../../routes.ts'

import { getBookBySlug } from '../models/books.ts'
import { BookCard } from '../components/book-card.tsx'
import { getStorage } from './context.ts'
import { getCart } from '../models/cart.ts'
import { SESSION_ID_KEY } from '../middleware/auth.ts'

export async function resolveFrame(frameSrc: string) {
  let url = new URL(frameSrc, 'http://localhost:44100')

  // Fake delay to simulate network latency when resolving frames
  await new Promise((resolve) => setTimeout(resolve, 500))

  let bookCardMatch = routes.fragments.bookCard.match(url)
  if (bookCardMatch) {
    let slug = bookCardMatch.params.slug
    let book = getBookBySlug(slug)

    if (!book) {
      throw new Error(`Book not found: ${slug}`)
    }

    let cart = getCart(getStorage().get(SESSION_ID_KEY))
    let inCart = cart.items.some((item) => item.slug === slug)

    return <BookCard book={book} inCart={inCart} />
  }

  throw new Error(`Failed to fetch ${frameSrc}`)
}
