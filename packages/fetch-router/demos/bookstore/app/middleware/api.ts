import type { RequestContext, NextFunction } from '@remix-run/fetch-router'

export async function apiMiddleware(_: RequestContext, next: NextFunction) {
  let response = await next()

  // Ensure all API responses have JSON content type
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'Content-Type': 'application/json',
      'X-API-Version': '1.0',
    },
  })
}
