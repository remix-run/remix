import * as s from 'remix/data-schema'
import {
  auth,
  createSessionAuthScheme,
  requireAuth as requireAuthenticated,
} from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'

import { users, type User } from '../data/schema.ts'
import { routes } from '../routes.ts'
import { databaseContext } from './database.ts'

const authSessionSchema = s.object({ userId: s.string() })

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<User, s.InferOutput<typeof authSessionSchema>>({
        read(session) {
          let result = s.parseSafe(authSessionSchema, session.get('auth'))
          return result.success ? result.value : null
        },
        verify(value, context) {
          let db = context.get(databaseContext)
          if (db == null) {
            throw new Error('Expected loadDatabase() middleware before loadAuth()')
          }

          return db.find(users, value.userId)
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

export function requireAuth() {
  return requireAuthenticated<User>({
    onFailure() {
      return redirect(routes.home.href())
    },
  })
}
