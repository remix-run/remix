import { createCredentialsAuthProvider } from 'remix/auth'
import { auth, createSessionAuthScheme } from 'remix/middleware/auth'
import type { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { verifyPassword } from '../data/passwords.ts'
import { userPasswords, users, type User } from '../data/schema.ts'
import { databaseContext } from './database.ts'

export interface AuthSession {
  userId: number
}

export const credentialsSchema = f.object({
  username: f.field(s.defaulted(s.string(), '').transform((value) => value.trim())),
  password: f.field(s.defaulted(s.string(), '')),
})

export const passwordProvider = createCredentialsAuthProvider({
  name: 'password',
  parse(context) {
    return s.parse(credentialsSchema, context.get(FormData))
  },
  async verify({ username, password }, context) {
    let db = requireDatabase(context.get(databaseContext))
    let user = await db.findOne(users, { where: { username } })

    if (!user) {
      return null
    }

    let passwordRecord = await db.findOne(userPasswords, {
      where: { user_id: user.id },
    })

    if (!passwordRecord || !(await verifyPassword(password, passwordRecord.password_hash))) {
      return null
    }

    return user
  },
})

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, AuthSession>({
        name: 'session',
        read(session) {
          let value = session.get('auth')

          if (isAuthSession(value)) {
            return value
          }

          return null
        },
        async verify(value, context) {
          let db = requireDatabase(context.get(databaseContext))
          return await db.find(users, value.userId)
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

function isAuthSession(value: unknown): value is AuthSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    Number.isInteger(value.userId)
  )
}

function requireDatabase(db: Database | undefined): Database {
  if (!db) {
    throw new Error('Database middleware is required before auth middleware.')
  }

  return db
}
