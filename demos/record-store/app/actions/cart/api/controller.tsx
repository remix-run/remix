import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { albums } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { addToCart } from '../../../utils/cart.ts'
import { getCurrentCart } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'

const albumIdField = f.field(s.optional(s.string()))
const redirectField = f.field(s.optional(s.string()))
const cartActionSchema = f.object({
  albumId: albumIdField,
  redirect: redirectField,
})

export default createController(routes.cart.api, {
  actions: {
    async add({ db, formData, session }) {
      let { albumId, redirect: redirectTo } = s.parse(cartActionSchema, formData)

      let parsedAlbumId = parseId(albumId)
      let album = parsedAlbumId === undefined ? undefined : await db.find(albums, parsedAlbumId)
      if (!album) {
        return new Response('Record not found', { status: 404 })
      }

      session.set(
        'cart',
        addToCart(getCurrentCart(session), album.id, album.slug, album.title, album.price, 1),
      )

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },
  },
})
