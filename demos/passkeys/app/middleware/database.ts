import type { Database } from 'remix/data-table'
import { createContextKey, type Middleware } from 'remix/router'

import { db } from '../db.ts'

export const databaseContext = createContextKey<Database>()

export function loadDatabase(): Middleware<{
  key: typeof databaseContext
  value: Database
  property: 'db'
}> {
  return (context, next) => {
    context.set(databaseContext, db, { property: 'db' })
    return next()
  }
}
