import type { RequestContext } from '@remix-run/fetch-router'

import { userKey } from '../storage-keys.ts'

export function authMiddleware({ request, storage }: RequestContext) {
  let token = request.headers.get('Authorization')

  if (!token || !token.startsWith('Bearer ')) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
    })
  }

  // Mock user validation
  let userId = token.replace('Bearer ', '')
  storage.set(userKey, { id: userId, name: `User ${userId}` })
}
