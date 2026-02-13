import type { TableRow } from 'remix/data-table'
import { ilike } from 'remix/data-table'

import { PasswordResetTokensTable, UsersTable, db } from './database.ts'

export type User = TableRow<typeof UsersTable>

type PasswordResetTokenRow = TableRow<typeof PasswordResetTokensTable>

export async function getAllUsers(): Promise<User[]> {
  return db.query(UsersTable).orderBy('id', 'asc').all()
}

export async function getUserById(id: string): Promise<User | null> {
  return db.query(UsersTable).where({ id }).first()
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return db.query(UsersTable).where(ilike('email', email)).first()
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
  let count = await db.query(UsersTable).count()
  let id = String(count + 1)
  let created_at = Date.now()

  await db.query(UsersTable).insert({
    id,
    email,
    password, // In production, hash this!
    name,
    role,
    created_at,
  })

  let created = await getUserById(id)
  if (!created) {
    throw new Error('Failed to create user')
  }

  return created
}

export async function updateUser(
  id: string,
  data: Partial<Omit<User, 'id'>>,
): Promise<User | null> {
  let existing = await getUserById(id)
  if (!existing) {
    return null
  }

  let changes: Record<string, unknown> = {}
  if (data.email !== undefined) changes.email = data.email
  if (data.password !== undefined) changes.password = data.password
  if (data.name !== undefined) changes.name = data.name
  if (data.role !== undefined) changes.role = data.role
  if (data.created_at !== undefined) changes.created_at = data.created_at

  if (Object.keys(changes).length > 0) {
    await db.query(UsersTable).where({ id }).update(changes)
  }

  return getUserById(id)
}

export async function deleteUser(id: string): Promise<boolean> {
  let result = await db.query(UsersTable).where({ id }).delete()
  return result.affectedRows > 0
}

export async function createPasswordResetToken(email: string): Promise<string | undefined> {
  let user = await getUserByEmail(email)
  if (!user) {
    return undefined
  }

  let token = Math.random().toString(36).substring(2, 15)

  await db.query(PasswordResetTokensTable).insert({
    token,
    user_id: user.id,
    expires_at: Date.now() + 3600000,
  })

  return token
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  let tokenData = (await db
    .query(PasswordResetTokensTable)
    .where({ token })
    .first()) as PasswordResetTokenRow | null

  if (!tokenData || tokenData.expires_at < Date.now()) {
    return false
  }

  let user = await getUserById(tokenData.user_id)
  if (!user) {
    return false
  }

  await db.query(UsersTable).where({ id: user.id }).update({ password: newPassword })
  await db.query(PasswordResetTokensTable).where({ token }).delete()

  return true
}
