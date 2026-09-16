import { render } from 'remix/middleware/render'
import { createRouter, type RouterContext } from 'remix/router'

import rootController from './actions/controller.tsx'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

export const router = createRouter({ middleware: [render({ assets })] })
type AppContext = RouterContext<typeof router>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
