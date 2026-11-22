import * as path from 'node:path'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createMiddleware, createRouter } from 'remix/router'
import type { MiddlewareContext } from 'remix/router'

import controller from './actions/controller.tsx'
import { routes } from './routes.ts'

export const publicDirectory = path.resolve(import.meta.dirname, '../public')

const middleware = createMiddleware(staticFiles(publicDirectory), render())

type AppContext = MiddlewareContext<typeof middleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware })

router.map(routes, controller)
