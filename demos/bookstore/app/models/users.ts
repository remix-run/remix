import type { TableRow } from 'remix/data-table'

import { passwordResetTokens, users, db } from './database.ts'

export type User = TableRow<typeof users>

export async function getAllUsers(): Promise<User[]> {
  return db.findMany(users, { orderBy: ['id', 'asc'] })
}

export async function getUserById(id: number | string): Promise<User | null> {
  let userId = parseUserId(id)
  if (userId === null) {
    return null
  }

  return db.find(users, userId)
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return db.findOne(users, { where: { email: normalizeEmail(email) } })
}

export async function authenticateUser(email: string, password: string): Promise<User | undefined> {
  let user = await getUserByEmail(email)
  if (!user || user.password !== password) {
    return undefined
  }

  return user
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: 'customer' | 'admin' = 'customer',
): Promise<User> {
  let created_at = Date.now()

  return db.create(
    users,
    {
      email: normalizeEmail(email),
      password, // In production, hash this!
      name,
      role,
      created_at,
    },
    { returnRow: true },
  )
}

export async function updateUser(
  id: number | string,
  data: Partial<Omit<User, 'id'>>,
): Promise<User | null> {
  let userId = parseUserId(id)
  if (userId === null) {
    return null
  }

  let changes: Partial<User> = {}
  if (data.email !== undefined) changes.email = normalizeEmail(data.email)
  if (data.password !== undefined) changes.password = data.password
  if (data.name !== undefined) changes.name = data.name
  if (data.role !== undefined) changes.role = data.role
  if (data.created_at !== undefined) changes.created_at = data.created_at

  if (Object.keys(changes).length > 0) {
    return db.update(users, userId, changes)
  }

  return getUserById(userId)
}

export async function deleteUser(id: number | string): Promise<boolean> {
  let userId = parseUserId(id)
  if (userId === null) {
    return false
  }

  return db.delete(users, userId)
}

export async function createPasswordResetToken(email: string): Promise<string | undefined> {
  let user = await getUserByEmail(email)
  if (!user) {
    return undefined
  }

  let token = Math.random().toString(36).substring(2, 15)

  await db.create(passwordResetTokens, {
    token,
    user_id: user.id,
    expires_at: Date.now() + 3600000,
  })

  return token
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  let tokenData = await db.find(passwordResetTokens, { token })

  if (!tokenData || tokenData.expires_at < Date.now()) {
    return false
  }

  let user = await getUserById(tokenData.user_id)
  if (!user) {
    return false
  }

  await db.update(users, user.id, { password: newPassword })
  await db.delete(passwordResetTokens, { token })

  return true
}

function parseUserId(id: number | string): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
