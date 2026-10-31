export interface CartItem {
  bookId: number
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
  bookId: number,
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

// Sets the quantity the visitor asked for rather than changing it by an amount, so sending the same
// change twice, as a retry does, leaves the cart as one send would.
export function setCartItemQuantity(
  cart: Cart,
  book: Omit<CartItem, 'quantity'>,
  quantity: number,
): Cart {
  let item = cart.items.find((item) => item.bookId === book.bookId)

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => item.bookId !== book.bookId)
  } else if (item) {
    item.quantity = quantity
  } else {
    cart.items.push({ ...book, quantity })
  }

  return cart
}

export function removeFromCart(cart: Cart, bookId: number): Cart {
  cart.items = cart.items.filter((item) => item.bookId !== bookId)
  return cart
}

export function clearCart(): Cart {
  return { items: [] }
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
