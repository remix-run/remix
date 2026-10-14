import { createRouter, type Middleware, type RouterContext } from 'remix/router'
import { render } from 'remix/spa'

import rootController from './actions/controller.tsx'
import { NotFoundPage } from './actions/pages.tsx'
import { routes } from './routes.ts'

const logSpaRequests: Middleware = async ({ request }, next) => {
  let url = new URL(request.url)
  let start = performance.now()
  console.log(`[SPA] → ${request.method} ${url.pathname}${url.search}`)
  let response = await next()
  let duration = Math.round(performance.now() - start)
  console.log(`[SPA] ← ${response.status} ${request.method} ${url.pathname} (${duration} ms)`)
  return response
}

export const router = createRouter({
  middleware: [render(), logSpaRequests],
  defaultHandler({ render, url }) {
    return render(<NotFoundPage url={url} />, { status: 404 })
  },
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
