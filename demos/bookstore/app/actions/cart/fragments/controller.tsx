import { css } from 'remix/component'
import { createController, type RouterTypes } from 'remix/router'
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../../routes.ts'
import { getCartTotal } from '../../../utils/cart.ts'
import { getCurrentCart, getCurrentUserSafely } from '../../../utils/context.ts'
import { removeCartItem, updateCart } from '../cart-api.ts'
import { CartItems } from './public/cart-items.tsx'
import { CartItemRemoveForm, CartItemUpdateForm } from './public/schema.ts'

type CartError = { status: number; message: string; bookId?: number; submission?: FormSubmission }

const cartErrorSchema = s.object({
  status: s.number(),
  message: s.string(),
  bookId: s.optional(s.number()),
  submission: s.optional(fd.submissionSchema(CartItemUpdateForm)),
})

export default createController(routes.cart.fragments, {
  actions: {
    items(context) {
      let error = s.parseSafe(cartErrorSchema, context.flashUntilRead.get('cartError'))
      return renderCartItems(context, error.success ? error.value : undefined)
    },

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

      return mutationResponse(context, error && { ...error, bookId: submission.value.bookId })
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

      return mutationResponse(context, error && { ...error, bookId: submission.value.bookId })
    },
  },
})

function mutationResponse(context: RouterTypes['context'], error?: CartError): Response {
  if (context.request.headers.get('X-Remix-Frame') === 'true') {
    return renderCartItems(context, error)
  }
  if (error) {
    context.flashUntilRead.set('cartError', error)
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
      errorBookId={error?.bookId}
      submission={error?.submission}
    />,
    responseInit,
  )
}
