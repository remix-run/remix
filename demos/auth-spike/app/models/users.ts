import type { AuthUser } from '@remix-run/auth'

// App's user type - uses AuthUser directly (includes name, email, etc.)
export type User = AuthUser

// In-memory user storage
let users = new Map<string, User>()

export async function getUserById(id: string): Promise<User | null> {
  return users.get(id) ?? null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return Array.from(users.values()).find((u) => u.email === email) ?? null
}

export async function createUser(data: {
  email: string
  name: string
  image?: string
}): Promise<User> {
  let now = new Date()
  let user: User = {
    id: crypto.randomUUID(),
    email: data.email,
    name: data.name,
    image: data.image,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  }
  users.set(user.id, user)
  return user
}

export function resetUsers(): void {
  users.clear()
}

// Password credential storage (separate from user!)
let passwords = new Map<string, { hashedPassword: string }>()

export async function findPassword(userId: string): Promise<{ hashedPassword: string } | null> {
  return passwords.get(userId) ?? null
}

export async function createPassword(userId: string, hashedPassword: string): Promise<void> {
  passwords.set(userId, { hashedPassword })
}

export async function updatePassword(userId: string, hashedPassword: string): Promise<void> {
  passwords.set(userId, { hashedPassword })
}

export function resetPasswords(): void {
  passwords.clear()
}
