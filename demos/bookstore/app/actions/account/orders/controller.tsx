import type { Controller } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { orders, orderItemsWithBook } from '../../../data/schema.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import type { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { render } from '../../../utils/render.tsx'
import { AccountOrdersIndexPage } from './index-page.tsx'
import { AccountOrderNotFoundPage, AccountOrderShowPage } from './show-page.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    async index({ get }) {
      let db = get(Database)
      let user = getCurrentUser()
      let userOrders = await db.findMany(orders, {
        where: { user_id: user.id },
        orderBy: ['created_at', 'asc'],
        with: { items: orderItemsWithBook },
      })

      return render(<AccountOrdersIndexPage orders={userOrders} />)
    },

    async show({ get, params }) {
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
        return render(<AccountOrderNotFoundPage />, { status: 404 })
      }

      let shippingAddress = JSON.parse(order.shipping_address_json) as {
        street: string
        city: string
        state: string
        zip: string
      }

      return render(<AccountOrderShowPage order={order} shippingAddress={shippingAddress} />)
    },
  },
} satisfies Controller<typeof routes.account.orders>
