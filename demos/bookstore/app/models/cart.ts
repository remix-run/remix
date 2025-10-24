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

// Store carts by user ID
const carts = new Map<string, Cart>()

export function getCart(userId: string): Cart {
  let cart = carts.get(userId)
  if (!cart) {
    cart = { items: [] }
    carts.set(userId, cart)
  }
  return cart
}

export function addToCart(
  userId: string,
  bookId: string,
  slug: string,
  title: string,
  price: number,
  quantity: number = 1,
): Cart {
  let cart = getCart(userId)

  let existingItem = cart.items.find((item) => item.bookId === bookId)
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.items.push({ bookId, slug, title, price, quantity })
  }

  return cart
}

export function updateCartItem(userId: string, bookId: string, quantity: number): Cart | undefined {
  let cart = getCart(userId)
  let item = cart.items.find((item) => item.bookId === bookId)

  if (!item) return undefined

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.bookId !== bookId)
  } else {
    item.quantity = quantity
  }

  return cart
}

export function removeFromCart(userId: string, bookId: string): Cart {
  let cart = getCart(userId)
  cart.items = cart.items.filter((item) => item.bookId !== bookId)
  return cart
}

export function clearCart(userId: string): void {
  carts.set(userId, { items: [] })
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
