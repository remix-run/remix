import type { TableRow } from 'remix/data-table'
import { ilike } from 'remix/data-table'

import { PasswordResetTokensTable, UsersTable, db } from './database.ts'

export type User = TableRow<typeof UsersTable>

export async function getAllUsers(): Promise<User[]> {
  return db.findMany(UsersTable, { orderBy: ['id', 'asc'] })
}

export async function getUserById(id: string): Promise<User | null> {
  return db.find(UsersTable, id)
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return db.findOne(UsersTable, { where: ilike('email', email) })
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
  let count = await db.count(UsersTable)
  let id = String(count + 1)
  let created_at = Date.now()

  return db.create(
    UsersTable,
    {
      id,
      email,
      password, // In production, hash this!
      name,
      role,
      created_at,
    },
    { returnRow: true },
  )
}

export async function updateUser(
  id: string,
  data: Partial<Omit<User, 'id'>>,
): Promise<User | null> {
  let changes: Partial<User> = {}
  if (data.email !== undefined) changes.email = data.email
  if (data.password !== undefined) changes.password = data.password
  if (data.name !== undefined) changes.name = data.name
  if (data.role !== undefined) changes.role = data.role
  if (data.created_at !== undefined) changes.created_at = data.created_at

  if (Object.keys(changes).length > 0) {
    return db.update(UsersTable, id, changes)
  }

  return getUserById(id)
}

export async function deleteUser(id: string): Promise<boolean> {
  return db.delete(UsersTable, id)
}

export async function createPasswordResetToken(email: string): Promise<string | undefined> {
  let user = await getUserByEmail(email)
  if (!user) {
    return undefined
  }

  let token = Math.random().toString(36).substring(2, 15)

  await db.create(PasswordResetTokensTable, {
    token,
    user_id: user.id,
    expires_at: Date.now() + 3600000,
  })

  return token
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  let tokenData = await db.find(PasswordResetTokensTable, { token })

  if (!tokenData || tokenData.expires_at < Date.now()) {
    return false
  }

  let user = await getUserById(tokenData.user_id)
  if (!user) {
    return false
  }

  await db.update(UsersTable, user.id, { password: newPassword })
  await db.delete(PasswordResetTokensTable, { token })

  return true
}
