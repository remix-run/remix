import * as path from 'node:path'
import { createDatabase, type GetMigrations, type Seed } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

import { users } from './data/schema.ts'
import { hashPassword } from './utils/password-hash.ts'

const DEMO_ADMIN_AVATAR_URL = 'https://randomuser.me/api/portraits/women/44.jpg'
const DEMO_USER_AVATAR_URL = 'https://randomuser.me/api/portraits/men/32.jpg'

export const db = createDatabase(
  createSqliteDatabaseAdapter({
    filename:
      process.env.NODE_ENV === 'test'
        ? ':memory:'
        : path.join(import.meta.dirname, '../db/social-auth.sqlite'),
  }),
)

export const getMigrations: GetMigrations = () =>
  loadMigrations(path.join(import.meta.dirname, '../db/migrations'))

export const seed: Seed = async (db) => {
  if ((await db.count(users)) > 0) {
    return
  }

  await db.createMany(users, [
    {
      id: 1,
      email: 'admin@example.com',
      password_hash: await hashPassword('password123'),
      name: 'Demo Admin',
      avatar_url: DEMO_ADMIN_AVATAR_URL,
    },
    {
      id: 2,
      email: 'user@example.com',
      password_hash: await hashPassword('password123'),
      name: 'Demo User',
      avatar_url: DEMO_USER_AVATAR_URL,
    },
  ])
}
