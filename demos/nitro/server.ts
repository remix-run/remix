import { asyncContext } from 'remix/async-context-middleware'
import { createRouter, type Middleware } from 'remix/fetch-router'

import * as marketing from './app/marketing.tsx'
import { routes } from './app/routes.ts'
import { routerStorageKey } from './app/utils/router-storage.ts'

let middleware: Middleware[] = [asyncContext()]

let router = createRouter({ middleware })

middleware.unshift((context, next) => {
  context.storage.set(routerStorageKey, router)
  return next()
})

router.map(routes, {
  marketing,
})

export default {
  fetch(request: Request) {
    return router.fetch(request.url, request)
  },
}
