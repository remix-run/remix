import type { Middleware } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'

import { routes } from '../routes.ts'

const assetsMatcher = createMatcher(routes.assets.pattern)
const uploadsMatcher = createMatcher(routes.uploads.pattern)

export function simulateLatency(): Middleware {
  return async ({ request, url }, next) => {
    if (assetsMatcher.match(url) || uploadsMatcher.match(url)) return next()

    let signal = request.signal
    signal.throwIfAborted()
    let delay =
      request.method === 'GET'
        ? 100 + Math.floor(Math.random() * 201)
        : 250 + Math.floor(Math.random() * 501)
    await new Promise<void>((resolve, reject) => {
      let timer = setTimeout(() => {
        signal.removeEventListener('abort', abort)
        resolve()
      }, delay)

      function abort() {
        clearTimeout(timer)
        reject(signal.reason)
      }

      signal.addEventListener('abort', abort, { once: true })
    })

    return next()
  }
}
