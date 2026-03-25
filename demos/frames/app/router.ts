import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import { clientMountedAction } from './controllers/client-mounted.tsx'
import { framesController } from './controllers/frames/controller.tsx'
import { homeAction } from './controllers/home.tsx'
import { reloadScopeAction } from './controllers/reload-scope.tsx'
import { stateSearchAction } from './controllers/state-search.tsx'
import { timeAction } from './controllers/time.tsx'
import { routes } from './routes.ts'

const middleware = []

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

export const router = createRouter({ middleware })
router.get(routes.home, homeAction)
router.get(routes.clientMounted, clientMountedAction)
router.get(routes.time, timeAction)
router.get(routes.reloadScope, reloadScopeAction)
router.get(routes.stateSearch, stateSearchAction)
router.map(routes.frames, framesController)
