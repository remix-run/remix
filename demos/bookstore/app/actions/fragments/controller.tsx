import { createController } from 'remix/router'
import { css } from 'remix/ui'

import { CartButton } from '../../assets/cart-button.tsx'
import { CartItems } from '../../assets/cart-items.tsx'
import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCartTotal } from '../../utils/cart.ts'
import { getCurrentCart, getCurrentUserSafely } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'

export default createController(routes.fragments, {
  actions: {
    async cartButton({ db, params, render, session }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<p>Book not found</p>, fragmentResponseInit({ status: 404 }))
      }

      let cart = getCurrentCart(session)
      let inCart = cart.items.some((item) => item.bookId === book.id)

      return render(
        <CartButton inCart={inCart} id={book.id} slug={book.slug} />,
        fragmentResponseInit(),
      )
    },

    cartItems({ auth, render, session }) {
      let cart = getCurrentCart(session)
      let total = getCartTotal(cart)
      let user = getCurrentUserSafely(auth)

      if (cart.items.length === 0) {
        return render(
          <div mix={css({ marginTop: '2rem' })}>
            <p>Your cart is empty.</p>
            <p mix={css({ marginTop: '1rem' })}>
              <a href={routes.books.index.href()} class="btn">
                Browse Books
              </a>
            </p>
          </div>,
          fragmentResponseInit(),
        )
      }

      return render(
        <CartItems items={cart.items} total={total} canCheckout={!!user} />,
        fragmentResponseInit(),
      )
    },
  },
})
