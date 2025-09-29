import type { NextFunction } from '@remix-run/fetch-router'

export async function corsMiddleware(_: any, next: NextFunction) {
  let response = await next()

  // Create new headers, preserving existing ones
  let headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
