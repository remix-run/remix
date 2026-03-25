import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const users = table({
  name: 'users',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    email: c.text().unique(),
    password_hash: c.text(),
    name: c.text(),
    avatar_url: c.text(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    let timestamp = Date.now()

    if (typeof next.email === 'string') {
      next.email = normalizeEmail(next.email)
    }

    if (typeof next.name === 'string') {
      next.name = normalizeText(next.name)
    }

    if (typeof next.avatar_url === 'string') {
      next.avatar_url = normalizeOptionalText(next.avatar_url)
    }

    if (typeof next.password_hash === 'string') {
      next.password_hash = normalizeOptionalText(next.password_hash)
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = timestamp
    }

    next.updated_at = timestamp

    return { value: next }
  },
})

export const authAccounts = table({
  name: 'auth_accounts',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c
      .integer()
      .notNull()
      .references('users', 'id', 'auth_accounts_user_id_fk')
      .onDelete('cascade'),
    provider: c.enum(['google', 'github', 'x']).notNull(),
    provider_account_id: c.text().notNull(),
    email: c.text(),
    username: c.text(),
    display_name: c.text(),
    avatar_url: c.text(),
    profile_json: c.text().notNull(),
    created_at: c.integer().notNull(),
    updated_at: c.integer().notNull(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    let timestamp = Date.now()

    if (typeof next.email === 'string') {
      next.email = normalizeEmail(next.email)
    }

    if (typeof next.username === 'string') {
      next.username = normalizeOptionalText(next.username)
    }

    if (typeof next.display_name === 'string') {
      next.display_name = normalizeOptionalText(next.display_name)
    }

    if (typeof next.avatar_url === 'string') {
      next.avatar_url = normalizeOptionalText(next.avatar_url)
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = timestamp
    }

    next.updated_at = timestamp

    return { value: next }
  },
})

export const passwordResetTokens = table({
  name: 'password_reset_tokens',
  primaryKey: ['token'],
  columns: {
    token: c.text().primaryKey(),
    user_id: c
      .integer()
      .notNull()
      .references('users', 'id', 'password_reset_tokens_user_id_fk')
      .onDelete('cascade'),
    expires_at: c.integer().notNull(),
  },
})

export type User = TableRow<typeof users>
export type AuthAccount = TableRow<typeof authAccounts>

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeText(value: string): string {
  return value.trim()
}

export function normalizeOptionalText(value: string): string | undefined {
  let normalized = value.trim()
  return normalized === '' ? undefined : normalized
}
