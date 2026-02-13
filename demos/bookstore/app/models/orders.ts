import type { TableRow } from 'remix/data-table'

import { OrdersTable, db } from './database.ts'

export interface OrderItem {
  bookId: string
  title: string
  price: number
  quantity: number
}

export type Order = TableRow<typeof OrdersTable>

export async function getAllOrders(): Promise<Order[]> {
  return db.query(OrdersTable).orderBy('created_at', 'asc').all()
}

export async function getOrderById(id: string): Promise<Order | null> {
  return db.query(OrdersTable).where({ id }).first()
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  return db
    .query(OrdersTable)
    .where({ user_id: userId })
    .orderBy('created_at', 'asc')
    .all()
}

export async function createOrder(
  user_id: string,
  items_json: string,
  shipping_address_json: string,
): Promise<Order> {
  let items = JSON.parse(items_json) as OrderItem[]
  let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  let count = await db.query(OrdersTable).count()
  let id = String(1000 + count + 1)

  await db.query(OrdersTable).insert({
    id,
    user_id,
    items_json,
    total,
    status: 'pending',
    shipping_address_json,
    created_at: Date.now(),
  })

  let created = await getOrderById(id)
  if (!created) {
    throw new Error('Failed to create order')
  }

  return created
}

export async function updateOrderStatus(
  id: string,
  status: Order['status'],
): Promise<Order | null> {
  let order = await getOrderById(id)
  if (!order) {
    return null
  }

  await db.query(OrdersTable).where({ id }).update({ status })
  return getOrderById(id)
}
