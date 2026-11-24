import type { Database } from 'remix/data-table'
import type { Session } from 'remix/session'

import { books } from '../../data/schema.ts'
import { addToCart, removeFromCart, updateCartItem } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'

interface CartItemOptions {
  db: Database
  session: Session
  bookId: number
}

type CartError = { message: string; status: number }

export async function toggleCart({
  db,
  session,
  bookId,
  intent,
}: CartItemOptions & { intent: 'add' | 'remove' }): Promise<CartError | undefined> {
  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }

  let cart = getCurrentCart(session)
  if (intent === 'remove') {
    cart = removeFromCart(cart, book.id)
  } else if (!cart.items.some((item) => item.bookId === book.id)) {
    cart = addToCart(cart, book.id, book.slug, book.title, book.price, 1)
  }

  session.set('cart', cart)
}

export async function updateCart({
  db,
  session,
  bookId,
  quantity,
}: CartItemOptions & { quantity: number }): Promise<CartError | undefined> {
  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }

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
  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }

  session.set('cart', removeFromCart(getCurrentCart(session), bookId))
}

export async function restoreCartItem({
  db,
  session,
  bookId,
  quantity,
}: CartItemOptions & { quantity: number }): Promise<CartError | undefined> {
  let book = await db.find(books, bookId)
  if (!book) return { status: 404, message: 'Book not found.' }

  let cart = getCurrentCart(session)
  // Set the saved quantity so retrying a lost response cannot add extra copies.
  if (!updateCartItem(cart, book.id, quantity)) {
    cart = addToCart(cart, book.id, book.slug, book.title, book.price, quantity)
  }
  session.set('cart', cart)
}
