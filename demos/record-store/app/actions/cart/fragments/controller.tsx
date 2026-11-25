import { inList } from 'remix/data-table'
import { createController, type RouterTypes } from 'remix/router'
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'
import type { FormSubmission } from 'remix/data-schema/experimental/form'
import { redirect } from 'remix/response/redirect'

import { albums } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { getAlbumImageHref } from '../../../utils/album-images.ts'
import { getCartTotal } from '../../../utils/cart.ts'
import { getCurrentCart, getCurrentUserSafely } from '../../../utils/context.ts'
import { removeCartItem, restoreCartItem, updateCart } from '../cart-api.ts'
import { CartItems } from './public/cart-items.tsx'
import { CartItemRemoveForm, CartItemUpdateForm } from './public/schema.ts'

type CartError = { status: number; message: string; albumId?: number; submission?: FormSubmission }

const cartErrorSchema = s.object({
  status: s.number(),
  message: s.string(),
  albumId: s.optional(s.number()),
  submission: s.optional(
    s.object({
      values: s.record(s.string(), s.union([s.string(), s.boolean(), s.array(s.string())])),
      errors: s.object({
        fields: s.record(s.string(), s.array(s.string())),
        form: s.optional(s.array(s.string())),
      }),
    }),
  ),
})

export default createController(routes.cart.fragments, {
  actions: {
    items(context) {
      let error = s.parseSafe(cartErrorSchema, context.session.get('cartError'))
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

      return mutationResponse(context, error && { ...error, albumId: submission.value.albumId })
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

      return mutationResponse(context, error && { ...error, albumId: submission.value.albumId })
    },

    async itemsRestore(context) {
      let { db, formData, session } = context
      let submission = fd.parseSafe(CartItemUpdateForm, formData)
      if (!submission.success) {
        return mutationResponse(context, {
          status: 400,
          message: submission.issues[0].message,
          submission,
        })
      }
      let error = await restoreCartItem({ db, session, ...submission.value })
      return mutationResponse(context, error && { ...error, albumId: submission.value.albumId })
    },
  },
})

function mutationResponse(
  context: RouterTypes['context'],
  error?: CartError,
): Response | Promise<Response> {
  if (context.request.headers.get('X-Remix-Frame') === 'true') {
    return renderCartItems(context, error)
  }
  if (error) {
    context.session.flash('cartError', error)
  }
  return redirect(routes.cart.index.href(), 303)
}

async function renderCartItems(
  { auth, db, render, request, session }: RouterTypes['context'],
  error?: CartError,
): Promise<Response> {
  let cart = getCurrentCart(session)
  let total = getCartTotal(cart)
  let user = getCurrentUserSafely(auth)
  let showErrorMessage = request.method === 'GET'
  let responseInit = {
    status: error?.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  }

  let albumRows = await db.findMany(albums, {
    where: inList(
      'id',
      cart.items.map((item) => item.albumId),
    ),
  })
  let covers = await Promise.all(
    albumRows.map(async (album) => ({
      id: album.id,
      href: await getAlbumImageHref(album.cover_url, 'album-thumbnail'),
    })),
  )
  let thumbnails = new Map(covers.map((cover) => [cover.id, cover.href]))

  return render(
    <CartItems
      items={cart.items.map((item) => ({ ...item, thumbnailUrl: thumbnails.get(item.albumId) }))}
      total={total}
      canCheckout={!!user}
      error={error?.message}
      showErrorMessage={showErrorMessage}
      errorAlbumId={error?.albumId}
      submission={error?.submission}
    />,
    responseInit,
  )
}
