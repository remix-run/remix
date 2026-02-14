import type { TableRow, TableRowWith } from 'remix/data-table'

import { bookForOrderItem, itemsByOrder, orders, db } from './database.ts'

export interface OrderItemInput {
  bookId: number
  title: string
  price: number
  quantity: number
}

export type OrderItem = TableRowWith<
  typeof itemsByOrder.targetTable,
  { book: TableRow<typeof bookForOrderItem.targetTable> | null }
>
export type Order = TableRowWith<typeof orders, { items: OrderItem[] }>
type OrderRow = TableRow<typeof orders>

let orderItems = itemsByOrder.orderBy('book_id', 'asc').with({ book: bookForOrderItem })

export async function getAllOrders(): Promise<Order[]> {
  return db.findMany(orders, {
    orderBy: ['created_at', 'asc'],
    with: { items: orderItems },
  })
}

export async function getOrderById(id: string): Promise<Order | null> {
  let orderId = parseOrderId(id)
  if (orderId === null) {
    return null
  }

  return db.find(orders, orderId, {
    with: { items: orderItems },
  })
}

export async function getOrdersByUserId(userId: number | string): Promise<Order[]> {
  let userIdValue = parseUserId(userId)
  if (userIdValue === null) {
    return []
  }

  return db.findMany(orders, {
    where: { user_id: userIdValue },
    orderBy: ['created_at', 'asc'],
    with: { items: orderItems },
  })
}

export async function createOrder(
  user_id: number | string,
  items: OrderItemInput[],
  shipping_address_json: string,
): Promise<Order> {
  let userIdValue = parseUserId(user_id)
  if (userIdValue === null) {
    throw new Error('Invalid user id')
  }

  let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return db.transaction(async (tx) => {
    let createdOrder = await tx.create(
      orders,
      {
        user_id: userIdValue,
        total,
        status: 'pending',
        shipping_address_json,
        created_at: Date.now(),
      },
      { returnRow: true },
    )

    await tx.createMany(
      itemsByOrder.targetTable,
      items.map((item) => ({
        order_id: createdOrder.id,
        book_id: item.bookId,
        title: item.title,
        unit_price: item.price,
        quantity: item.quantity,
      })),
    )

    let order = await tx.find(orders, createdOrder.id, {
      with: { items: orderItems },
    })

    if (!order) {
      throw new Error('Failed to load created order')
    }

    return order
  })
}

export async function updateOrderStatus(
  id: number | string,
  status: OrderRow['status'],
): Promise<OrderRow | null> {
  let orderId = parseOrderId(id)
  if (orderId === null) {
    return null
  }

  return db.update(orders, orderId, { status })
}

function parseOrderId(id: number | string): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function parseUserId(id: number | string): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}
