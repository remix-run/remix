import { createHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { apiMiddleware } from './middleware/api.ts'
import { authMiddleware } from './middleware/auth.ts'
import { userKey } from './storage-keys.ts'

export const apiOrdersHandlers = createHandlers(
  routes.api.orders,
  [authMiddleware, apiMiddleware],
  {
    index({ url, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      let limit = parseInt(url.searchParams.get('limit') || '10')

      return new Response(
        JSON.stringify({
          orders: getUserOrders(user.id, limit),
          total: getTotalOrders(),
          limit,
        }),
      )
    },
    new() {
      return new Response(JSON.stringify({ form: 'new order form' }))
    },
    async create({ request, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      let orderData = await request.json()
      let createdOrder = createOrder(user.id, orderData)

      return new Response(JSON.stringify(createdOrder), { status: 201 })
    },
    show({ params, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      let order = getOrder(params.id, user.id)

      if (!order) {
        return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 })
      }

      return new Response(JSON.stringify(order))
    },
    edit({ params, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      let order = getOrder(params.id, user.id)
      return new Response(JSON.stringify({ form: 'edit order form', order }))
    },
    async update({ params, request, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      let updates = await request.json()
      let updatedOrder = updateOrder(params.id, user.id, updates)

      return new Response(JSON.stringify(updatedOrder))
    },
    destroy({ params, storage }) {
      let user = storage.get(userKey)
      if (!user) return new Response('Unauthorized', { status: 401 })

      cancelOrder(params.id, user.id)
      return new Response('', { status: 204 })
    },
  },
)

function getUserOrders(userId: string, limit: number) {
  return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
    id: (12345 + i).toString(),
    userId,
    total: 19.99 + i * 10,
    status: ['pending', 'shipped', 'delivered'][i % 3],
    items: [{ bookId: (i + 1).toString(), title: `Book ${i + 1}`, price: 19.99 }],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }))
}

function getTotalOrders() {
  return 12
}

function getOrder(orderId: string, userId: string) {
  return {
    id: orderId,
    userId,
    total: 49.98,
    status: 'delivered',
    items: [
      { bookId: '1', title: 'The Great Novel', price: 19.99 },
      { bookId: '2', title: 'Programming Guide', price: 29.99 },
    ],
    shippingAddress: '123 Main St, City, State 12345',
    createdAt: '2024-01-15T10:30:00Z',
    deliveredAt: '2024-01-18T14:22:00Z',
  }
}

function createOrder(userId: string, orderData: any) {
  return {
    id: Date.now().toString(),
    userId,
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
}

function updateOrder(orderId: string, userId: string, updates: any) {
  return {
    ...getOrder(orderId, userId),
    ...updates,
    updatedAt: new Date().toISOString(),
  }
}

function cancelOrder(orderId: string, userId: string) {
  return {
    id: orderId,
    userId,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  }
}
