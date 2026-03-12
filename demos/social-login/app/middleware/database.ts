import { createContextKey, type Middleware } from 'remix/fetch-router'
import type { Database } from 'remix/data-table'

import { db } from '../data/setup.ts'

export let AppDatabase = createContextKey<Database>()

export function loadDatabase(): Middleware {
  return async (context, next) => {
    context.set(AppDatabase, db)
    return next()
  }
}
