import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { albums } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import { addToCart, removeFromCart } from '../../utils/cart.ts'
import { getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'

const albumIdField = f.field(s.optional(s.string()))
const albumIdSchema = f.object({
  albumId: albumIdField,
})

export default createController(routes.api, {
  actions: {
    async cartToggle({ db, formData, session }) {
      let { albumId } = s.parse(albumIdSchema, formData)
      let parsedAlbumId = parseId(albumId)
      let album = parsedAlbumId === undefined ? undefined : await db.find(albums, parsedAlbumId)
      if (!album) {
        return new Response('Album not found', { status: 404 })
      }

      let cart = getCurrentCart(session)
      let inCart = cart.items.some((item) => item.albumId === album.id)

      let next = inCart
        ? removeFromCart(cart, album.id)
        : addToCart(cart, album.id, album.slug, album.title, album.price, 1)

      session.set('cart', next)

      return new Response(null, { status: 204 })
    },
  },
})
