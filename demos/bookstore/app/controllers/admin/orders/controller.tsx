import type { Controller } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { orders, orderItemsWithBook } from '../../../data/schema.ts'
import type { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { render } from '../../../utils/render.tsx'
import { AdminOrdersIndexPage } from './index-page.tsx'
import { AdminOrderNotFoundPage, AdminOrderShowPage } from './show-page.tsx'

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allOrders = await db.findMany(orders, {
        orderBy: ['created_at', 'asc'],
        with: { items: orderItemsWithBook },
      })

      return render(<AdminOrdersIndexPage orders={allOrders} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let orderId = parseId(params.orderId)
      let order =
        orderId === undefined
          ? undefined
          : await db.find(orders, orderId, {
              with: { items: orderItemsWithBook },
            })

      if (!order) {
        return render(<AdminOrderNotFoundPage />, { status: 404 })
      }

      let shippingAddress = JSON.parse(order.shipping_address_json) as {
        street: string
        city: string
        state: string
        zip: string
      }

      return render(<AdminOrderShowPage order={order} shippingAddress={shippingAddress} />)
    },
  },
} satisfies Controller<typeof routes.admin.orders>
