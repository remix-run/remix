import { Database } from 'remix/data-table'
import type { Middleware } from 'remix/router'

import { database } from '../data/database.ts'

export function loadDatabase(): Middleware<{
  key: typeof Database
  value: Database
  property: 'db'
}> {
  return async (context, next) => {
    await using db = await database.connect()
    context.set(Database, db, { property: 'db' })
    return await next()
  }
}
