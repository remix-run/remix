import { css } from 'remix/component'
import { createController, type RouterTypes } from 'remix/router'
import * as fd from 'remix/data-schema/experimental/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import { redirect } from 'remix/response/redirect'

import { books, type Book } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { addToCart, getCartTotal, removeFromCart } from '../../../utils/cart.ts'
import { getCurrentCart, getCurrentUserSafely } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { removeCartItem, updateCart } from '../cart-api.ts'
import { CartPage } from '../page.tsx'
import { CartButton } from './public/cart-button.tsx'
import { CartItems } from './public/cart-items.tsx'
import { CartButtonForm, CartItemRemoveForm, CartItemUpdateForm } from './public/schema.ts'

type CartError = { status: number; message: string; submission?: FormSubmission }

export default createController(routes.cart.fragments, {
  actions: {
    items: renderCartItems,

    async itemsUpdate(context) {
      let { db, formData, session } = context
      let submission = fd.parseSafe(CartItemUpdateForm, formData)
      if (!submission.success) {
        return mutationResponse(context, {
          status: 400,
          message: submission.issues[0].message,
          submission,
        })
      }
      let error = await updateCart({ db, session, ...submission.value })

      return mutationResponse(context, error)
    },

    async itemsRemove(context) {
      let { db, formData, session } = context
      let submission = fd.parseSafe(CartItemRemoveForm, formData)
      if (!submission.success) {
        return mutationResponse(context, {
          status: 400,
          message: submission.issues[0].message,
          submission,
        })
      }
      let error = await removeCartItem({ db, session, ...submission.value })

      return mutationResponse(context, error)
    },

    async cartButton(context) {
      let { db, params, render } = context
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)

      if (!book) {
        return render(<p>Book not found</p>, fragmentResponseInit({ status: 404 }))
      }

      return renderCartButton(context, book)
    },

    async cartButtonToggle(context) {
      let { db, params, formData, render, request, session } = context
      let bookId = parseId(params.bookId)
      let book = bookId === undefined ? undefined : await db.find(books, bookId)
      if (!book) {
        return render(<p>Book not found</p>, fragmentResponseInit({ status: 404 }))
      }

      let submission = fd.parseSafe(CartButtonForm, formData)
      if (!submission.success) {
        return renderCartButton(context, book, {
          status: 400,
          message: submission.issues[0].message,
        })
      }
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let cart = getCurrentCart(session)
      if (submission.value.intent === 'remove') {
        session.set('cart', removeFromCart(cart, book.id))
      } else if (!cart.items.some((item) => item.bookId === book.id)) {
        session.set('cart', addToCart(cart, book.id, book.slug, book.title, book.price, 1))
      }

      if (request.headers.get('X-Remix-Frame') === 'true') {
        return renderCartButton(context, book)
      }
      return redirect(routes.books.show.href({ slug: book.slug }), 303)
    },
  },
})

function renderCartButton(
  { render, session }: RouterTypes['context'],
  book: Book,
  error?: CartError,
): Response {
  let inCart = getCurrentCart(session).items.some((item) => item.bookId === book.id)
  return render(
    <CartButton inCart={inCart} id={book.id} error={error?.message} />,
    fragmentResponseInit({ status: error?.status ?? 200 }),
  )
}

function mutationResponse(context: RouterTypes['context'], error?: CartError): Response {
  if (context.request.headers.get('X-Remix-Frame') === 'true') {
    return renderCartItems(context, error)
  }
  if (error) {
    return context.render(<CartPage error={error.message} />, {
      status: error.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return redirect(routes.cart.index.href(), 303)
}

function renderCartItems(
  { auth, render, session }: RouterTypes['context'],
  error?: CartError,
): Response {
  let cart = getCurrentCart(session)
  let total = getCartTotal(cart)
  let user = getCurrentUserSafely(auth)
  let responseInit = {
    status: error?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  }

  if (cart.items.length === 0) {
    return render(
      <div mix={css({ marginTop: '2rem' })}>
        {error ? (
          <p
            role="alert"
            mix={css({ color: '#dc2626', textAlign: 'center', paddingBottom: '1.5rem' })}
          >
            {error.message}
          </p>
        ) : null}
        <p>Your cart is empty.</p>
        <p mix={css({ marginTop: '1rem' })}>
          <a data-rmx-prefetch="intent" href={routes.books.index.href()} class="btn">
            Browse Books
          </a>
        </p>
      </div>,
      responseInit,
    )
  }

  return render(
    <CartItems
      items={cart.items}
      total={total}
      canCheckout={!!user}
      error={error?.message}
      submission={error?.submission}
    />,
    responseInit,
  )
}

function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return { ...init, headers }
}
