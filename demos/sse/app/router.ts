import { createRouter } from 'remix/fetch-router'
import { compression } from 'remix/compression-middleware'
import { logger } from 'remix/logger-middleware'
import { staticFiles } from 'remix/static-middleware'

import { homeAction } from './controllers/home.tsx'
import { messagesAction } from './controllers/messages.ts'
import { routes } from './routes.ts'

const middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())
middleware.push(
  staticFiles('./public', {
    cacheControl: 'no-store',
    etag: false,
    lastModified: false,
  }),
)

export const router = createRouter({ middleware })

router.get(routes.home, homeAction)
router.get(routes.messages, messagesAction)
