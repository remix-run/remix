import type { Database } from 'remix/data-table'
import type { Session } from 'remix/session'

import { albums } from '../../data/schema.ts'
import { addToCart, removeFromCart, updateCartItem } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'

interface CartItemOptions {
  db: Database
  session: Session
  albumId: number
}

type CartError = { message: string; status: number }

export async function toggleCart({
  db,
  session,
  albumId,
  intent,
}: CartItemOptions & { intent: 'add' | 'remove' }): Promise<CartError | undefined> {
  let album = await db.find(albums, albumId)
  if (!album) return { status: 404, message: 'Record not found.' }

  let cart = getCurrentCart(session)
  if (intent === 'remove') {
    cart = removeFromCart(cart, album.id)
  } else if (!cart.items.some((item) => item.albumId === album.id)) {
    cart = addToCart(cart, album.id, album.slug, album.title, album.price, 1)
  }

  session.set('cart', cart)
}

export async function updateCart({
  db,
  session,
  albumId,
  quantity,
}: CartItemOptions & { quantity: number }): Promise<CartError | undefined> {
  let album = await db.find(albums, albumId)
  if (!album) return { status: 404, message: 'Record not found.' }

  let next = updateCartItem(getCurrentCart(session), albumId, quantity)
  if (!next) {
    return { status: 404, message: 'That record is no longer in your cart.' }
  }

  session.set('cart', next)
}

export async function removeCartItem({
  db,
  session,
  albumId,
}: CartItemOptions): Promise<CartError | undefined> {
  let album = await db.find(albums, albumId)
  if (!album) return { status: 404, message: 'Record not found.' }

  session.set('cart', removeFromCart(getCurrentCart(session), albumId))
}

export async function restoreCartItem({
  db,
  session,
  albumId,
  quantity,
}: CartItemOptions & { quantity: number }): Promise<CartError | undefined> {
  let album = await db.find(albums, albumId)
  if (!album) return { status: 404, message: 'Record not found.' }

  let cart = getCurrentCart(session)
  // Set the saved quantity so retrying a lost response cannot add extra copies.
  if (!updateCartItem(cart, album.id, quantity)) {
    cart = addToCart(cart, album.id, album.slug, album.title, album.price, quantity)
  }
  session.set('cart', cart)
}
