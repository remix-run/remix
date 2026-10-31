import { createController } from 'remix/router'

import { CartButton } from './public/cart-button.tsx'
import { CartItems } from './public/cart-items.tsx'
import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart, getCurrentUserSafely } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'

export default createController(routes.fragments, {
  actions: {
    async cartButton({ db, params, render, session }) {
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<p>Book not found</p>, fragmentResponseInit({ status: 404 }))
      }

      let item = getCurrentCart(session).items.find((item) => item.bookId === book.id)

      return render(
        <CartButton
          book={{ bookId: book.id, slug: book.slug, title: book.title, price: book.price }}
          quantity={item?.quantity ?? 0}
        />,
        fragmentResponseInit(),
      )
    },

    cartItems({ auth, render, session }) {
      // Rendered even when the cart is empty, so it can show books added on other pages that
      // haven't saved yet.
      return render(
        <CartItems
          items={getCurrentCart(session).items}
          canCheckout={getCurrentUserSafely(auth) !== null}
        />,
        fragmentResponseInit(),
      )
    },
  },
})

function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return { ...init, headers }
}
