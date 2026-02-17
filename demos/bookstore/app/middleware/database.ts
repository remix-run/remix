import type { Middleware } from 'remix/fetch-router'

import { db } from '../data/setup.ts'

export function loadDatabase(): Middleware {
  return async (context, next) => {
    context.db = db
    return next()
  }
}
