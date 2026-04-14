import type { RemixNode } from 'remix/component'
import { renderToStream, type ResolveFrameContext } from 'remix/component/server'
import type { RequestContext, Router } from 'remix/fetch-router'

export function render(context: RequestContext, node: RemixNode, init?: ResponseInit) {
  let stream = renderToStream(node, {
    frameSrc: context.request.url,
    resolveFrame: (src, target, frameContext) => resolveFrame(context, src, target, frameContext),
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

async function resolveFrame(
  context: RequestContext,
  src: string,
  target?: string,
  frameContext?: ResolveFrameContext,
) {
  let frameUrl = new URL(src, frameContext?.currentFrameSrc ?? context.request.url)
  let headers = new Headers()
  headers.set('accept', 'text/html')
  headers.set('accept-encoding', 'identity')
  headers.set('x-remix-frame', 'true')

  if (target) {
    headers.set('x-remix-target', target)
  }

  let cookie = context.request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  let response = await followFrameRedirects(context.router, context.request, frameUrl, headers)

  if (response.body) {
    return response.body
  }

  if (response.ok) {
    return await response.text()
  }

  return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
}

async function followFrameRedirects(
  router: Router<any>,
  request: Request,
  url: URL,
  headers: Headers,
) {
  let currentUrl = url
  let redirectsRemaining = 10

  while (true) {
    let response = await router.fetch(
      new Request(currentUrl, {
        method: 'GET',
        headers,
        signal: request.signal,
      }),
    )

    let location = response.headers.get('location')
    if (!location || response.status < 300 || response.status >= 400) {
      return response
    }

    if (redirectsRemaining-- <= 0) {
      throw new Error('Too many frame redirects')
    }

    currentUrl = new URL(location, currentUrl)
  }
}
