import type { RemixNode } from 'remix/component'
import { renderToStream, type ResolveFrameContext } from 'remix/component/server'
import { getContext } from 'remix/async-context-middleware'
import type { Router } from 'remix/fetch-router'

export function render(node: RemixNode, init?: ResponseInit) {
  let context = getContext()
  let request = context.request
  let router = context.router

  let stream = renderToStream(node, {
    frameSrc: request.url,
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
  let url = new URL(src, frameSrc)

  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('accept-encoding', 'identity')
  headers.set('x-remix-frame', 'true')
  if (target) {
    headers.set('x-remix-target', target)
  }

  let cookie = request.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  let res = await followFrameRedirects(router, request, url, headers)
  if (res.body) return res.body

  if (res.ok) return res.text()
  return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
}

async function followFrameRedirects(router: Router, request: Request, url: URL, headers: Headers) {
  let currentUrl = url
  let redirectsRemaining = 10

  while (true) {
    let res = await router.fetch(
      new Request(currentUrl, {
        method: 'GET',
        headers,
        signal: request.signal,
      }),
    )

    let location = res.headers.get('location')
    if (!location || res.status < 300 || res.status >= 400) {
      return res
    }

    if (redirectsRemaining-- <= 0) {
      throw new Error('Too many frame redirects')
    }

    currentUrl = new URL(location, currentUrl)
  }
}
