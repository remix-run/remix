import { createController, type RouterTypes } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { CartButton } from './public/cart-button.tsx'
import { books } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'
import { toggleCart } from '../cart/cart-api.ts'

const cartButtonErrorSchema = s.object({ status: s.number(), message: s.string() })

export default createController(routes.fragments, {
  actions: {
    cartButton(context) {
      let bookId = parseId(context.params.bookId)
      let error = s.parseSafe(
        cartButtonErrorSchema,
        context.flashUntilRead.get(`cartButtonError:${bookId}`),
      )
      return renderCartButton(context, bookId, error.success ? error.value : undefined)
    },

    async cartToggle(context) {
      let { db, params, request, session } = context
      let bookId = parseId(params.bookId)
      let error =
        bookId === undefined
          ? { status: 404, message: 'Book not found.' }
          : await toggleCart({ db, session, bookId })

      if (request.headers.get('X-Remix-Frame') === 'true') {
        return renderCartButton(context, bookId, error)
      }
      if (error) {
        context.flashUntilRead.set(`cartButtonError:${bookId}`, error)
      }
      let referrer = URL.parse(request.headers.get('Referer') ?? '')
      let location =
        referrer?.origin === new URL(request.url).origin
          ? `${referrer.origin}${referrer.pathname}${referrer.search}`
          : routes.home.href()
      return redirect(location, 303)
    },
  },
})

async function renderCartButton(
  { db, render, request, session }: RouterTypes['context'],
  bookId: number | undefined,
  error?: { status: number; message: string },
): Promise<Response> {
  let book = bookId === undefined ? undefined : await db.find(books, bookId)

  if (!book) {
    return render(<p>Book not found</p>, fragmentResponseInit({ status: 404 }))
  }

  let cart = getCurrentCart(session)
  let inCart = cart.items.some((item) => item.bookId === book.id)

  return render(
    <CartButton
      inCart={inCart}
      id={book.id}
      error={error?.message}
      showErrorMessage={request.method === 'GET'}
    />,
    fragmentResponseInit({ status: error?.status ?? 200 }),
  )
}

function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return { ...init, headers }
}
