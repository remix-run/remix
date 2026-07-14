import type { Middleware } from 'remix/router'
import { Database } from 'remix/data-table'

import { database } from '../data/database.ts'

export function loadDatabase(): Middleware<{ key: typeof Database; value: Database }> {
  return async (context, next) => {
    await using db = await database.connect()
    context.set(Database, db)
    return await next()
  }
}
