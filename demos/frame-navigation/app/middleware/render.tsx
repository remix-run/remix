import * as path from 'node:path'

import type { Router } from 'remix/router'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream, type ResolveFrameContext } from 'remix/ui/server'

import { assetServer } from '../utils/assets.ts'

export function render() {
  return renderWith((context) => {
    let request = context.request
    let router = context.router

    return function render(node: RemixNode, init?: ResponseInit) {
      let stream = renderToStream(node, {
        frameSrc: request.url,
        signal: request.signal,
        resolveFrame: (src, target, context) => resolveFrame(router, request, src, target, context),
        async resolveClientEntry(entryId, component) {
          if (!entryId.startsWith('file://')) {
            throw new Error(
              `Expected \`import.meta.url\` for clientEntry ID, received '${entryId}'`,
            )
          }

          return {
            href: await assetServer.getHref(entryId),
            exportName: entryId.split('#')[1] || component.name || titleCaseFileName(entryId),
          }
        },
        onError(error) {
          console.error(error)
        },
      })

      return createHtmlResponse(stream, init)
    }
  })
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
  headers.set('Accept', 'text/html')
  headers.set('Accept-Encoding', 'identity')
  headers.set('X-Remix-Frame', 'true')
  if (target) {
    headers.set('X-Remix-Target', target)
  }

  let cookie = request.headers.get('Cookie')
  if (cookie) headers.set('Cookie', cookie)

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

  return res.text()
}

function titleCaseFileName(fileUrl: string): string {
  let url = new URL(fileUrl)
  let fileName = path.basename(url.pathname, path.extname(url.pathname))
  return fileName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('')
}
