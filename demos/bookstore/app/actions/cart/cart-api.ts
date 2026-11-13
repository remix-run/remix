import type { Database } from 'remix/data-table'
import type { Session } from 'remix/session'

import { books } from '../../data/schema.ts'
import { removeFromCart, updateCartItem } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'

interface CartItemOptions {
  db: Database
  session: Session
  bookId: number
}

type CartError = { message: string; status: number }

export async function updateCart({
  db,
  session,
  bookId,
  quantity,
}: CartItemOptions & { quantity: number }): Promise<CartError | undefined> {
  if (process.env.NODE_ENV !== 'test') {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 701)))
  }

  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }
  if (book.slug === 'three-ways') {
    return { status: 500, message: 'Couldn’t update this book. Try again.' }
  }

  let next = updateCartItem(getCurrentCart(session), bookId, quantity)
  if (!next) {
    return { status: 404, message: 'That book is no longer in your cart.' }
  }

  session.set('cart', next)
}

export async function removeCartItem({
  db,
  session,
  bookId,
}: CartItemOptions): Promise<CartError | undefined> {
  if (process.env.NODE_ENV !== 'test') {
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 701)))
  }

  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }
  if (book.slug === 'three-ways') {
    return { status: 500, message: 'Couldn’t remove this book. Try again.' }
  }

  session.set('cart', removeFromCart(getCurrentCart(session), bookId))
}
