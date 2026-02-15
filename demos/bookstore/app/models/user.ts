import * as s from 'remix/data-schema'
import { Model } from 'remix/data-model'
import type { InferModelProperties } from 'remix/data-model'

export class User extends Model {
  static columns = {
    id: s.number(),
    email: s.string(),
    password: s.string(),
    name: s.string(),
    role: s.enum_(['customer', 'admin']),
    created_at: s.number(),
  }

  static override normalizeLookupValue(value: unknown): unknown | null {
    return parseUserId(value)
  }

  static override normalizeCreateValues(values: Record<string, unknown>): Record<string, unknown> {
    let normalized: Record<string, unknown> = { ...values }
    if (typeof normalized.email === 'string') {
      normalized.email = normalizeEmail(normalized.email)
    }
    if (normalized.created_at === undefined) {
      normalized.created_at = Date.now()
    }

    return normalized
  }

  static override normalizeUpdateValues(changes: Record<string, unknown>): Record<string, unknown> {
    let normalized: Record<string, unknown> = { ...changes }
    if (typeof normalized.email === 'string') {
      normalized.email = normalizeEmail(normalized.email)
    }

    return normalized
  }

  static override all<self extends typeof Model>(
    this: self,
  ): Promise<Array<InstanceType<self>>> {
    return this.findMany({ orderBy: ['id', 'asc'] })
  }

  static getByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email: normalizeEmail(email) } })
  }

  static async authenticateUser(email: string, password: string): Promise<User | undefined> {
    let user = await this.getByEmail(email)
    if (!user || user.password !== password) {
      return undefined
    }

    return user
  }

  static register(
    email: string,
    password: string,
    name: string,
    role?: 'customer' | 'admin',
  ): Promise<User>
  static register(
    email: string,
    password: string,
    name: string,
    role: 'customer' | 'admin' = 'customer',
  ): Promise<User> {
    return this.create({
      email,
      password,
      name,
      role,
    })
  }

  static async createPasswordResetToken(email: string): Promise<string | undefined> {
    let user = await this.getByEmail(email)
    if (!user) {
      return undefined
    }

    let token = Math.random().toString(36).substring(2, 15)

    await this.db.create(PasswordResetToken.table, {
      token,
      user_id: user.id,
      expires_at: Date.now() + 3600000,
    })

    return token
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    let tokenData = await this.db.find(PasswordResetToken.table, { token })

    if (!tokenData || (tokenData as PasswordResetToken).expires_at < Date.now()) {
      return false
    }

    let user = await this.find((tokenData as PasswordResetToken).user_id)
    if (!user) {
      return false
    }

    await this.update(user.id, { password: newPassword })
    await this.db.delete(PasswordResetToken.table, { token })

    return true
  }
}

export class PasswordResetToken extends Model {
  static primaryKey = ['token'] as const
  static columns = {
    token: s.string(),
    user_id: s.number(),
    expires_at: s.number(),
  }
}

export interface User extends InferModelProperties<typeof User.columns> {}
export interface PasswordResetToken extends InferModelProperties<typeof PasswordResetToken.columns> {}

function parseUserId(id: unknown): number | null {
  let parsed = typeof id === 'number' ? id : Number(id)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
