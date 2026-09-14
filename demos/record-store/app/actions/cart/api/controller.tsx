import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { albums } from '../../../data/schema.ts'
import { routes } from '../../../routes.ts'
import { addToCart, removeFromCart, updateCartItem } from '../../../utils/cart.ts'
import { getCurrentCart } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'

const albumIdField = f.field(s.optional(s.string()))
const quantityField = f.field(s.defaulted(s.string(), '1'))
const redirectField = f.field(s.optional(s.string()))
const cartActionSchema = f.object({
  albumId: albumIdField,
  redirect: redirectField,
})
const cartUpdateSchema = f.object({
  albumId: albumIdField,
  quantity: quantityField,
  redirect: redirectField,
})

export default createController(routes.cart.api, {
  actions: {
    async add({ db, formData, session }) {
      let { albumId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let parsedAlbumId = parseId(albumId)
      let album = parsedAlbumId === undefined ? undefined : await db.find(albums, parsedAlbumId)
      if (!album) {
        return new Response('Album not found', { status: 404 })
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

    async update({ db, formData, session }) {
      let { albumId, quantity, redirect: redirectTo } = s.parse(cartUpdateSchema, formData)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      let parsedAlbumId = parseId(albumId)
      let album = parsedAlbumId === undefined ? undefined : await db.find(albums, parsedAlbumId)
      if (!album) {
        return new Response('Album not found', { status: 404 })
      }

      let nextQuantity = parseInt(quantity, 10)
      session.set('cart', updateCartItem(getCurrentCart(session), album.id, nextQuantity))

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },

    async remove({ db, formData, session }) {
      let { albumId, redirect: redirectTo } = s.parse(cartActionSchema, formData)
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      let parsedAlbumId = parseId(albumId)
      let album = parsedAlbumId === undefined ? undefined : await db.find(albums, parsedAlbumId)
      if (!album) {
        return new Response('Album not found', { status: 404 })
      }

      session.set('cart', removeFromCart(getCurrentCart(session), album.id))

      if (redirectTo === 'none') {
        return new Response(null, { status: 204 })
      }

      return redirect(routes.cart.index.href())
    },
  },
})
