export interface OrderItem {
  bookId: string
  title: string
  price: number
  quantity: number
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  shippingAddress: {
    street: string
    city: string
    state: string
    zip: string
  }
  createdAt: Date
}

let ordersData: Order[] = [
  {
    id: '1001',
    userId: '2',
    items: [
      { bookId: '1', title: 'The Midnight Library', price: 16.99, quantity: 1 },
      { bookId: '3', title: 'Project Hail Mary', price: 28.99, quantity: 1 },
    ],
    total: 45.98,
    status: 'delivered',
    shippingAddress: {
      street: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    },
    createdAt: new Date('2024-09-15'),
  },
  {
    id: '1002',
    userId: '2',
    items: [{ bookId: '2', title: 'Atomic Habits', price: 27.0, quantity: 2 }],
    total: 54.0,
    status: 'shipped',
    shippingAddress: {
      street: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    },
    createdAt: new Date('2024-10-01'),
  },
]

export function getAllOrders(): Order[] {
  return [...ordersData]
}

export function getOrderById(id: string): Order | undefined {
  return ordersData.find((order) => order.id === id)
}

export function getOrdersByUserId(userId: string): Order[] {
  return ordersData.filter((order) => order.userId === userId)
}

export function createOrder(
  userId: string,
  items: OrderItem[],
  shippingAddress: Order['shippingAddress'],
): Order {
  let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let newOrder: Order = {
    id: String(1000 + ordersData.length + 1),
    userId,
    items,
    total,
    status: 'pending',
    shippingAddress,
    createdAt: new Date(),
  }

  ordersData.push(newOrder)
  return newOrder
}

export function updateOrderStatus(id: string, status: Order['status']): Order | undefined {
  let order = getOrderById(id)
  if (!order) return undefined

  order.status = status
  return order
}
