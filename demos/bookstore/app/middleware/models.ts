import type { Middleware } from 'remix/fetch-router'

import { db } from '../db.ts'
import type { BoundModels } from '../models.ts'
import { registry } from '../models.ts'

declare module 'remix/fetch-router' {
  interface RequestContext {
    models: BoundModels
  }
}

export function loadModels(): Middleware {
  return async (context, next) => {
    context.models = registry.bind(db)
    return next()
  }
}
