import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export type SocialProviderName = 'google' | 'github' | 'facebook'

export let users = table({
  name: 'users',
  columns: {
    id: c.integer(),
    email: c.text().unique(),
    password: c.text(),
    name: c.text(),
    avatar_url: c.text(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    let now = Date.now()

    if (typeof next.email === 'string') {
      next.email = normalizeEmail(next.email)
    }

    if (typeof next.password === 'string') {
      next.password = next.password.trim()
    }

    if (typeof next.name === 'string') {
      next.name = normalizeText(next.name)
    }

    if (typeof next.avatar_url === 'string') {
      next.avatar_url = next.avatar_url.trim()
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = now
    }

    if (next.updated_at === undefined) {
      next.updated_at = now
    }

    return { value: clearEmptyStrings(next) }
  },
})

export let authAccounts = table({
  name: 'auth_accounts',
  columns: {
    id: c.integer(),
    user_id: c.integer(),
    provider: c.enum(['google', 'github', 'facebook']),
    provider_account_id: c.text(),
    email: c.text(),
    name: c.text(),
    avatar_url: c.text(),
    created_at: c.integer(),
    updated_at: c.integer(),
  },
  beforeWrite({ operation, value }) {
    let next = { ...value }
    let now = Date.now()

    if (typeof next.email === 'string') {
      next.email = normalizeEmail(next.email)
    }

    if (typeof next.name === 'string') {
      next.name = normalizeText(next.name)
    }

    if (typeof next.avatar_url === 'string') {
      next.avatar_url = next.avatar_url.trim()
    }

    if (typeof next.provider_account_id === 'string') {
      next.provider_account_id = next.provider_account_id.trim()
    }

    if (operation === 'create' && next.created_at === undefined) {
      next.created_at = now
    }

    if (next.updated_at === undefined) {
      next.updated_at = now
    }

    return { value: clearEmptyStrings(next) }
  },
})

export type User = TableRow<typeof users>
export type AuthAccount = TableRow<typeof authAccounts>

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function clearEmptyStrings<value extends Record<string, unknown>>(input: value): value {
  let next = { ...input } as Record<string, unknown>

  for (let key of Object.keys(next)) {
    if (next[key] === '') {
      next[key] = undefined
    }
  }

  return next as value
}
