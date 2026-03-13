import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'

export function render(node: RemixNode, init?: ResponseInit): Response {
  let headers = new Headers(init?.headers)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(renderToStream(node), {
    ...init,
    headers,
  })
}
