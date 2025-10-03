import type { RequestHandler } from '@remix-run/fetch-router'
import { html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml } from './views/layout.ts'
import { getUser, getSessionId as getSessionIdFromContext } from './middleware/auth.ts'
import { setSessionCookie } from './lib/session.ts'
import { getCart, addToCart, updateCartItem, removeFromCart, getCartTotal } from './models/cart.ts'
import { getBookById } from './models/books.ts'

let cartIndexHandler: RequestHandler = (ctx) => {
  let user = getUser(ctx)
  let sessionId = getSessionIdFromContext(ctx)
  let cart = getCart(sessionId)
  let total = getCartTotal(cart)

  let cartHtml =
    cart.items.length > 0
      ? `
    <table>
      <thead>
        <tr>
          <th>Book</th>
          <th>Price</th>
          <th>Quantity</th>
          <th>Subtotal</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${cart.items
          .map(
            (item) => `
          <tr>
            <td>
              <a href="${routes.books.show.href({ slug: item.slug })}">${escapeHtml(item.title)}</a>
            </td>
            <td>$${item.price.toFixed(2)}</td>
            <td>
              <form method="POST" action="${routes.cart.api.update.href()}" style="display: inline-flex; gap: 0.5rem; align-items: center;">
                <input type="hidden" name="bookId" value="${item.bookId}">
                <input type="number" name="quantity" value="${item.quantity}" min="1" style="width: 70px;">
                <button type="submit" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">Update</button>
              </form>
            </td>
            <td>$${(item.price * item.quantity).toFixed(2)}</td>
            <td>
              <form method="POST" action="${routes.cart.api.remove.href()}" style="display: inline;">
                <input type="hidden" name="bookId" value="${item.bookId}">
                <button type="submit" class="btn btn-danger" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">Remove</button>
              </form>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: right; font-weight: bold;">Total:</td>
          <td style="font-weight: bold;">$${total.toFixed(2)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top: 2rem; display: flex; gap: 1rem;">
      <a href="${routes.books.index.href()}" class="btn btn-secondary">Continue Shopping</a>
      ${user ? `<a href="${routes.checkout.index.href()}" class="btn">Proceed to Checkout</a>` : `<a href="${routes.auth.login.href()}" class="btn">Login to Checkout</a>`}
    </div>
  `
      : `
    <p>Your cart is empty.</p>
    <p style="margin-top: 1rem;">
      <a href="${routes.books.index.href()}" class="btn">Browse Books</a>
    </p>
  `

  let content = `
    <h1>Shopping Cart</h1>
    
    <div class="card">
      ${cartHtml}
    </div>
  `

  return html(layout(content, user))
}

let cartAddHandler: RequestHandler = async (ctx) => {
  let sessionId = getSessionIdFromContext(ctx)
  let formData = await ctx.request.formData()
  let bookId = formData.get('bookId')?.toString() || ''
  let slug = formData.get('slug')?.toString() || ''

  let book = getBookById(bookId)
  if (!book) {
    return new Response('Book not found', { status: 404 })
  }

  addToCart(sessionId, book.id, book.slug, book.title, book.price, 1)

  let headers = new Headers()
  setSessionCookie(headers, sessionId)
  headers.set('Location', new URL(routes.cart.index.href(), ctx.url).href)

  return new Response(null, { status: 302, headers })
}

let cartUpdateHandler: RequestHandler = async (ctx) => {
  let sessionId = getSessionIdFromContext(ctx)
  let formData = await ctx.request.formData()
  let bookId = formData.get('bookId')?.toString() || ''
  let quantity = parseInt(formData.get('quantity')?.toString() || '1', 10)

  updateCartItem(sessionId, bookId, quantity)

  let headers = new Headers()
  setSessionCookie(headers, sessionId)
  headers.set('Location', new URL(routes.cart.index.href(), ctx.url).href)

  return new Response(null, { status: 302, headers })
}

let cartRemoveHandler: RequestHandler = async (ctx) => {
  let sessionId = getSessionIdFromContext(ctx)
  let formData = await ctx.request.formData()
  let bookId = formData.get('bookId')?.toString() || ''

  removeFromCart(sessionId, bookId)

  let headers = new Headers()
  setSessionCookie(headers, sessionId)
  headers.set('Location', new URL(routes.cart.index.href(), ctx.url).href)

  return new Response(null, { status: 302, headers })
}

export default {
  cart: {
    index: cartIndexHandler,
    api: {
      add: cartAddHandler,
      update: cartUpdateHandler,
      remove: cartRemoveHandler,
    },
  },
}
