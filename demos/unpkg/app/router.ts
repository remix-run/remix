import { createRouter, type RouterContext } from 'remix/router'

import rootController from './actions/controller.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

export const router = createRouter({ middleware: [render()] })
type AppContext = RouterContext<typeof router>

router.map(routes, rootController)

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
