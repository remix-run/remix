import { createController } from 'remix/router'

import { CartButton } from './public/cart-button.tsx'
import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'

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
  },
})

function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return { ...init, headers }
}
