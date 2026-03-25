import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import { createClientMountedAction } from './controllers/client-mounted.tsx'
import { createFramesController } from './controllers/frames/controller.tsx'
import { createHomeAction } from './controllers/home.tsx'
import { createReloadScopeAction } from './controllers/reload-scope.tsx'
import { createStateSearchAction } from './controllers/state-search.tsx'
import { createTimeAction } from './controllers/time.tsx'
import { routes } from './routes.ts'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
    index: false,
  }),
)

export let router = createRouter({ middleware })
router.get(routes.home, createHomeAction(router))
router.get(routes.clientMounted, createClientMountedAction(router))
router.get(routes.time, createTimeAction(router))
router.get(routes.reloadScope, createReloadScopeAction(router))
router.get(routes.stateSearch, createStateSearchAction(router))
router.map(routes.frames, createFramesController(router))
