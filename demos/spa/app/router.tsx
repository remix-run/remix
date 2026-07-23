import { createRouter } from 'remix/router'
import type { RemixNode } from 'remix/ui'

import rootController, { NotFoundPage } from './actions/controller.tsx'
import { render } from './middleware/render.tsx'
import { routes } from './routes.ts'

declare module 'remix/router' {
  interface RouterTypes {
    output: RemixNode
  }
}

export const router = createRouter({
  middleware: [render()],
  defaultHandler: () => <NotFoundPage />,
})

router.map(routes, rootController)
