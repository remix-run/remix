import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { getContext } from 'remix/async-context-middleware'
import type { Router } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { routerStorageKey } from './router-storage.ts'

// Absolute path to the demo root (one level up from app/)
let demoRoot = path.resolve(import.meta.dirname, '../..')

export function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.storage.get(routerStorageKey)

  let stream = renderToStream(node, {
    resolveFrame: (src) => resolveFrame(router, request, src),
    resolveClientEntryUrl(url) {
      if (!url.startsWith('file://')) {
        return url
      }
      // Strip fragment (#ComponentName) used by clientEntry() to identify components
      let withoutFragment = url.split('#')[0]
      let absolutePath = fileURLToPath(withoutFragment)
      let rootRelativePath = path.relative(demoRoot, absolutePath).replace(/\\/g, '/')
      return routes.scripts.href({ path: rootRelativePath })
    },
    onError(error) {
      console.error(error)
    },
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(stream, { ...init, headers })
}

async function resolveFrame(router: Router, request: Request, src: string) {
  let url = new URL(src, request.url)

  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('accept-encoding', 'identity')

  let cookie = request.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  let res = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: request.signal,
    }),
  )

  if (!res.ok) {
    return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
  }

  if (res.body) return res.body
  return res.text()
}

export function renderFragment(node: RemixNode, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return render(node, { ...init, headers })
}
