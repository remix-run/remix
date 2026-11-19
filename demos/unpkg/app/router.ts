import { createRouter, type RouterContext } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'

import rootController from './actions/controller.ts'
import { render } from './middleware/render.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    staticFiles('./public', {
      cacheControl: 'no-store',
      etag: false,
      lastModified: false,
      index: false,
    }),
    render(),
  ],
})
type AppContext = RouterContext<typeof router>

router.map(routes, rootController)

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}
