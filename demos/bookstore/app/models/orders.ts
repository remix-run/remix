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
  return db.findMany(OrdersTable, { orderBy: ['created_at', 'asc'] })
}

export async function getOrderById(id: string): Promise<Order | null> {
  return db.find(OrdersTable, id)
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  return db.findMany(OrdersTable, {
    where: { user_id: userId },
    orderBy: ['created_at', 'asc'],
  })
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

  return db.create(
    OrdersTable,
    {
      id,
      user_id,
      items_json,
      total,
      status: 'pending',
      shipping_address_json,
      created_at: Date.now(),
    },
    { returnRow: true },
  )
}

export async function updateOrderStatus(
  id: string,
  status: Order['status'],
): Promise<Order | null> {
  return db.update(OrdersTable, id, { status })
}
