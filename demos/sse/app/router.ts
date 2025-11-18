import { createRouter } from '@remix-run/fetch-router'
import { compression } from '@remix-run/fetch-router/compression-middleware'
import { logger } from '@remix-run/fetch-router/logger-middleware'
import { staticFiles } from '@remix-run/fetch-router/static-middleware'

import { routes } from '../routes.ts'
import { home } from './home.tsx'
import { messages } from './messages.ts'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(staticFiles('./public'))

// Add compression middleware with default encodings
// The browser's Accept-Encoding header determines which encoding is used
middleware.push(compression())

export let router = createRouter({ middleware })

router.get(routes.home, home)
router.get(routes.messages, messages)
