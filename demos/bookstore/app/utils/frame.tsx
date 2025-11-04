import { routes } from '../../routes.ts'

import { getBookBySlug } from '../models/books.ts'
import { BookCard } from '../components/book-card.tsx'
import { getSession } from './context.ts'
import { getCart } from '../models/cart.ts'

export async function resolveFrame(frameSrc: string) {
  let url = new URL(frameSrc, 'http://localhost:44100')

  // Simulate network latency when resolving frames
  // await new Promise((resolve) => setTimeout(resolve, 500))

  let bookCardMatch = routes.fragments.bookCard.match(url)
  if (bookCardMatch) {
    let slug = bookCardMatch.params.slug
    let book = getBookBySlug(slug)

    if (!book) {
      throw new Error(`Book not found: ${slug}`)
    }

    let cartId = getSession().get('cartId')
    let cart = typeof cartId === 'string' ? getCart(cartId) : null
    let inCart = cart?.items.some((item) => item.slug === slug) === true

    return <BookCard book={book} inCart={inCart} />
  }

  throw new Error(`Failed to fetch ${frameSrc}`)
}
