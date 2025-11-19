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

export function isCart(value: unknown): value is Cart {
  return (
    typeof value === 'object' && value !== null && 'items' in value && Array.isArray(value.items)
  )
}

export function getCart(value: unknown): Cart {
  return isCart(value) ? value : { items: [] }
}

export function addToCart(
  cart: Cart,
  bookId: string,
  slug: string,
  title: string,
  price: number,
  quantity: number = 1,
): Cart {
  let existingItem = cart.items.find((item) => item.bookId === bookId)
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.items.push({ bookId, slug, title, price, quantity })
  }

  return cart
}

export function updateCartItem(cart: Cart, bookId: string, quantity: number): Cart | undefined {
  let item = cart.items.find((item) => item.bookId === bookId)

  if (!item) return undefined

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.bookId !== bookId)
  } else {
    item.quantity = quantity
  }

  return cart
}

export function removeFromCart(cart: Cart, bookId: string): Cart {
  cart.items = cart.items.filter((item) => item.bookId !== bookId)
  return cart
}

export function clearCart(cart: Cart): Cart {
  return { items: [] }
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
