import type { RemixNode } from 'remix/component'
import { renderToStream, type ResolveFrameContext } from 'remix/component/server'
import { getContext } from 'remix/async-context-middleware'
import type { Router } from 'remix/fetch-router'

export function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.router
  let topFrameSrc = request.headers.get('x-remix-top-frame-src') ?? request.url

  let stream = renderToStream(node, {
    frameSrc: request.url,
    topFrameSrc,
    resolveFrame: (src, target, context) => resolveFrame(router, request, src, target, context),
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

async function resolveFrame(
  router: Router,
  request: Request,
  src: string,
  target?: string,
  context?: ResolveFrameContext,
) {
  let frameSrc = context?.currentFrameSrc ?? request.url
  let topFrameSrc =
    context?.topFrameSrc ?? request.headers.get('x-remix-top-frame-src') ?? request.url
  let url = new URL(src, frameSrc)

  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('accept-encoding', 'identity')
  headers.set('x-remix-frame', 'true')
  headers.set('x-remix-top-frame-src', topFrameSrc)
  if (target) {
    headers.set('x-remix-target', target)
  }

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
