import { createContextKey, type Middleware } from 'remix/router'
import type { Database } from 'remix/data-table'

import { db } from '../db.ts'

export const databaseContext = createContextKey<Database>()

export function loadDatabase(): Middleware<{ key: typeof databaseContext; value: Database }> {
  return async (context, next) => {
    context.set(databaseContext, db)
    return next()
  }
}
