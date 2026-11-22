import * as s from 'remix/data-schema'
import { max, min } from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { parts } from '../../data/schema.ts'
import { routes } from '../../routes.ts'
import {
  addCartItem,
  getCartItems,
  getCartSubtotal,
  loadCartLines,
  maxQuantity,
  removeCartItem,
  setCartItemQuantity,
} from '../cart-items.ts'
import { renderPage } from '../render-page.tsx'
import { getReturnPath } from '../return-path.ts'
import { CartPage } from './cart-page.tsx'

function quantityField(minimum: number) {
  return f.field(
    coerce
      .number()
      .refine(Number.isInteger, 'Quantity must be a whole number')
      .pipe(min(minimum), max(maxQuantity)),
  )
}

const addSchema = f.object({ partNumber: f.field(s.string()), quantity: quantityField(1) })
// A quantity of zero removes the line, matching what visitors expect from an order form.
const updateSchema = f.object({ partNumber: f.field(s.string()), quantity: quantityField(0) })
const removeSchema = f.object({ partNumber: f.field(s.string()) })

export default createController(routes.cart, {
  actions: {
    async index(context) {
      let lines = await loadCartLines(context.db, getCartItems(context.session))

      return renderPage(context, {
        title: 'Your order',
        content: <CartPage lines={lines} subtotal={getCartSubtotal(lines)} />,
        cache: 'private',
      })
    },

    async add({ db, formData, request, session }) {
      let result = s.parseSafe(addSchema, formData)
      if (!result.success) {
        return new Response('Invalid quantity', { status: 400 })
      }

      let { partNumber, quantity } = result.value
      if ((await db.findOne(parts, { where: { part_number: partNumber } })) == null) {
        return new Response('Part not found', { status: 404 })
      }

      session.set('cart', addCartItem(getCartItems(session), partNumber, quantity))
      return redirect(getReturnPath(request, routes.cart.index.href()), 303)
    },

    update({ formData, session }) {
      let result = s.parseSafe(updateSchema, formData)
      if (!result.success) return new Response('Invalid quantity', { status: 400 })

      let { partNumber, quantity } = result.value
      session.set('cart', setCartItemQuantity(getCartItems(session), partNumber, quantity))
      return redirect(routes.cart.index.href(), 303)
    },

    remove({ formData, session }) {
      let result = s.parseSafe(removeSchema, formData)
      if (!result.success) return new Response('Missing part number', { status: 400 })

      session.set('cart', removeCartItem(getCartItems(session), result.value.partNumber))
      return redirect(routes.cart.index.href(), 303)
    },
  },
})
