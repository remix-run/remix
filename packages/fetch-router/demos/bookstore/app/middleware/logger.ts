import type { RequestContext, NextFunction } from '@remix-run/fetch-router'

export async function loggerMiddleware({ request }: RequestContext, next: NextFunction) {
  let start = Date.now()
  console.log(`${request.method} ${new URL(request.url).pathname}`)

  let response = await next()

  let duration = Date.now() - start
  console.log(`${request.method} ${new URL(request.url).pathname} ${response.status} ${duration}ms`)

  return response
}
