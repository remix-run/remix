import type { Controller } from 'remix/fetch-router'
import { css } from 'remix/component'
import type { routes } from './routes.ts'
import { CartButton } from './assets/cart-button.tsx'
import { CartItems } from './assets/cart-items.tsx'
import { getCartTotal } from './data/cart.ts'
import { books } from './data/schema.ts'
import { loadAuth } from './middleware/auth.ts'
import { getCurrentCart, getCurrentUserSafely } from './utils/context.ts'
import { parseId } from './utils/ids.ts'
import { renderFragment } from './utils/render.ts'
import { routes as appRoutes } from './routes.ts'

export default {
  middleware: [loadAuth()],
  actions: {
    async cartButton({ db, params }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return renderFragment(<p>Book not found</p>, { status: 404 })
      }

      let cart = getCurrentCart()
      let inCart = cart.items.some((item) => item.bookId === book.id)

      return renderFragment(<CartButton inCart={inCart} id={book.id} slug={book.slug} />)
    },

    cartItems() {
      let cart = getCurrentCart()
      let total = getCartTotal(cart)
      let user = getCurrentUserSafely()

      if (cart.items.length === 0) {
        return renderFragment(
          <div mix={[css({ marginTop: '2rem' })]}>
            <p>Your cart is empty.</p>
            <p mix={[css({ marginTop: '1rem' })]}>
              <a href={appRoutes.books.index.href()} class="btn">
                Browse Books
              </a>
            </p>
          </div>,
        )
      }

      return renderFragment(<CartItems items={cart.items} total={total} canCheckout={!!user} />)
    },
  },
} satisfies Controller<typeof routes.fragments>
