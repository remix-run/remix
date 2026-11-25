import { createRouter, type Middleware } from '@remix-run/fetch-router'

import { benchRouter, createHandler, generatePatterns } from './scenarios.ts'

await benchRouter('fetch-router', (scenario, verify) => {
  let middleware: Middleware[] = []
  for (let index = 0; index < 3 && scenario.middleware !== undefined; index++) {
    middleware.push(
      scenario.middleware === 'sync'
        ? (_context, next) => next()
        : async (_context, next) => {
            let response = await next()
            return response
          },
    )
  }

  let router = createRouter({ middleware })
  for (let pattern of generatePatterns(scenario.routeCount)) {
    router.get(pattern, verify ? ({ params }) => Response.json(params) : createHandler(scenario))
  }
  return (request) => router.fetch(request)
})
