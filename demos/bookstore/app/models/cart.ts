import type { Session } from '@remix-run/session'

export interface CartItem {
  bookId: string
  slug: string
  title: string
  price: number
  quantity: number
}

export interface Cart {
  items: CartItem[]
}

// Store carts by cartId, cartId will be stored in the session
let nextCartId = 1
const carts = new Map<string, Cart>()

export function createCartIfNotExists(session: Session): Cart {
  let cartId = session.get('cartId')
  if (cartId) {
    let cart = carts.get(cartId)
    if (cart) {
      return cart
    }
  } else {
    cartId = String(nextCartId++)
    session.set('cartId', cartId)
  }

  let cart = { items: [] }
  carts.set(cartId, cart)
  return cart
}

export function getCart(cartId: string): Cart {
  let cart = carts.get(cartId)
  if (!cart) {
    throw new Error('Cart not found')
  }
  return cart
}

export function addToCart(
  cartId: string,
  bookId: string,
  slug: string,
  title: string,
  price: number,
  quantity: number = 1,
): Cart {
  let cart = getCart(cartId)

  let existingItem = cart.items.find((item) => item.bookId === bookId)
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.items.push({ bookId, slug, title, price, quantity })
  }

  return cart
}

export function updateCartItem(cartId: string, bookId: string, quantity: number): Cart | undefined {
  let cart = getCart(cartId)
  let item = cart.items.find((item) => item.bookId === bookId)

  if (!item) return undefined

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.bookId !== bookId)
  } else {
    item.quantity = quantity
  }

  return cart
}

export function removeFromCart(cartId: string, bookId: string): Cart {
  let cart = getCart(cartId)
  cart.items = cart.items.filter((item) => item.bookId !== bookId)
  return cart
}

export function clearCart(cartId: string): void {
  carts.set(cartId, { items: [] })
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
