import { renderToStream } from 'remix/component/server'

import { CartButton } from '../assets/cart-button.tsx'
import { getBookById } from '../models/books.ts'
import { addToCart, removeFromCart } from '../models/cart.ts'
import { getCurrentCart } from '../utils/context.ts'
export async function cartButtonFragment({ params }: any) {
  let bookId = params.bookId ?? ''
  let book = getBookById(bookId)
  if (!book) return new Response('Book not found', { status: 404 })

  let cart = getCurrentCart()
  let inCart = cart.items.some((item) => item.bookId === book.id)

  console.log('cartButtonFragment', inCart, book.id, book.slug)
  let stream = renderToStream(<CartButton inCart={inCart} id={book.id} slug={book.slug} />, {
    onError(error) {
      console.error(error)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function toggleCart({ session, formData }: any) {
  let bookId = formData.get('bookId')?.toString() ?? ''
  let book = getBookById(bookId)
  if (!book) return new Response('Book not found', { status: 404 })

  let cart = getCurrentCart()
  let inCart = cart.items.some((item) => item.bookId === book.id)

  let next = inCart
    ? removeFromCart(cart, book.id)
    : addToCart(cart, book.id, book.slug, book.title, book.price, 1)

  session.set('cart', next)

  return new Response(null, { status: 204 })
}
