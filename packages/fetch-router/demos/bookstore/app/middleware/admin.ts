import type { RequestContext } from '@remix-run/fetch-router'

import { userKey } from '../storage-keys.ts'

export function adminMiddleware({ storage }: RequestContext) {
  let user = storage.get(userKey)

  if (!user || !user.id.startsWith('admin')) {
    return new Response('Admin access required', { status: 403 })
  }
}
