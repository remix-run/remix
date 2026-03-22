import type { Controller } from 'remix/fetch-router'
import { Database, query } from 'remix/data-table'

import { orders, orderItemsWithBook } from '../../../data/schema.ts'
import type { routes } from '../../../routes.ts'
import { getCurrentUser } from '../../../utils/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { render } from '../../render.tsx'
import { AccountOrdersIndexPage } from './index-page.tsx'
import { AccountOrderNotFoundPage, AccountOrderShowPage } from './show-page.tsx'

let ordersController = {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let user = getCurrentUser()
      let userOrders = await db.exec(
        query(orders)
          .where({ user_id: user.id })
          .orderBy('created_at', 'asc')
          .with({ items: orderItemsWithBook })
          .all(),
      )

      return render(<AccountOrdersIndexPage orders={userOrders} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let user = getCurrentUser()
      let orderId = parseId(params.orderId)
      let order =
        orderId === undefined
          ? undefined
          : await db.exec(query(orders).with({ items: orderItemsWithBook }).find(orderId))

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

export default ordersController
