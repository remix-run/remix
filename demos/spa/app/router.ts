import { createRouter, type Middleware, type RouterContext } from 'remix/router'
import { render } from 'remix/spa'

import rootController from './actions/controller.tsx'
import { routes } from './routes.ts'
import { createNotFoundPage } from './ui/app-shell.tsx'

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
    return render(createNotFoundPage(url), { status: 404 })
  },
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, rootController)
