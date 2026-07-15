import { createRouter, type MiddlewareContext } from 'remix/router'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import controller from './actions/controller.tsx'
import { assetServer } from './assets.ts'
import { routes } from './routes.ts'

const renderMiddleware = render({ assets: assetServer })
type AppContext = MiddlewareContext<[typeof renderMiddleware]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles('./public', { index: false }), renderMiddleware],
})

router.map(routes, controller)
