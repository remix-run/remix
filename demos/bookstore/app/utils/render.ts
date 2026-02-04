import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { getContext } from 'remix/async-context-middleware'

export async function render(node: RemixNode, init?: ResponseInit) {
  let request = getContext().request

  let stream = renderToStream(node, {
    resolveFrame: (src) => resolveFrameViaFetch(request, src),
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

async function resolveFrameViaFetch(request: Request, src: string) {
  let url = new URL(src, request.url)

  // This is a server-internal fetch to get HTML. Avoid compression so the bytes
  // remain plain HTML text for `resolveFrame`.
  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('accept-encoding', 'identity')

  // Forward cookies so the frame request has access to the session
  let cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  let res = await fetch(
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
  return await res.text()
}
