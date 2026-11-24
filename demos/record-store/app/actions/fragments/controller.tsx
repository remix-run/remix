import { createController, type RouterTypes } from 'remix/router'
import * as s from 'remix/data-schema'
import * as fd from 'remix/data-schema/experimental/form'
import { redirect } from 'remix/response/redirect'

import { CartButton } from './public/cart-button.tsx'
import { albums } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'
import { toggleCart } from '../cart/cart-api.ts'

const cartButtonErrorSchema = s.object({ status: s.number(), message: s.string() })

export default createController(routes.fragments, {
  actions: {
    cartButton(context) {
      let albumId = parseId(context.params.albumId)
      let error = s.parseSafe(
        cartButtonErrorSchema,
        context.flashUntilRead.get(`cartButtonError:${albumId}`),
      )
      return renderCartButton(context, albumId, error.success ? error.value : undefined)
    },

    async cartToggle(context) {
      let { db, formData, params, request, session } = context
      let albumId = parseId(params.albumId)
      let submission = fd.parseSafe(
        fd.object({ intent: fd.text(s.union([s.literal('add'), s.literal('remove')])) }),
        formData,
      )
      let error =
        albumId === undefined
          ? { status: 404, message: 'Record not found.' }
          : !submission.success
            ? { status: 400, message: 'Invalid cart action.' }
            : await toggleCart({ db, session, albumId, intent: submission.value.intent })

      if (request.headers.get('X-Remix-Frame') === 'true') {
        return renderCartButton(context, albumId, error)
      }
      if (error) {
        // Sibling button frames can race to save the session and expire normal flashes
        // before this album's frame reads its error. Keep it until that frame reads it.
        context.flashUntilRead.set(`cartButtonError:${albumId}`, error)
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
  albumId: number | undefined,
  error?: { status: number; message: string },
): Promise<Response> {
  let album = albumId === undefined ? undefined : await db.find(albums, albumId)

  if (!album) {
    return render(<p>Record not found</p>, fragmentResponseInit({ status: 404 }))
  }

  let cart = getCurrentCart(session)
  let inCart = cart.items.some((item) => item.albumId === album.id)

  return render(
    <CartButton
      inCart={inCart}
      id={album.id}
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
