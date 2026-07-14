import type { Database } from 'remix/data-table'

import { users } from '../app/data/schema.ts'
import { hashPassword } from '../app/utils/password-hash.ts'

const DEMO_ADMIN_AVATAR_URL = 'https://randomuser.me/api/portraits/women/44.jpg'
const DEMO_USER_AVATAR_URL = 'https://randomuser.me/api/portraits/men/32.jpg'

export async function seed(db: Database) {
  if ((await db.count(users)) === 0) {
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
}
