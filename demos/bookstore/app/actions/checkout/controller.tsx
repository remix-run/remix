import type { Controller } from 'remix/fetch-router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'

import { itemsByOrder, orders, orderItemsWithBook } from '../../data/schema.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { Session } from '../../middleware/session.ts'
import { routes } from '../../routes.ts'
import { clearCart, getCartTotal } from '../../utils/cart.ts'
import { getCurrentUser, getCurrentCart } from '../../utils/context.ts'
import { parseId } from '../../utils/ids.ts'
import { render } from '../../utils/render.tsx'
import { CheckoutConfirmationPage, CheckoutOrderNotFoundPage } from './confirmation-page.tsx'
import { CheckoutPage, EmptyCheckoutPage } from './checkout-page.tsx'

const textField = f.field(s.defaulted(s.string(), ''))
const shippingAddressSchema = f.object({
  street: textField,
  city: textField,
  state: textField,
  zip: textField,
})

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      let cart = getCurrentCart()
      let total = getCartTotal(cart)

      if (cart.items.length === 0) {
        return render(<EmptyCheckoutPage />)
      }

      return render(<CheckoutPage cart={cart} total={total} />)
    },

    async action({ get }) {
      let db = get(Database)
      let session = get(Session)
      let formData = get(FormData)
      let user = getCurrentUser()
      let cart = getCurrentCart()

      if (cart.items.length === 0) {
        return redirect(routes.cart.index.href())
      }

      let shippingAddress = s.parse(shippingAddressSchema, formData)
      let total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

      let order = await db.transaction(async (tx) => {
        let createdOrder = await tx.create(
          orders,
          {
            user_id: user.id,
            total,
            shipping_address_json: JSON.stringify(shippingAddress),
          },
          { returnRow: true },
        )

        await tx.createMany(
          itemsByOrder.targetTable,
          cart.items.map((item) => ({
            order_id: createdOrder.id,
            book_id: item.bookId,
            title: item.title,
            unit_price: item.price,
            quantity: item.quantity,
          })),
        )

        let created = await tx.find(orders, createdOrder.id, {
          with: { items: orderItemsWithBook },
        })

        if (!created) {
          throw new Error('Failed to load created order')
        }

        return created
      })

      session.set('cart', clearCart())

      return redirect(routes.checkout.confirmation.href({ orderId: order.id }))
    },

    async confirmation({ get, params }) {
      let db = get(Database)
      let user = getCurrentUser()
      let orderId = parseId(params.orderId)
      let order =
        orderId === undefined
          ? undefined
          : await db.find(orders, orderId, {
              with: { items: orderItemsWithBook },
            })

      if (!order || order.user_id !== user.id) {
        return render(<CheckoutOrderNotFoundPage />, { status: 404 })
      }

      return render(<CheckoutConfirmationPage order={order} />)
    },
  },
} satisfies Controller<typeof routes.checkout>
