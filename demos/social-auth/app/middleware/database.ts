import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

import { db } from '../data/setup.ts'

type SetDatabaseContextTransform = readonly [readonly [typeof Database, Database]]

export function loadDatabase(): Middleware<'ANY', {}, SetDatabaseContextTransform> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
