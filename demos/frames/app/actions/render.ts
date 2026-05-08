import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { createHtmlResponse } from 'remix/response/html'
import { getContext } from 'remix/async-context-middleware'
import type { Router } from 'remix/fetch-router'

export function render(node: RemixNode, init?: ResponseInit): Response {
  let context = getContext()
  let request = context.request
  let router = context.router

  let stream = renderToStream(node, {
    resolveFrame: (src) => resolveFrameViaRouter(router, request, src),
    onError(error) {
      console.error(error)
    },
  })

  let headers = new Headers(init?.headers)

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }

  return createHtmlResponse(stream, { ...init, headers })
}

async function resolveFrameViaRouter(router: Router, request: Request, src: string) {
  let url = new URL(src, request.url)
  let headers = new Headers(request.headers)

  headers.delete('Accept-Encoding')
  headers.set('Accept', 'text/html')

  let response = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: request.signal,
    }),
  )

  if (!response.ok) {
    return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
  }

  if (response.body) {
    return response.body
  }

  return response.text()
}
