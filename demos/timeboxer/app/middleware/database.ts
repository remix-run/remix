import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { db } from '../data/database.ts'

export function loadDatabase(): Middleware<{ key: typeof Database; value: Database }> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
