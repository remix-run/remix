import { Database } from 'remix/data-table'
import type { Middleware } from 'remix/router'

export function loadDatabase(database: Database): Middleware<{
  key: typeof Database
  value: Database
  property: 'db'
}> {
  return (context, next) => {
    context.set(Database, database, { property: 'db' })
    return next()
  }
}
