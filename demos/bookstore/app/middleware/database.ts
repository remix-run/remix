import type { Middleware } from 'remix/router'
import { Database } from 'remix/data-table'

import { db } from '../data/setup.ts'

export function loadDatabase(): Middleware<{
  key: typeof Database
  value: Database
  property: 'db'
}> {
  return (context) => {
    context.set(Database, db, { property: 'db' })
  }
}
