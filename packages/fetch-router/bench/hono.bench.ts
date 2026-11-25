import { Hono } from 'hono'

import { benchRouter, generatePatterns, okResponse } from './scenarios.ts'

await benchRouter('hono', (scenario, verify) => {
  let app = new Hono()
  for (let index = 0; index < 3 && scenario.middleware !== undefined; index++) {
    app.use(
      scenario.middleware === 'sync'
        ? (_context, next) => next()
        : async (_context, next) => {
            await next()
          },
    )
  }

  for (let pattern of generatePatterns(scenario.routeCount)) {
    app.get(pattern, verify ? (context) => Response.json(context.req.param()) : () => okResponse)
  }
  return (request) => app.fetch(request)
})
