import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'

export function render(node: RemixNode, init?: ResponseInit) {
  let stream = renderToStream(node, {
    onError(error) {
      console.error(error)
    },
  })

  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=utf-8')
  }

  return new Response(stream, { ...init, headers })
}
