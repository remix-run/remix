import { createModelRegistry } from 'remix/data-model'

import { Book } from './models/book.ts'
import { Order, OrderItem } from './models/order.ts'
import { PasswordResetToken, User } from './models/user.ts'

export const registry = createModelRegistry({
  Book,
  Order,
  OrderItem,
  PasswordResetToken,
  User,
})

export interface BoundModels extends ReturnType<typeof registry.bind> {}
