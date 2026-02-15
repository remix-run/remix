import * as s from 'remix/data-schema'
import { Model } from 'remix/data-model'
import type { InferModelProperties } from 'remix/data-model'

import { Book } from './book.ts'

export interface OrderItemInput {
  bookId: number
  title: string
  price: number
  quantity: number
}

export class OrderItem extends Model {
  static primaryKey = ['order_id', 'book_id'] as const
  static columns = {
    order_id: s.number(),
    book_id: s.number(),
    title: s.string(),
    unit_price: s.number(),
    quantity: s.number(),
  }
}

export class Order extends Model {
  static columns = {
    id: s.number(),
    user_id: s.number(),
    total: s.number(),
    status: s.enum_(['pending', 'processing', 'shipped', 'delivered']),
    shipping_address_json: s.string(),
    created_at: s.number(),
  }

  static override normalizeLookupValue(value: unknown): unknown | null {
    return parseOrderId(value)
  }

  static override normalizeFindOptions(
    options?: { with?: unknown },
  ): { with?: unknown } | undefined {
    if (options !== undefined) {
      return options
    }

    return {
      with: {
        items: this.getOrderItemsRelation(),
      },
    }
  }

  static override all<self extends typeof Model>(
    this: self,
  ): Promise<Array<InstanceType<self>>> {
    let orderClass = this as unknown as typeof Order

    return this.findMany({
      orderBy: ['created_at', 'asc'],
      with: {
        items: orderClass.getOrderItemsRelation(),
      },
    })
  }

  static async findByUserId(userId: unknown): Promise<Order[]> {
    let userIdValue = parseUserId(userId)
    if (userIdValue === null) {
      return []
    }

    return this.findMany({
      where: { user_id: userIdValue },
      orderBy: ['created_at', 'asc'],
      with: {
        items: this.getOrderItemsRelation(),
      },
    })
  }

  static async place(
    user_id: number | string,
    items: OrderItemInput[],
    shipping_address_json: string,
  ): Promise<Order> {
    let userIdValue = parseUserId(user_id)
    if (userIdValue === null) {
      throw new Error('Invalid user id')
    }

    let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    let database = this.db

    let orderId = await database.transaction(async (transaction) => {
      let createdOrder = await transaction.create(
        this.table,
        {
          user_id: userIdValue,
          total,
          status: 'pending',
          shipping_address_json,
          created_at: Date.now(),
        },
        { returnRow: true },
      )

      await transaction.createMany(
        OrderItem.table,
        items.map((item) => ({
          order_id: (createdOrder as Order).id,
          book_id: item.bookId,
          title: item.title,
          unit_price: item.price,
          quantity: item.quantity,
        })),
      )

      return (createdOrder as Order).id
    })

    let order = await this.find(orderId, {
      with: {
        items: this.getOrderItemsRelation(),
      },
    })

    if (!order) {
      throw new Error('Failed to load created order')
    }

    return order
  }

  static getOrderItemsRelation() {
    return this.hasMany(OrderItem).orderBy('book_id', 'asc').with({
      book: OrderItem.belongsTo(Book),
    })
  }
}

export interface OrderItem extends InferModelProperties<typeof OrderItem.columns> {
  book: Book | null
}

export interface Order extends InferModelProperties<typeof Order.columns> {
  items: OrderItem[]
}

function parseOrderId(id: unknown): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function parseUserId(id: unknown): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}
