export interface User {
  id: string
  email: string
  password: string // In production, this would be hashed!
  name: string
  role: 'customer' | 'admin'
  createdAt: Date
}

let usersData: User[] = [
  {
    id: '1',
    email: 'admin@bookstore.com',
    password: 'admin123', // Never do this in production!
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    email: 'customer@example.com',
    password: 'password123',
    name: 'John Doe',
    role: 'customer',
    createdAt: new Date('2024-02-15'),
  },
]

export function getAllUsers(): User[] {
  return [...usersData]
}

export function getUserById(id: string): User | undefined {
  return usersData.find((user) => user.id === id)
}

export function getUserByEmail(email: string): User | undefined {
  return usersData.find((user) => user.email.toLowerCase() === email.toLowerCase())
}

export function authenticateUser(email: string, password: string): User | undefined {
  let user = getUserByEmail(email)
  if (!user || user.password !== password) {
    return undefined
  }
  return user
}

export function createUser(
  email: string,
  password: string,
  name: string,
  role: 'customer' | 'admin' = 'customer',
): User {
  let newUser: User = {
    id: String(usersData.length + 1),
    email,
    password, // In production, hash this!
    name,
    role,
    createdAt: new Date(),
  }
  usersData.push(newUser)
  return newUser
}

export function updateUser(id: string, data: Partial<Omit<User, 'id'>>): User | undefined {
  let index = usersData.findIndex((user) => user.id === id)
  if (index === -1) return undefined

  usersData[index] = { ...usersData[index], ...data }
  return usersData[index]
}

export function deleteUser(id: string): boolean {
  let index = usersData.findIndex((user) => user.id === id)
  if (index === -1) return false

  usersData.splice(index, 1)
  return true
}

// Password reset tokens (in production, use a proper token system)
let resetTokens = new Map<string, { userId: string; expiresAt: Date }>()

export function createPasswordResetToken(email: string): string | undefined {
  let user = getUserByEmail(email)
  if (!user) return undefined

  let token = Math.random().toString(36).substring(2, 15)
  resetTokens.set(token, {
    userId: user.id,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
  })

  return token
}

export function resetPassword(token: string, newPassword: string): boolean {
  let tokenData = resetTokens.get(token)
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return false
  }

  let user = getUserById(tokenData.userId)
  if (!user) return false

  user.password = newPassword
  resetTokens.delete(token)
  return true
}
