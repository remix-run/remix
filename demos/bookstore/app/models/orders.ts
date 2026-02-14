import type { TableRow, TableRowWithLoaded } from 'remix/data-table'

import { bookForOrderItem, itemsByOrder, orders, db } from './database.ts'

export interface OrderItemInput {
  bookId: string
  title: string
  price: number
  quantity: number
}

export type OrderItem = TableRowWithLoaded<
  typeof itemsByOrder.targetTable,
  { book: TableRow<typeof bookForOrderItem.targetTable> | null }
>
export type Order = TableRowWithLoaded<typeof orders, { items: OrderItem[] }>
type OrderRow = TableRow<typeof orders>

let orderItems = itemsByOrder.orderBy('book_id', 'asc').with({ book: bookForOrderItem })

export async function getAllOrders(): Promise<Order[]> {
  return db.findMany(orders, {
    orderBy: ['created_at', 'asc'],
    with: { items: orderItems },
  })
}

export async function getOrderById(id: string): Promise<Order | null> {
  return db.find(orders, id, {
    with: { items: orderItems },
  })
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  return db.findMany(orders, {
    where: { user_id: userId },
    orderBy: ['created_at', 'asc'],
    with: { items: orderItems },
  })
}

export async function createOrder(
  user_id: string,
  items: OrderItemInput[],
  shipping_address_json: string,
): Promise<Order> {
  let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return db.transaction(async (tx) => {
    let count = await tx.count(orders)
    let id = String(1000 + count + 1)

    await tx.create(orders, {
      id,
      user_id,
      total,
      status: 'pending',
      shipping_address_json,
      created_at: Date.now(),
    })

    await tx.createMany(
      itemsByOrder.targetTable,
      items.map((item) => ({
        order_id: id,
        book_id: item.bookId,
        title: item.title,
        unit_price: item.price,
        quantity: item.quantity,
      })),
    )

    let order = await tx.find(orders, id, {
      with: { items: orderItems },
    })

    if (!order) {
      throw new Error('Failed to load created order')
    }

    return order
  })
}

export async function updateOrderStatus(
  id: string,
  status: OrderRow['status'],
): Promise<OrderRow | null> {
  return db.update(orders, id, { status })
}
