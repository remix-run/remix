import { createHandlers, html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'

export const storeHandlers = createHandlers(routes.store, {
  cart() {
    return html(renderCart())
  },
  async addToCart({ request }) {
    let item = await request.json()
    return new Response(`Added "${item.title}" to cart`)
  },
  removeFromCart({ params }) {
    return new Response(`Removed item ${params.itemId} from cart`)
  },
  checkout: {
    show() {
      return html(renderCheckout())
    },
    async action({ request }) {
      let orderData = await request.json()
      return new Response(`Order placed! Total: $${orderData.total}`)
    },
  },
  orders() {
    return html(renderOrderHistory())
  },
  orderDetails({ params }) {
    return html(renderOrderDetails(params.orderId))
  },
})

function renderCart() {
  return `
    <html>
      <head><title>Shopping Cart - Bookstore</title></head>
      <body>
        <h1>🛒 Shopping Cart</h1>
        <div>
          <div>📖 The Great Novel - $19.99 <button>Remove</button></div>
          <div>📚 Programming Guide - $29.99 <button>Remove</button></div>
        </div>
        <p><strong>Total: $49.98</strong></p>
        <a href="${routes.store.checkout.show.href()}">Proceed to Checkout</a>
      </body>
    </html>
  `
}

function renderCheckout() {
  return `
    <html>
      <head><title>Checkout - Bookstore</title></head>
      <body>
        <h1>💳 Checkout</h1>
        <h2>Order Summary</h2>
        <div>📖 The Great Novel - $19.99</div>
        <div>📚 Programming Guide - $29.99</div>
        <p><strong>Total: $49.98</strong></p>
        <form>
          <h3>Payment Information</h3>
          <p><label>Card Number: <input name="cardNumber" required></label></p>
          <p><label>Name on Card: <input name="cardName" required></label></p>
          <button type="submit">Place Order</button>
        </form>
      </body>
    </html>
  `
}

function renderOrderHistory() {
  return `
    <html>
      <head><title>Order History - Bookstore</title></head>
      <body>
        <h1>📦 Order History</h1>
        <div>
          <div><a href="/orders/12345">Order #12345</a> - $49.98 - Delivered</div>
          <div><a href="/orders/12346">Order #12346</a> - $24.99 - Shipped</div>
        </div>
      </body>
    </html>
  `
}

function renderOrderDetails(orderId: string) {
  return `
    <html>
      <head><title>Order ${orderId} - Bookstore</title></head>
      <body>
        <h1>📦 Order #${orderId}</h1>
        <h2>Items</h2>
        <div>📖 The Great Novel - $19.99</div>
        <div>📚 Programming Guide - $29.99</div>
        <p><strong>Total: $49.98</strong></p>
        <p><strong>Status:</strong> Delivered</p>
      </body>
    </html>
  `
}
