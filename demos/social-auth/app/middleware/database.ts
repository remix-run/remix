import type { ContextEntry, Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { db } from '../data/setup.ts'

type DatabaseContextEntry = ContextEntry<typeof Database, Database>

export function loadDatabase(): Middleware<DatabaseContextEntry> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
